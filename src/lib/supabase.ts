// 类型导入（编译时擦除，不产生运行时依赖）
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IncomingAttack, ResourceCost, UnitType, VillageState } from '../game/types';
import { toast } from '../store/toast';

// Supabase 配置（anon key 设计为公开，由 RLS 保护安全）
// 优先读 env，fallback 到硬编码值（防止 .env 丢失导致线上无存档）
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://rbhbsnmruztvqqkkvkki.supabase.co';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || 'sb_publishable_ocjjxdXuNnk-Ed-ZOy3ZLg_ZOb8eM9W';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;
let clientPromise: Promise<SupabaseClient | null> | null = null;

// 动态加载：首次调用时才 import @supabase/supabase-js（55KB gzip）
// 后续调用直接返回缓存的 Promise/实例
export async function ensureClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return null;
  if (client) return client;
  if (clientPromise) return clientPromise;
  clientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
    client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      realtime: { params: { eventsPerSecond: 5 } },
    });
    return client;
  });
  return clientPromise;
}

// ============== 密码 hash（SHA-256 + salt） ==============
// 注意：MVP 方案，非生产级。后续可升级到 Supabase Auth（邮箱/魔法链接）。
const SALT = 'zhuolu-tribe-2026';

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder().encode(SALT + password);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============== 会话令牌 ==============
// 登录成功后由数据库发放，用于写操作鉴权（RLS 加固后写操作必须持令牌）
const TOKEN_KEY = 'zhuolu-session-token';

export function getSessionToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function setSessionToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

// ============== 玩家账号 ==============
export type VillageRow = {
  player_name: string;
  village_data: VillageState;
  updated_at: string;
};

// 注册新玩家：返回 null 表示成功，返回字符串表示错误信息
// 把 Supabase 客户端抛出的网络错误转成中文友好提示
function friendlyError(err: { message?: string } | null | undefined): string {
  if (!err) return '未知错误';
  const msg = (err.message || '').toLowerCase();
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed')) {
    return '网络连接失败，请检查网络后重试（如开了代理/VPN 请尝试关闭）';
  }
  if (msg.includes('cors')) {
    return '跨域请求被拦截，请检查网络环境';
  }
  if (msg.includes('401') || msg.includes('unauthorized')) {
    return '认证失败，请重新登录';
  }
  if (msg.includes('429')) {
    return '请求过于频繁，请稍后再试';
  }
  if (msg.includes('5')) {
    return '服务器繁忙，请稍后再试';
  }
  return err.message || '请求失败';
}

export async function registerPlayer(
  playerName: string,
  password: string
): Promise<string | null> {
  const sb = await ensureClient();
  if (!sb) return '后端未配置，无法注册';
  const hash = await hashPassword(password);
  const { data, error } = await sb.rpc('register_player', {
    p_name: playerName,
    p_hash: hash,
  });
  if (error) return friendlyError(error);
  return (data as string | null) ?? null;
}

// 登录验证：成功返回 token，失败返回 err
export async function loginPlayer(
  playerName: string,
  password: string
): Promise<{ err: string | null; token: string | null }> {
  const sb = await ensureClient();
  if (!sb) return { err: '后端未配置，无法登录', token: null };
  const hash = await hashPassword(password);
  const { data, error } = await sb.rpc('login_player', {
    p_name: playerName,
    p_hash: hash,
  });
  if (error) return { err: friendlyError(error), token: null };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.err) return { err: row?.err || '登录失败', token: null };
  setSessionToken(row.token);
  return { err: null, token: row.token };
}

// 获取所有已注册玩家名（用于登录页展示）
export async function fetchAllPlayerNames(): Promise<string[]> {
  const sb = await ensureClient();
  if (!sb) return [];
  const { data, error } = await sb.rpc('list_players');
  if (error || !data) return [];
  return (data as string[]) || [];
}

export function clearSession() {
  setSessionToken(null);
}

// ============== 跨玩家：排行榜 ==============
export type LeaderboardEntry = {
  playerName: string;
  tribe: string;
  points: number;
  units: Partial<Record<string, number>>;
  wallLevel: number;
  buildingSum: number;
  shieldUntil: number; // ms 时间戳，0=无护盾
  updatedAt: string;
};

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const sb = await ensureClient();
  if (!sb) return [];
  const { data, error } = await sb.rpc('list_leaderboard');
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    playerName: r.player_name,
    tribe: r.tribe,
    points: r.points || 0,
    units: r.units || {},
    wallLevel: r.wall_level || 0,
    buildingSum: r.building_sum || 0,
    shieldUntil: Number(r.shield_until) || 0,
    updatedAt: r.updated_at,
  }));
}

// ============== 跨玩家：攻击 ==============
// 攻击方提交结算结果，服务端鉴权 + 应用（护盾拦截、上限钳制）
export async function attackRealPlayer(
  target: string,
  loot: ResourceCost,
  defenderLoss: Partial<Record<UnitType, number>>,
  report: IncomingAttack
): Promise<{ ok: boolean; looted?: ResourceCost; reason?: string }> {
  const sb = await ensureClient();
  if (!sb) return { ok: false, reason: '后端未配置' };
  const token = getSessionToken();
  if (!token) return { ok: false, reason: '会话失效，请重新登录' };
  const { data, error } = await sb.rpc('attack_player', {
    p_token: token,
    p_target: target,
    p_loot: loot,
    p_defender_loss: defenderLoss,
    p_report: report,
  });
  if (error) return { ok: false, reason: friendlyError(error) };
  const res = (data || {}) as { ok?: boolean; looted?: ResourceCost; reason?: string };
  return { ok: !!res.ok, looted: res.looted, reason: res.reason };
}

// ============== 村庄存档同步 ==============
// 上传：节流 5 秒。注意：游戏主循环每 500ms 都会 saveVillage，
// 因此这里必须用「固定窗口节流」而非「重置式 debounce」，
// 否则计时器会被持续重置导致上传永不触发。
let uploadTimer: ReturnType<typeof setTimeout> | null = null;
let pendingVillage: VillageState | null = null;
let currentRemoteSub: { unsubscribe: () => void } | null = null;

// 本客户端的写入标记：每次上传都会盖章，用于识别「自己写入产生的回声」。
// 否则服务端推送的滞后快照会覆盖本地较新状态（例如已扣除的出征兵力、
// 已结算完成的行军任务），造成兵力/资源漂移甚至重复结算。
const WRITER_KEY = 'zhuolu-writer-id';
export const WRITER_ID = (() => {
  try {
    let id = sessionStorage.getItem(WRITER_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(WRITER_KEY, id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2);
  }
})();

// 服务端应用跨玩家攻击时写入的标记，保证守方客户端会接受这次推送
export const SERVER_WRITER = 'server-attack';

export function uploadVillage(v: VillageState) {
  // 盖章后再上传，回声可通过 _w 识别
  pendingVillage = { ...v, _w: WRITER_ID };
  // 已有排队中的上传：只更新待上传数据，不重置计时器
  if (uploadTimer) return;
  uploadTimer = setTimeout(flushVillageUpload, 5000);
}

async function flushVillageUpload() {
  uploadTimer = null;
  const sb = await ensureClient();
  if (!sb) return;
  const v = pendingVillage;
  if (!v || !v.playerName) return;
  const token = getSessionToken();
  if (!token) return; // 未登录 / 无令牌，跳过（下次操作重试）
  pendingVillage = null;
  const { data, error } = await sb.rpc('save_village', {
    p_token: token,
    p_data: v,
  });
  const errMsg = error?.message || (data as string | null);
  if (errMsg) {
    console.error('[supabase] 上传失败', errMsg);
    // 校验失败（存档数据异常）：不重试，提示玩家
    if (errMsg.includes('存档数据异常')) {
      toast.error(`存档同步失败：${errMsg}（数据可能异常，请联系客服）`);
      pendingVillage = null; // 校验失败不重试，避免无限循环
    } else if (errMsg.includes('会话失效')) {
      toast.warning('登录已过期，请重新登录');
      pendingVillage = null;
    } else {
      // 网络错误等：保留数据，下次操作重试
      pendingVillage = v;
    }
  }
}

// 立即上传（用于 logout / 关闭页面前）
export async function flushVillageUploadNow() {
  if (uploadTimer) {
    clearTimeout(uploadTimer);
    uploadTimer = null;
  }
  await flushVillageUpload();
}

// 下载：从远端拉取最新村庄数据
export async function downloadVillage(
  playerName: string
): Promise<VillageState | null> {
  const sb = await ensureClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from('villages')
    .select('village_data, updated_at')
    .eq('player_name', playerName)
    .maybeSingle();
  if (error || !data) return null;
  return data.village_data as VillageState;
}

// 订阅远端村庄变更（用于多端实时同步）
export async function subscribeVillage(
  playerName: string,
  onRemoteUpdate: (v: VillageState) => void
): Promise<boolean> {
  const sb = await ensureClient();
  if (!sb) return false;
  unsubscribeVillage();
  const sub = sb
    .channel(`village-${playerName}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'villages',
        filter: `player_name=eq.${playerName}`,
      },
      (payload) => {
        const row = payload.new as VillageRow;
        const remote = row?.village_data;
        if (!remote) return;
        // 忽略自己写入产生的回声：那是滞后快照，会覆盖本地较新状态
        if (remote._w === WRITER_ID) return;
        onRemoteUpdate(remote);
      }
    )
    .subscribe();
  currentRemoteSub = sub;
  return true;
}

export function unsubscribeVillage() {
  if (currentRemoteSub) {
    currentRemoteSub.unsubscribe();
    currentRemoteSub = null;
  }
}

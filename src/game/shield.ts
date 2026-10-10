// 护盾系统配置
// 反P2W：护盾不售卖，仅通过游戏行为获得

import type { ShieldState, VillageState } from './types';

// 新手保护时长：7天
export const NEWBIE_SHIELD_MS = 7 * 24 * 60 * 60 * 1000;

// 主动护盾：消耗纹玉激活，三档可选
export const ACTIVE_SHIELD_OPTIONS = [
  { hours: 1, jade: 10, label: '1小时' },
  { hours: 4, jade: 30, label: '4小时' },
  { hours: 12, jade: 60, label: '12小时' },
] as const;

// 主动护盾冷却：激活后 24 小时内不可再次激活
export const SHIELD_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// 当前是否受护盾保护
export function isShielded(village: { shield: ShieldState | null }): boolean {
  const s = village.shield;
  if (!s) return false;
  return Date.now() < s.expiresAt;
}

// 获取护盾剩余时间（ms），无护盾返回 0
export function shieldRemainingMs(village: { shield: ShieldState | null }): number {
  const s = village.shield;
  if (!s) return 0;
  return Math.max(0, s.expiresAt - Date.now());
}

// 格式化护盾剩余时间
export function formatShieldTime(village: VillageState): string {
  const ms = shieldRemainingMs(village);
  if (ms <= 0) return '无';
  const days = Math.floor(ms / (24 * 3600 * 1000));
  const hours = Math.floor((ms % (24 * 3600 * 1000)) / (3600 * 1000));
  const mins = Math.floor((ms % (3600 * 1000)) / (60 * 1000));
  if (days > 0) return `${days}天${hours}时`;
  if (hours > 0) return `${hours}时${mins}分`;
  return `${mins}分`;
}

// 创建新手护盾
export function createNewbieShield(): ShieldState {
  return {
    type: 'newbie',
    expiresAt: Date.now() + NEWBIE_SHIELD_MS,
    cooldownUntil: 0,
  };
}

// 创建主动护盾
export function createActiveShield(hours: number, currentCooldownUntil = 0): ShieldState {
  return {
    type: 'active',
    expiresAt: Date.now() + hours * 60 * 60 * 1000,
    cooldownUntil: currentCooldownUntil,
  };
}

// 检查是否可以激活主动护盾
export function canActivateShield(village: VillageState): { ok: boolean; reason?: string } {
  const s = village.shield;
  // 新手护盾期间不能叠加
  if (s && s.type === 'newbie' && Date.now() < s.expiresAt) {
    return { ok: false, reason: '新手护盾生效中，无需额外激活' };
  }
  // 冷却期内不能激活
  if (s && s.cooldownUntil > 0 && Date.now() < s.cooldownUntil) {
    const remain = Math.ceil((s.cooldownUntil - Date.now()) / (60 * 1000));
    return { ok: false, reason: `护盾冷却中，还需 ${remain} 分钟` };
  }
  // 已有主动护盾在生效
  if (s && s.type === 'active' && Date.now() < s.expiresAt) {
    return { ok: false, reason: '已有护盾生效中' };
  }
  return { ok: true };
}

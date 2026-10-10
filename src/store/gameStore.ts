import { create } from 'zustand';
import type { BattleReport, BuildTask, BuildTarget, FieldType, BuildingType, FormationType, IncomingAttack, MarchMission, NpcVillage, OfflineReport, PvpBattleReport, RaiderType, ResearchTask, ResourceCost, ResourceType, TechType, TrainTask, TribeType, UnitType, VillageState } from '../game/types';
import { BUILDING_CONFIGS, FIELD_CONFIGS } from '../game/config';
import { SPEED_MULTIPLIER, createInitialVillage } from '../game/initialState';
import { QUESTS, buildQuestContext } from '../game/quests';
import { UNIT_CONFIGS, UNIT_ORDER, aggregateArmy, aggregateRaiders, calcMarchTime, computeUpkeep, FORMATIONS, getUnitDisplay, simulateBattle, CAMP_TEMPLATES, WORLD_BOSS_CONFIG, REALM_CONFIG, RAIDER_CONFIGS } from '../game/units';
import { OFFLINE_CAP_MS, OFFLINE_THRESHOLD_MS, SEASON_MILESTONES_BY_POINTS, SEASON_POINT_RULES, checkSeasonRoll } from '../game/season';
import { TRIBE_BONUS } from '../game/tribes';
import { ACCEL_COST_JADE, ACCEL_RESET_INTERVAL_MS, DAILY_ACCEL_LIMIT, getCosmetic } from '../game/cosmetics';
import { TECH_CONFIGS, getAttackTechMultiplier, getBuildSpeedMultiplier, getCapacityTechMultiplier, getDefenseTechMultiplier, getMarchSpeedMultiplier, getResourceTechBonus, getScoutCostMultiplier, getTrainSpeedMultiplier } from '../game/tech';
import { playSound } from '../game/sound';
import { requestNotificationPermission, pushNotification } from '../game/notifications';
import { canActivateShield, createActiveShield, isShielded } from '../game/shield';
import { COUNTER_ATTACK_CHANCE, NPC_REVIVE_MS, buildCounterAttackForce, calcNpcMarchTime, regenNpc, resolvePvpAttack } from '../game/pvp';
import { toast } from './toast';
import {
  isSupabaseConfigured,
  registerPlayer as remoteRegister,
  loginPlayer as remoteLogin,
  fetchAllPlayerNames,
  uploadVillage,
  downloadVillage,
  flushVillageUploadNow,
  subscribeVillage,
  unsubscribeVillage,
  clearSession,
  fetchLeaderboard,
  attackRealPlayer as remoteAttackPlayer,
  type LeaderboardEntry,
} from '../lib/supabase';

const STORAGE_KEY = 'travian-mvp-save-v5';
const LAST_PLAYER_KEY = 'travian-mvp-last-player';
const PLAYER_LIST_KEY = 'travian-mvp-players';

// 多存档：每个玩家名对应独立存档
function getSaveKey(playerName: string): string {
  return `${STORAGE_KEY}-${playerName}`;
}

// 获取所有已注册玩家名
function getRegisteredPlayers(): string[] {
  try {
    const raw = localStorage.getItem(PLAYER_LIST_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

// 注册玩家名
function registerPlayer(name: string) {
  const list = getRegisteredPlayers();
  if (!list.includes(name)) {
    list.push(name);
    localStorage.setItem(PLAYER_LIST_KEY, JSON.stringify(list));
  }
  localStorage.setItem(LAST_PLAYER_KEY, name);
}

// 获取上次登录的玩家名（用于 LoginScreen 预填，直接 localStorage 读取）
export function getLastPlayer(): string | null {
  return localStorage.getItem(LAST_PLAYER_KEY);
}

// ============== 跨玩家：战力与来袭战报合并 ==============

// 战力估算：兵力（按兵种权重）+ 城墙 + 建筑总和
export function computePower(
  units: Partial<Record<UnitType, number>>,
  wallLevel: number,
  buildingSum: number,
): number {
  let power = 0;
  for (const u of UNIT_ORDER) {
    const cfg = UNIT_CONFIGS[u];
    power += (units[u] || 0) * (cfg.attack + cfg.defense);
  }
  power += wallLevel * 120 + buildingSum * 40;
  return Math.round(power);
}

// 合并来袭战报：按 id 去重，保留已读标记，按时间倒序
function mergeIncoming(
  local: IncomingAttack[] | undefined,
  remote: IncomingAttack[] | undefined,
): IncomingAttack[] {
  const map = new Map<string, IncomingAttack>();
  for (const a of local || []) map.set(a.id, a);
  for (const a of remote || []) {
    const prev = map.get(a.id);
    map.set(a.id, prev ? { ...a, seen: prev.seen || a.seen } : a);
  }
  return Array.from(map.values()).sort((x, y) => y.time - x.time).slice(0, 20);
}

// 已提示过的来袭战报 id（避免重复弹提示）
const notifiedIncoming = new Set<string>();

// 已触发结算的跨玩家出征任务 id（避免任务被重复结算）
const processedMissions = new Set<string>();

// 对新增的未读来袭战报弹提示
function notifyIncoming(list: IncomingAttack[]) {
  for (const a of list) {
    if (a.seen || notifiedIncoming.has(a.id)) continue;
    notifiedIncoming.add(a.id);
    toast.warning(
      `⚔️ ${a.attackerName} 进攻了你的村庄！${a.won ? '村庄被掠夺' : '守军成功抵御'}`,
    );
    pushNotification('⚔️ 遭到攻击', `${a.attackerName} 进攻了你的村庄`);
  }
}

const RESOURCE_LABEL: Record<ResourceType, string> = {
  wood: '木材', clay: '陶土', iron: '铜矿', crop: '粟米',
};

// ============== 派生计算 ==============

export function computeProduction(state: VillageState): ResourceCost {
  const result = { wood: 0, clay: 0, iron: 0, crop: 0 };
  (Object.keys(state.fields) as FieldType[]).forEach((type) => {
    const config = FIELD_CONFIGS[type];
    state.fields[type].forEach((lv) => {
      if (lv > 0) {
        result[config.produces] += config.levels[lv - 1].production;
      }
    });
  });
  // 炎帝部落：粮食产量 +25%
  if (state.tribe === 'yan') {
    result.crop = Math.round(result.crop * TRIBE_BONUS.yan.cropProduction);
  }
  // 农耕系科技加成
  const techBonus = getResourceTechBonus(state.techLevels || {});
  result.wood = Math.round(result.wood * techBonus.wood);
  result.clay = Math.round(result.clay * techBonus.clay);
  result.iron = Math.round(result.iron * techBonus.iron);
  result.crop = Math.round(result.crop * techBonus.crop);
  return result;
}

// 当前容量上限（仓库/粮仓）
const BASE_CAPACITY = 2400;
export function computeCapacity(state: VillageState): ResourceCost {
  const warehouseLv = state.buildings.warehouse || 0;
  const granaryLv = state.buildings.granary || 0;
  const result = { wood: BASE_CAPACITY, clay: BASE_CAPACITY, iron: BASE_CAPACITY, crop: BASE_CAPACITY };
  if (warehouseLv > 0) {
    const cap = BUILDING_CONFIGS.warehouse.levels[warehouseLv - 1].effect.capacity || BASE_CAPACITY;
    result.wood = cap;
    result.clay = cap;
    result.iron = cap;
  }
  if (granaryLv > 0) {
    let cap = BUILDING_CONFIGS.granary.levels[granaryLv - 1].effect.cropCapacity || BASE_CAPACITY;
    // 炎帝部落：粮食容量 +20%
    if (state.tribe === 'yan') cap = Math.round(cap * TRIBE_BONUS.yan.cropCapacity);
    result.crop = cap;
  } else {
    // 无粮仓时也享受炎帝加成
    if (state.tribe === 'yan') result.crop = Math.round(result.crop * TRIBE_BONUS.yan.cropCapacity);
  }
  // 仓廪术科技：容量 +15%/级
  const capMul = getCapacityTechMultiplier(state.techLevels || {});
  result.wood = Math.round(result.wood * capMul);
  result.clay = Math.round(result.clay * capMul);
  result.iron = Math.round(result.iron * capMul);
  result.crop = Math.round(result.crop * capMul);
  return result;
}

export function computeBuildSpeed(state: VillageState): number {
  const lv = state.buildings.mainBuilding || 0;
  let speed = lv === 0 ? 1 : (BUILDING_CONFIGS.mainBuilding.levels[lv - 1].effect.buildSpeed || 1);
  // 黄帝部落：建造速度 +20%
  if (state.tribe === 'huang') speed = speed * TRIBE_BONUS.huang.buildSpeed;
  // 筑造术科技：建造速度 +10%/级
  speed = speed * getBuildSpeedMultiplier(state.techLevels || {});
  return speed;
}

// 蚩尤部落：士兵攻击 +25%（对所有兵种生效）
export function tribeAttackMultiplier(state: VillageState): number {
  return state.tribe === 'chi' ? TRIBE_BONUS.chi.unitAttack : 1;
}

// 蚩尤部落：训练速度 +20%（即训练时间 × 1/1.2）
export function effectiveTrainTime(state: VillageState, baseSec: number): number {
  let t = state.tribe === 'chi' ? baseSec / TRIBE_BONUS.chi.trainSpeed : baseSec;
  // 兵法科技：训练速度 +10%/级（时间 / 倍数）
  t = t / getTrainSpeedMultiplier(state.techLevels || {});
  return t;
}

// 军队总维持消耗
export function armyUpkeep(state: VillageState): number {
  return computeUpkeep(state.units);
}

export function realBuildSeconds(state: VillageState, baseSec: number): number {
  return Math.max(1, Math.round((baseSec * SPEED_MULTIPLIER) / computeBuildSpeed(state)));
}

// 集市税率：基础 20%，每级降 2%，最低 5%
export function getMarketTaxRate(state: VillageState): number {
  const lv = state.buildings.market || 0;
  return Math.max(0.05, 0.2 - lv * 0.02);
}

// 集市单笔最大交易额 = 等级 × 500
export function getMarketMaxTrade(state: VillageState): number {
  const lv = state.buildings.market || 0;
  return lv * 500;
}

// 铸铜坊：每级全兵种攻击 +3%
export function getSmithyAttackBonus(state: VillageState): number {
  const lv = state.buildings.smithy || 0;
  return 1 + lv * 0.03;
}

// 计算城墙防御值
export function getWallDefense(state: VillageState): { defense: number; defenseBonus: number } {
  const lv = state.buildings.wall || 0;
  if (lv === 0) return { defense: 0, defenseBonus: 0 };
  const eff = BUILDING_CONFIGS.wall.levels[lv - 1].effect;
  return { defense: eff.defense || 0, defenseBonus: eff.defenseBonus || 0 };
}

// 计算村庄总兵力（含城墙防御加成）
export function computeVillageDefense(state: VillageState) {
  const wall = getWallDefense(state);
  // 守军防御 = 城墙防御加成（坚甲术科技在 aggregateArmy 的 defMultiplier 中处理）
  const defMult = 1 + wall.defenseBonus;
  const atkMult = tribeAttackMultiplier(state) * getAttackTechMultiplier(state.techLevels || {}) * getSmithyAttackBonus(state);
  const army = aggregateArmy(state.units, state.tribe, atkMult, defMult * getDefenseTechMultiplier(state.techLevels || {}));
  return {
    wallDefense: wall.defense,
    army,
  };
}

// 生成入侵波次（根据玩家进度缩放）
function generateInvasion(state: VillageState): { count: number; type: RaiderType } {
  const totalUnits = Object.values(state.units).reduce((a, b) => a + b, 0);
  const buildingLevels = Object.values(state.buildings).reduce((a, b) => a + (b || 0), 0);
  // 波次强度：基础 5 + 兵力 × 0.4 + 建筑等级 × 0.3
  const count = Math.max(5, Math.floor(5 + totalUnits * 0.4 + buildingLevels * 0.3));
  // 妖兽类型按进度解锁
  const types: RaiderType[] = ['demon', 'wolf', 'mountainSpirit', 'serpent', 'demonKing'];
  const maxIdx = Math.min(types.length - 1, Math.floor(buildingLevels / 8));
  const type = types[Math.floor(Math.random() * (maxIdx + 1))];
  return { count, type };
}

// 执行入侵防御战
function runInvasion(state: VillageState) {
  const { count, type } = generateInvasion(state);
  const raiders = aggregateRaiders(count, type);
  const { wallDefense, army } = computeVillageDefense(state);

  // 城墙防御值作为额外血量池（先吸收伤害），城墙等级越高守军越耐打
  const defenderDef = army.defense + wallDefense * 0.5;
  const atkPower = raiders.attack;
  const defPower = defenderDef;

  let won = false;
  let troopLossRate = 0;

  if (defPower >= atkPower) {
    // 守军胜：妖兽全灭，城墙吸收部分伤害，守军少量损失
    won = true;
    const lossRate = Math.min(0.5, atkPower / (defPower * 2));
    troopLossRate = lossRate * 0.6; // 城墙扛了一半伤害
  } else {
    // 妖兽胜：城墙被摧毁，守军损失惨重
    won = false;
    const lossRate = Math.min(0.95, 1 - defPower / (atkPower * 1.2));
    troopLossRate = lossRate;
  }

  // 按 HP 占比分摊各兵种损失
  const remainingUnits = { ...state.units };
  const totalHp = army.hp || 1;
  for (const u of UNIT_ORDER) {
    const n = remainingUnits[u] || 0;
    if (n <= 0) continue;
    const unitHp = (UNIT_CONFIGS[u].hp * n) || 1;
    const share = unitHp / totalHp;
    const lost = Math.min(n, Math.floor(n * troopLossRate * share * 2));
    remainingUnits[u] = Math.max(0, n - lost);
  }

  // 资源掠夺：战败时掠夺（受地窖保护）
  const crannyLv = state.buildings.cranny || 0;
  const hideAmount = crannyLv > 0 ? BUILDING_CONFIGS.cranny.levels[crannyLv - 1].effect.hideAmount || 0 : 0;
  const stealRate = won ? 0 : 0.25; // 战败掠夺 25% 可掠夺资源
  const steal = (amount: number) => Math.max(0, Math.floor((amount - hideAmount) * stealRate));
  const stolen: ResourceCost = {
    wood: steal(state.resources.wood),
    clay: steal(state.resources.clay),
    iron: steal(state.resources.iron),
    crop: steal(state.resources.crop),
  };
  const remainingResources: ResourceCost = {
    wood: state.resources.wood - stolen.wood,
    clay: state.resources.clay - stolen.clay,
    iron: state.resources.iron - stolen.iron,
    crop: state.resources.crop - stolen.crop,
  };

  return {
    remainingUnits,
    remainingResources,
    report: {
      time: Date.now(),
      raiderCount: count,
      raiderType: type,
      won,
      attackerLost: count, // 妖兽全灭或被击退
      resourcesStolen: stolen,
    },
  };
}

// ============== Store ==============

type GameStore = {
  village: VillageState;
  completedQuests: string[];
  battleReports: BattleReport[];
  pvpReports: PvpBattleReport[];
  offlineReport: OfflineReport | null;
  // 登录状态
  isLoggedIn: boolean;
  isLoggingIn: boolean;
  registeredPlayers: string[];
  onlinePlayers: string[];
  // 登录/登出
  login: (playerName: string, password: string) => Promise<string | null>;
  register: (playerName: string, password: string) => Promise<string | null>;
  logout: () => void;
  // 操作
  tick: () => void;
  setTribe: (tribe: TribeType) => void;
  enqueueFieldUpgrade: (fieldType: FieldType, index: number) => void;
  enqueueBuildingUpgrade: (building: BuildingType) => void;
  cancelTask: (taskId: string) => void;
  accelerateTask: (taskId: string, secondsReduced: number) => void;
  accelerateTaskByRatio: (taskId: string, ratio: number) => void;
  // 训练
  enqueueTraining: (unit: UnitType, count: number) => void;
  cancelTrainTask: (taskId: string) => void;
  // 战斗
  attackCamp: (campId: string, units: Partial<Record<UnitType, number>>, formation: FormationType) => void;
  garrisonCamp: (campId: string, units: Partial<Record<UnitType, number>>) => void;
  recallGarrison: (campId: string) => void;
  scoutCamp: (campId: string) => void;
  // PVP
  attackPlayer: (npcId: string, units: Partial<Record<UnitType, number>>, formation: FormationType) => void;
  scoutPlayer: (npcId: string) => void;
  dismissPvpReport: (id: string) => void;
  // 跨玩家：全服排行榜 + 真实玩家互攻
  leaderboard: LeaderboardEntry[];
  isLeaderboardLoading: boolean;
  refreshLeaderboard: () => Promise<void>;
  attackRealPlayer: (targetName: string, units: Partial<Record<UnitType, number>>, formation: FormationType) => boolean;
  markAllIncomingSeen: () => void;
  // 科技研发
  startResearch: (tech: TechType) => void;
  cancelResearch: () => void;
  // 集市交易
  tradeResources: (from: ResourceType, to: ResourceType, amount: number) => boolean;
  dismissBattleReport: (id: string) => void;
  // 纹玉与外观（反P2W）
  purchaseCosmetic: (id: string) => void;
  equipCosmetic: (id: string | null) => void;
  addJade: (amount: number, reason: string) => void;
  // 离线收益
  checkOfflineEarnings: () => void;
  dismissOfflineReport: () => void;
  // 赛季
  claimSeasonMilestone: (points: number) => void;
  seasonEndReport: { oldSeason: number; oldPoints: number; newSeason: number } | null;
  dismissSeasonEnd: () => void;
  // 护盾
  activateShield: (hours: number, jadeCost: number) => void;
  reset: () => void;
};

// 校验前置条件
function checkBuildingPrereqs(state: VillageState, type: BuildingType): { ok: boolean; missing?: string } {
  const config = BUILDING_CONFIGS[type];
  // 封禅台等级上限：其他建筑等级不能超过封禅台
  if (type !== 'mainBuilding') {
    const mainLv = state.buildings.mainBuilding || 0;
    const curLv = state.buildings[type] || 0;
    if (mainLv > 0 && curLv >= mainLv) {
      return { ok: false, missing: `建筑等级不能超过封禅台（当前 Lv${mainLv}），请先升级封禅台` };
    }
  }
  for (const pre of config.prerequisites) {
    const cur = state.buildings[pre.building] || 0;
    if (cur < pre.level) {
      return { ok: false, missing: `${BUILDING_CONFIGS[pre.building].name} 需 Lv${pre.level}（当前 Lv${cur}）` };
    }
  }
  return { ok: true };
}

function canAfford(have: ResourceCost, cost: ResourceCost): boolean {
  return have.wood >= cost.wood && have.clay >= cost.clay && have.iron >= cost.iron && have.crop >= cost.crop;
}

function deductCost(have: ResourceCost, cost: ResourceCost): ResourceCost {
  return {
    wood: have.wood - cost.wood,
    clay: have.clay - cost.clay,
    iron: have.iron - cost.iron,
    crop: have.crop - cost.crop,
  };
}

function getActiveFieldTaskCount(queue: BuildTask[]): number {
  return queue.filter((t) => t.target.kind === 'field').length;
}
function getActiveBuildingTaskCount(queue: BuildTask[]): number {
  return queue.filter((t) => t.target.kind === 'building').length;
}

const MAX_FIELD_QUEUE = 1;
const MAX_BUILDING_QUEUE = 1;

// 检查并触发任务完成
function checkQuests(set: (fn: (s: GameStore) => Partial<GameStore>) => void, village: VillageState, completed: string[], victories: number) {
  const ctx = buildQuestContext(village.fields, village.buildings, village.units, victories);
  const newlyCompleted: string[] = [];
  let totalReward: ResourceCost = { wood: 0, clay: 0, iron: 0, crop: 0 };
  let totalJade = 0;

  for (const q of QUESTS) {
    if (completed.includes(q.id)) continue;
    if (q.check(ctx)) {
      newlyCompleted.push(q.id);
      totalReward.wood += q.reward.wood;
      totalReward.clay += q.reward.clay;
      totalReward.iron += q.reward.iron;
      totalReward.crop += q.reward.crop;
      totalJade += q.jade;
      toast.success(`任务完成：${q.title} ${q.rewardText}`);
      playSound('quest_complete');
    }
  }

  if (newlyCompleted.length > 0) {
    const v = { ...village };
    v.resources = {
      wood: v.resources.wood + totalReward.wood,
      clay: v.resources.clay + totalReward.clay,
      iron: v.resources.iron + totalReward.iron,
      crop: v.resources.crop + totalReward.crop,
    };
    v.jade += totalJade;
    // 任务完成加赛季积分
    v.season = { ...v.season, points: v.season.points + SEASON_POINT_RULES.questComplete * newlyCompleted.length };
    saveVillage(v);
    saveCompletedQuests([...completed, ...newlyCompleted], v.playerName || undefined);
    set(() => ({
      village: v,
      completedQuests: [...completed, ...newlyCompleted],
    }));
  }
}

// ============== 跨玩家：真实玩家出征结算 ==============
// 出征部队已在下达命令时从村中扣除；抵达后拉取目标远端存档，
// 用现有 PVP 逻辑在本地结算，再把结果提交服务端应用（护盾拦截 / 上限钳制）。
async function resolveRealAttack(m: MarchMission) {
  const targetName = m.campId;
  const attacker = useGame.getState().village;

  // 部队归营（目标不存在 / 受护盾保护 / 结算失败时）
  const returnHome = (units: Partial<Record<UnitType, number>>, note?: string) => {
    useGame.setState((s) => {
      const vv = { ...s.village };
      const after = { ...vv.units };
      for (const u of UNIT_ORDER) after[u] = (after[u] || 0) + (units[u] || 0);
      vv.units = after;
      saveVillage(vv);
      return { village: vv };
    });
    if (note) toast.info(note);
  };

  const target = await downloadVillage(targetName);
  if (!target) {
    returnHome(m.units, `⚠️ 目标 ${targetName} 不存在，部队已撤回`);
    return;
  }
  // 护盾保护：新手保护期或主动护盾生效中，撤军（服务端还会再拦一次）
  if (target.shield && target.shield.expiresAt > Date.now()) {
    returnHome(m.units, `🛡️ ${targetName} 处于护盾保护中，部队撤回`);
    return;
  }

  // 构造与 NPC 同构的防守方，复用 resolvePvpAttack
  const defVillage: NpcVillage = {
    id: targetName,
    name: targetName,
    tribe: target.tribe,
    position: { x: 50, y: 50 },
    units: target.units,
    baseUnits: target.units,
    wallLevel: target.buildings.wall || 0,
    resources: target.resources,
    resourceCap: target.resources,
    scouted: true,
  };

  const form = FORMATIONS[m.formation];
  const atkMult = form.atkMod * tribeAttackMultiplier(attacker) * getAttackTechMultiplier(attacker.techLevels || {}) * getSmithyAttackBonus(attacker);
  const defMult = form.defMod * getDefenseTechMultiplier(attacker.techLevels || {});
  const result = resolvePvpAttack(m.units, attacker.tribe, atkMult, defMult, defVillage);

  // 守军损失（交由服务端按实际兵力钳制）
  const defenderLoss: Partial<Record<UnitType, number>> = {};
  for (const u of UNIT_ORDER) {
    const before = defVillage.units[u] || 0;
    const after = result.remainingNpcUnits[u] || 0;
    if (before - after > 0) defenderLoss[u] = before - after;
  }

  // 攻击方存活兵力（战败则全灭）
  const survivors: Partial<Record<UnitType, number>> = {};
  if (result.win) {
    for (const u of UNIT_ORDER) {
      survivors[u] = Math.max(0, (m.units[u] || 0) - (result.attackerLostByUnit[u] || 0));
    }
  }

  const report: IncomingAttack = {
    id: `incoming-${m.id}`,
    time: Date.now(),
    attackerName: attacker.playerName,
    attackerTribe: attacker.tribe,
    won: result.win,
    plundered: result.plundered,
    troopsLost: result.defenderLost,
    troopsLostByUnit: defenderLoss,
  };

  const res = await remoteAttackPlayer(targetName, result.plundered, defenderLoss, report);
  const looted: ResourceCost = res.ok && res.looted
    ? res.looted
    : { wood: 0, clay: 0, iron: 0, crop: 0 };

  useGame.setState((s) => {
    const vv = { ...s.village };
    const after = { ...vv.units };
    for (const u of UNIT_ORDER) after[u] = (after[u] || 0) + (survivors[u] || 0);
    vv.units = after;
    if (res.ok) {
      vv.resources = {
        wood: vv.resources.wood + looted.wood,
        clay: vv.resources.clay + looted.clay,
        iron: vv.resources.iron + looted.iron,
        crop: vv.resources.crop + looted.crop,
      };
      if (result.win) {
        vv.season = { ...vv.season, points: vv.season.points + SEASON_POINT_RULES.battleWin };
      }
    }
    saveVillage(vv);
    const rep: PvpBattleReport = {
      id: `real-${targetName}-${report.time}`,
      win: result.win && res.ok,
      targetId: targetName,
      targetName,
      targetTribe: target.tribe,
      attackerLost: result.attackerLost,
      attackerLostByUnit: result.attackerLostByUnit,
      defenderLost: result.defenderLost,
      plundered: looted,
      formation: m.formation,
      at: report.time,
      side: 'attack',
    };
    const pvpReports = [...s.pvpReports, rep].slice(-MAX_REPORTS);
    savePvpReports(pvpReports, vv.playerName || undefined);
    return { village: vv, pvpReports };
  });

  if (!res.ok) {
    toast.error(`⚔️ 进攻 ${targetName} 失败：${res.reason || '未知错误'}`);
    return;
  }
  if (result.win) {
    const total = looted.wood + looted.clay + looted.iron + looted.crop;
    toast.success(`⚔️ 攻破 ${targetName}！掠夺 ${total} 资源`);
    playSound('battle_win');
  } else {
    toast.error(`⚔️ 进攻 ${targetName} 失败，出征部队全军覆没`);
    playSound('battle_lose');
  }
}

export const useGame = create<GameStore>((set, get) => ({
  village: createInitialVillage(),
  completedQuests: [],
  battleReports: [],
  pvpReports: [],
  offlineReport: null,
  seasonEndReport: null,
  isLoggedIn: false,
  isLoggingIn: false,
  registeredPlayers: getRegisteredPlayers(),
  onlinePlayers: [],
  leaderboard: [],
  isLeaderboardLoading: false,

  register: async (playerName, password) => {
    const name = playerName.trim().slice(0, 12);
    if (!name) return '请输入玩家名';
    if (!password || password.length < 4) return '密码至少 4 位';
    set({ isLoggingIn: true });
    try {
      if (isSupabaseConfigured) {
        const err = await remoteRegister(name, password);
        if (err) { set({ isLoggingIn: false }); return err; }
      } else {
        toast.warning('未配置 Supabase，仅本地存档模式');
      }
      // 注册成功，自动登录
      const loginErr = await get().login(name, password);
      set({ isLoggingIn: false });
      return loginErr;
    } catch (e: any) {
      set({ isLoggingIn: false });
      return e?.message || '注册失败';
    }
  },

  login: async (playerName, password) => {
    const name = playerName.trim().slice(0, 12);
    if (!name) return '请输入玩家名';
    if (!password) return '请输入密码';
    set({ isLoggingIn: true });
    try {
      if (isSupabaseConfigured) {
        const { err } = await remoteLogin(name, password);
        if (err) { set({ isLoggingIn: false }); return err; }
      } else {
        // 本地模式：无密码校验
      }
      registerPlayer(name);
      // 本地是否已有该玩家存档：新设备登录时应无条件采用云端数据
      const hadLocalSave = (() => {
        try { return !!localStorage.getItem(getSaveKey(name)); } catch { return false; }
      })();
      // 先从 localStorage 同步加载（快速启动）
      const localV = loadVillage(name);
      localV.playerName = name;
      const quests = loadCompletedQuests(name);
      const savedBattleReports = loadBattleReports(name);
      const savedPvpReports = loadPvpReports(name);
      set({
        village: localV,
        completedQuests: quests,
        battleReports: savedBattleReports,
        pvpReports: savedPvpReports,
        isLoggedIn: true,
        isLoggingIn: false,
        registeredPlayers: getRegisteredPlayers(),
        offlineReport: null,
      });
      toast.success(`欢迎，${name}！`);
      requestNotificationPermission();

      // 异步：从 Supabase 拉取最新远端存档，覆盖本地
      if (isSupabaseConfigured) {
        downloadVillage(name).then((remote) => {
          if (!remote) return;
          const cur = get().village;
          // 远端更新时间 > 本地 lastTick 才覆盖
          const remoteTs = remote.lastTick || remote.lastSeen || 0;
          const localTs = cur.lastTick || 0;
          // 无论是否整体采用远端，来袭战报都要合并（服务端可能已写入）
          const merged = mergeIncoming(cur.incomingAttacks, remote.incomingAttacks);
          if (!hadLocalSave || remoteTs > localTs) {
            remote.playerName = name;
            remote.lastTick = Date.now();
            remote.incomingAttacks = merged;
            set({ village: remote });
            // 只写本地，避免立即回环上传
            saveVillageLocal(remote);
          } else {
            const v = { ...cur, incomingAttacks: merged };
            set({ village: v });
            saveVillageLocal(v);
          }
          notifyIncoming(merged);
        });
        // 订阅远端变更（多端实时同步 + 被攻击通知）
        // subscribeVillage 现在是 async（动态加载 supabase），不阻塞登录流程
        subscribeVillage(name, (remoteV) => {
          if (!get().isLoggedIn) return;
          const cur = get().village;
          // 远端推送代表另一端刚写入的最新状态，直接采用；来袭战报按并集合并
          const merged = mergeIncoming(cur.incomingAttacks, remoteV.incomingAttacks);
          remoteV.playerName = name;
          remoteV.lastTick = Date.now();
          remoteV.incomingAttacks = merged;
          set({ village: remoteV });
          // 只写本地，不再上传（避免回环）
          saveVillageLocal(remoteV);
          notifyIncoming(merged);
        });
        // 拉取全服玩家名列表 + 排行榜
        fetchAllPlayerNames().then((list) => {
          if (list.length > 0) {
            set({ onlinePlayers: list, registeredPlayers: Array.from(new Set([...getRegisteredPlayers(), ...list])) });
          }
        });
        get().refreshLeaderboard();
      }
      return null;
    } catch (e: any) {
      set({ isLoggingIn: false });
      return e?.message || '登录失败';
    }
  },

  logout: () => {
    // 上传最新状态后登出
    if (isSupabaseConfigured) {
      flushVillageUploadNow().finally(() => clearSession());
      unsubscribeVillage();
    }
    localStorage.removeItem(LAST_PLAYER_KEY);
    notifiedIncoming.clear();
    set({ village: createInitialVillage(), completedQuests: [], isLoggedIn: false, battleReports: [], pvpReports: [], offlineReport: null, seasonEndReport: null, onlinePlayers: [], leaderboard: [] });
  },

  setTribe: (tribe) => {
    set((s) => {
      const v = { ...s.village, tribe };
      saveVillage(v);
      return { village: v };
    });
  },

  tick: () => {
    set((s) => {
      const now = Date.now();
      const v = { ...s.village };
      const dt = (now - v.lastTick) / 1000;
      if (dt <= 0) return s;

      const prod = computeProduction(v);
      const cap = computeCapacity(v);
      // 驻守据点产出
      let garrisonProd = { wood: 0, clay: 0, iron: 0, crop: 0 };
      for (const camp of Object.values(v.camps)) {
        if (camp.occupied && camp.garrison) {
          const tpl = CAMP_TEMPLATES.find((t) => t.name === camp.name);
          if (tpl) {
            garrisonProd.wood += tpl.garrisonYield.wood;
            garrisonProd.clay += tpl.garrisonYield.clay;
            garrisonProd.iron += tpl.garrisonYield.iron;
            garrisonProd.crop += tpl.garrisonYield.crop;
          }
        }
      }
      const totalProd = {
        wood: prod.wood + garrisonProd.wood,
        clay: prod.clay + garrisonProd.clay,
        iron: prod.iron + garrisonProd.iron,
        crop: prod.crop + garrisonProd.crop,
      };
      // 粟米扣除军队维持（本村 + 驻守）
      let upkeepCrop = computeUpkeep(v.units);
      for (const camp of Object.values(v.camps)) {
        if (camp.garrison) upkeepCrop += computeUpkeep(camp.garrison);
      }
      const netCrop = Math.max(0, totalProd.crop - upkeepCrop);
      v.resources = {
        wood: Math.min(cap.wood, v.resources.wood + (totalProd.wood / 3600) * dt),
        clay: Math.min(cap.clay, v.resources.clay + (totalProd.clay / 3600) * dt),
        iron: Math.min(cap.iron, v.resources.iron + (totalProd.iron / 3600) * dt),
        crop: Math.min(cap.crop, Math.max(0, v.resources.crop + (netCrop / 3600) * dt)),
      };

      // 完成建造任务
      const remaining: BuildTask[] = [];
      const completedNow: BuildTask[] = [];
      for (const task of v.buildQueue) {
        if (now >= task.startAt + task.duration) {
          completedNow.push(task);
        } else {
          remaining.push(task);
        }
      }
      for (const task of completedNow) {
        applyCompletion(v, task.target, task.toLevel);
        toast.success(`${getTaskName(task)} 升级到 Lv${task.toLevel}`);
        playSound('build_complete');
        pushNotification('🏗️ 建造完成', `${getTaskName(task)} 升级到 Lv${task.toLevel}`);
      }
      v.buildQueue = remaining;

      // 推进训练队列
      const trainRemaining: TrainTask[] = [];
      const newUnits: Partial<Record<UnitType, number>> = {};
      for (const task of v.trainQueue) {
        const elapsed = now - task.startAt;
        const expectedDone = Math.min(task.count, Math.floor(elapsed / task.perUnitMs));
        const newlyDone = expectedDone - task.done;
        if (newlyDone > 0) {
          newUnits[task.unit] = (newUnits[task.unit] || 0) + newlyDone;
        }
        if (expectedDone >= task.count) {
          // 完整完成
          const u = getUnitDisplay(v.tribe, task.unit);
          toast.success(`训练完成：${u.emoji} ${u.name} ×${task.count}`);
          playSound('train_complete');
          continue;
        }
        trainRemaining.push({ ...task, done: expectedDone });
      }
      if (Object.keys(newUnits).length > 0) {
        const merged = { ...v.units };
        for (const u of UNIT_ORDER) merged[u] = (merged[u] || 0) + (newUnits[u] || 0);
        v.units = merged;
      }
      v.trainQueue = trainRemaining;

      // 完成研发任务
      const remainingResearch: ResearchTask[] = [];
      for (const task of v.researchQueue) {
        if (now >= task.startAt + task.duration) {
          const cfg = TECH_CONFIGS[task.tech];
          v.techLevels = { ...v.techLevels, [task.tech]: task.level };
          // 研发完成加赛季积分
          v.season = { ...v.season, points: v.season.points + SEASON_POINT_RULES.researchComplete };
          toast.success(`📚 研发完成：${cfg.emoji} ${cfg.name} Lv${task.level}`);
          playSound('research');
        } else {
          remainingResearch.push(task);
        }
      }
      v.researchQueue = remainingResearch;

      // 妖兽入侵：到时间则触发防御战
      // 新手保护期或主动护盾生效中：妖兽不敢进犯，跳过本次入侵
      if (now >= v.nextInvasionAt) {
        if (isShielded(v)) {
          v.nextInvasionAt = now + 5 * 60 * 1000;
        } else {
          const invasion = runInvasion(v);
          v.lastDefenseReport = invasion.report;
          v.units = invasion.remainingUnits;
          v.resources = invasion.remainingResources;
          // 下次入侵：5 分钟后
          v.nextInvasionAt = now + 5 * 60 * 1000;
          if (invasion.report.won) {
            toast.success(`🛡️ 成功抵御 ${invasion.report.raiderCount} 只妖兽入侵！`);
            playSound('defense_win');
            pushNotification('🛡️ 妖兽击退', `成功抵御 ${invasion.report.raiderCount} 只妖兽入侵`);
          } else {
            toast.warning(`💀 防御失败！${invasion.report.raiderCount} 只妖兽掠夺了资源`);
            playSound('defense_lose');
            pushNotification('💀 妖兽入侵', `防御失败，${invasion.report.raiderCount} 只妖兽掠夺了资源`);
          }
        }
      }

      // 据点自动刷新：被清空且未占领后 60 秒恢复，难度递增
      const REFRESH_MS = 60 * 1000;
      const refreshedCamps = { ...v.camps };
      let campChanged = false;
      for (const [id, c] of Object.entries(refreshedCamps)) {
        // 迁移旧存档：补 kind 字段
        if (!c.kind) { c.kind = 'normal'; campChanged = true; }
        // 世界Boss 刷新/过期
        if (c.kind === 'worldBoss') {
          if (!c.bossActive && c.bossRespawnAt && now >= c.bossRespawnAt) {
            refreshedCamps[id] = { ...c, bossActive: true, bossHp: c.bossMaxHp || WORLD_BOSS_CONFIG.bossMaxHp, raiders: c.maxRaiders, bossRespawnAt: now + WORLD_BOSS_CONFIG.activeDurationMs };
            campChanged = true;
          } else if (c.bossActive && c.bossRespawnAt && now >= c.bossRespawnAt) {
            // Boss 活跃时间结束
            refreshedCamps[id] = { ...c, bossActive: false, raiders: 0, bossHp: 0, bossRespawnAt: now + WORLD_BOSS_CONFIG.respawnMs };
            campChanged = true;
          }
          continue;
        }
        // 秘境 刷新/过期
        if (c.kind === 'realm') {
          if (!c.bossActive && c.bossRespawnAt && now >= c.bossRespawnAt) {
            refreshedCamps[id] = { ...c, bossActive: true, raiders: c.maxRaiders, bossRespawnAt: now + REALM_CONFIG.activeDurationMs, realmExpiresAt: now + REALM_CONFIG.activeDurationMs };
            campChanged = true;
          } else if (c.bossActive && c.realmExpiresAt && now >= c.realmExpiresAt) {
            refreshedCamps[id] = { ...c, bossActive: false, raiders: 0, bossRespawnAt: now + REALM_CONFIG.spawnMs, realmExpiresAt: 0 };
            campChanged = true;
          }
          continue;
        }
        // 普通据点 & 资源矿点：清空后 60s 恢复，难度递增
        if (!c.occupied && c.raiders === 0 && c.clearedAt && now - c.clearedAt >= REFRESH_MS) {
          const cc = c.clearCount || 0;
          const scale = Math.min(1.5, 1 + cc * 0.1); // 每次清空+10%难度，上限+50%
          refreshedCamps[id] = { ...c, raiders: Math.floor(c.maxRaiders * scale), clearedAt: undefined };
          campChanged = true;
        }
      }
      if (campChanged) v.camps = refreshedCamps;

      // NPC 村庄恢复：兵力与资源随时间回涨
      // 防护：HMR 或旧存档可能无 players 字段
      if (v.players) {
        const regenedPlayers = { ...v.players };
        let playersChanged = false;
        for (const [id, npc] of Object.entries(regenedPlayers)) {
          const updated = regenNpc(npc, dt);
          if (updated !== npc) {
            regenedPlayers[id] = updated;
            playersChanged = true;
          }
        }
        if (playersChanged) v.players = regenedPlayers;
      } else {
        // 迁移：旧内存状态无 players，从初始村庄补全
        v.players = createInitialVillage().players;
      }

      // 处理行军任务（到达后执行）
      if (v.marchQueue.length > 0) {
        const stillMarching: MarchMission[] = [];
        for (const m of v.marchQueue) {
          if (now >= m.arriveAt) {
            // 到达，执行任务
            const camp = v.camps[m.campId];
            if (m.kind === 'attack' && camp) {
              // 战斗
              const form = FORMATIONS[m.formation];
              // 阵型 × 部落 × 科技（强兵术/坚甲术）
              const atkMult = form.atkMod * tribeAttackMultiplier(v) * getAttackTechMultiplier(v.techLevels || {}) * getSmithyAttackBonus(v);
              const defMult = form.defMod * getDefenseTechMultiplier(v.techLevels || {});
              const atkArmy = aggregateArmy(m.units, v.tribe, atkMult, defMult);

              // 世界Boss / 秘境：可多次攻击，扣血而非全灭
              if ((camp.kind === 'worldBoss' || camp.kind === 'realm') && camp.bossActive && camp.raiders > 0) {
                const defArmy = aggregateRaiders(camp.raiders, camp.raiderType);
                const result = simulateBattle(atkArmy, defArmy, v.tribe);

                // Boss 扣血 = 本次击杀的妖兽数 × 妖兽HP
                const raiderCfg = RAIDER_CONFIGS[camp.raiderType];
                const dmgDealt = result.defenderLost * raiderCfg.hp;
                const newBossHp = Math.max(0, (camp.bossHp || 0) - dmgDealt);
                const newRaiders = Math.max(0, camp.raiders - result.defenderLost);
                const bossDefeated = newBossHp <= 0 || newRaiders === 0;

                // 返还兵力
                let reward: ResourceCost = { wood: 0, clay: 0, iron: 0, crop: 0 };
                const after = { ...v.units };
                for (const u of UNIT_ORDER) {
                  const lost = result.attackerLostByUnit[u] || 0;
                  after[u] = (after[u] || 0) + ((m.units[u] || 0) - lost);
                }
                v.units = after;

                if (bossDefeated) {
                  // 击败Boss：大奖励
                  reward = { ...camp.reward };
                  v.resources = {
                    wood: v.resources.wood + reward.wood,
                    clay: v.resources.clay + reward.clay,
                    iron: v.resources.iron + reward.iron,
                    crop: v.resources.crop + reward.crop,
                  };
                  v.season = { ...v.season, points: v.season.points + SEASON_POINT_RULES.battleWin * 3 };
                  const newCamps2 = { ...v.camps };
                  newCamps2[m.campId] = {
                    ...camp,
                    bossActive: false,
                    bossHp: 0,
                    raiders: 0,
                    occupied: camp.kind === 'realm' ? false : true, // 世界Boss可占领驻守
                    clearedAt: Date.now(),
                    clearCount: (camp.clearCount || 0) + 1,
                    bossRespawnAt: Date.now() + (camp.kind === 'worldBoss' ? WORLD_BOSS_CONFIG.respawnMs : REALM_CONFIG.spawnMs),
                    realmExpiresAt: 0,
                  };
                  v.camps = newCamps2;
                  toast.success(`🏆 击败 ${camp.name}！获得丰厚战利品！`);
                  playSound('battle_win');
                } else {
                  // Boss未死，按伤害比例给奖励
                  const dmgRatio = dmgDealt / (camp.bossMaxHp || 1);
                  reward = {
                    wood: Math.floor(camp.reward.wood * dmgRatio * 0.3),
                    clay: Math.floor(camp.reward.clay * dmgRatio * 0.3),
                    iron: Math.floor(camp.reward.iron * dmgRatio * 0.3),
                    crop: Math.floor(camp.reward.crop * dmgRatio * 0.3),
                  };
                  v.resources = {
                    wood: v.resources.wood + reward.wood,
                    clay: v.resources.clay + reward.clay,
                    iron: v.resources.iron + reward.iron,
                    crop: v.resources.crop + reward.crop,
                  };
                  const newCamps3 = { ...v.camps };
                  newCamps3[m.campId] = { ...camp, bossHp: newBossHp, raiders: newRaiders };
                  v.camps = newCamps3;
                  toast.success(`⚔️ 对 ${camp.name} 造成 ${Math.round(dmgDealt)} 伤害！剩余 ${(newBossHp / (camp.bossMaxHp || 1) * 100).toFixed(0)}%`);
                  playSound('battle_win');
                }

                const report: BattleReport = {
                  win: bossDefeated,
                  attackerLost: result.attackerLost,
                  attackerLostByUnit: result.attackerLostByUnit,
                  defenderLost: result.defenderLost,
                  reward,
                  campId: m.campId,
                  campName: camp.name,
                  formation: m.formation,
                  at: Date.now(),
                };
                setTimeout(() => {
                  useGame.setState((st) => {
                    const reports = [...st.battleReports, report].slice(-MAX_REPORTS);
                    saveBattleReports(reports, st.village.playerName || undefined);
                    return { battleReports: reports };
                  });
                  const wins = useGame.getState().battleReports.filter((r) => r.win).length;
                  checkQuests(set, v, useGame.getState().completedQuests, wins);
                }, 0);
              } else {
                // 普通据点 & 资源矿点：原有逻辑
                const defArmy = aggregateRaiders(camp.raiders, camp.raiderType);
                const result = simulateBattle(atkArmy, defArmy, v.tribe);

                const newCamps = { ...v.camps };
                const newRaiders = Math.max(0, camp.raiders - result.defenderLost);
                newCamps[m.campId] = {
                  ...camp,
                  raiders: newRaiders,
                  clearedAt: newRaiders === 0 ? Date.now() : camp.clearedAt,
                  // 战胜且清空 → 标记为已占领（等待玩家驻守）
                  occupied: result.attackerWin && newRaiders === 0 ? true : camp.occupied,
                  clearCount: newRaiders === 0 ? (camp.clearCount || 0) + 1 : (camp.clearCount || 0),
                };
                v.camps = newCamps;

                // 战胜返还兵力 + 奖励
                let reward: ResourceCost = { wood: 0, clay: 0, iron: 0, crop: 0 };
                if (result.attackerWin) {
                  const after = { ...v.units };
                  for (const u of UNIT_ORDER) {
                    const lost = result.attackerLostByUnit[u] || 0;
                    after[u] = (after[u] || 0) + ((m.units[u] || 0) - lost);
                  }
                  v.units = after;
                  reward = { ...camp.reward };
                  v.resources = {
                    wood: v.resources.wood + reward.wood,
                    clay: v.resources.clay + reward.clay,
                    iron: v.resources.iron + reward.iron,
                    crop: v.resources.crop + reward.crop,
                  };
                  v.season = { ...v.season, points: v.season.points + SEASON_POINT_RULES.battleWin };
                  toast.success(`🏹 ${camp.name} 大捷！获得战利品`);
                  playSound('battle_win');
                } else {
                  toast.error(`🏹 ${camp.name} 战败，出征部队全军覆没`);
                  playSound('battle_lose');
                }

                const report: BattleReport = {
                  win: result.attackerWin,
                  attackerLost: result.attackerLost,
                  attackerLostByUnit: result.attackerLostByUnit,
                  defenderLost: result.defenderLost,
                  reward,
                  campId: m.campId,
                  campName: camp.name,
                  formation: m.formation,
                  at: Date.now(),
                };
                setTimeout(() => {
                  useGame.setState((st) => {
                    const reports = [...st.battleReports, report].slice(-MAX_REPORTS);
                    saveBattleReports(reports, st.village.playerName || undefined);
                    return { battleReports: reports };
                  });
                  const wins = useGame.getState().battleReports.filter((r) => r.win).length;
                  checkQuests(set, v, useGame.getState().completedQuests, wins);
                }, 0);
              }
            } else if (m.kind === 'garrison' && camp) {
              // 驻守兵力到达
              const existing = camp.garrison || {};
              const merged = { ...existing };
              for (const u of UNIT_ORDER) merged[u] = (merged[u] || 0) + (m.units[u] || 0);
              v.camps = { ...v.camps, [m.campId]: { ...camp, garrison: merged, occupied: true } };
              toast.success(`🏴 ${camp.name} 驻守兵力已到达`);
            } else if (m.kind === 'recall') {
              // 撤回兵力归营
              const after = { ...v.units };
              for (const u of UNIT_ORDER) after[u] = (after[u] || 0) + (m.units[u] || 0);
              v.units = after;
              toast.info(`↩️ 驻守兵力已归营`);
            } else if (m.kind === 'pvpAttack') {
              // 玩家出征 NPC 村庄到达 → 结算 PVP 攻击
              const npc = v.players?.[m.campId];
              if (npc) {
                const form = FORMATIONS[m.formation];
                const atkMult = form.atkMod * tribeAttackMultiplier(v) * getAttackTechMultiplier(v.techLevels || {}) * getSmithyAttackBonus(v);
                const defMult = form.defMod * getDefenseTechMultiplier(v.techLevels || {});
                const result = resolvePvpAttack(m.units, v.tribe, atkMult, defMult, npc);

                // 更新 NPC 战后状态
                const updatedNpc = {
                  ...npc,
                  units: result.remainingNpcUnits,
                  resources: result.remainingNpcResources,
                  lastAttackedAt: now,
                  defeatedAt: result.win ? now : npc.defeatedAt,
                };
                v.players = { ...v.players, [npc.id]: updatedNpc };

                // 战胜：返还存活兵力 + 掠夺资源
                if (result.win) {
                  const after = { ...v.units };
                  for (const u of UNIT_ORDER) {
                    const lost = result.attackerLostByUnit[u] || 0;
                    after[u] = (after[u] || 0) + ((m.units[u] || 0) - lost);
                  }
                  v.units = after;
                  v.resources = {
                    wood: v.resources.wood + result.plundered.wood,
                    clay: v.resources.clay + result.plundered.clay,
                    iron: v.resources.iron + result.plundered.iron,
                    crop: v.resources.crop + result.plundered.crop,
                  };
                  v.season = { ...v.season, points: v.season.points + SEASON_POINT_RULES.battleWin };
                  toast.success(`⚔️ 攻破 ${npc.name}！掠夺大量资源`);
                  playSound('battle_win');
                } else {
                  toast.error(`⚔️ 进攻 ${npc.name} 失败，出征部队全军覆没`);
                  playSound('battle_lose');
                }

                // 生成 PVP 战报
                const report: PvpBattleReport = {
                  id: `pvp-${npc.id}-${now}`,
                  win: result.win,
                  targetId: npc.id,
                  targetName: npc.name,
                  targetTribe: npc.tribe,
                  attackerLost: result.attackerLost,
                  attackerLostByUnit: result.attackerLostByUnit,
                  defenderLost: result.defenderLost,
                  plundered: result.plundered,
                  formation: m.formation,
                  at: now,
                  side: 'attack',
                };
                setTimeout(() => {
                  useGame.setState((st) => {
                    const reports = [...st.pvpReports, report].slice(-MAX_REPORTS);
                    savePvpReports(reports, st.village.playerName || undefined);
                    return { pvpReports: reports };
                  });
                }, 0);

                // NPC 反击：战胜后有概率发起反击（从 NPC 基础兵力中抽调预备队）
                if (result.win && Math.random() < COUNTER_ATTACK_CHANCE) {
                  const counterForce = buildCounterAttackForce({ ...npc, units: npc.baseUnits });
                  const counterCount = UNIT_ORDER.reduce((s, u) => s + (counterForce[u] || 0), 0);
                  if (counterCount > 0) {
                    const marchSec = calcNpcMarchTime(npc.position);
                    const raid: MarchMission = {
                      id: `pvpRaid-${npc.id}-${now}`,
                      campId: npc.id,
                      campName: npc.name,
                      kind: 'pvpRaid',
                      units: counterForce,
                      formation: 'vanguard',
                      startAt: now,
                      arriveAt: now + marchSec * 1000,
                      status: 'marching',
                    };
                    v.marchQueue = [...v.marchQueue, raid];
                    toast.warning(`⚠️ ${npc.name} 发兵反击！${marchSec}s 后抵达`);
                  }
                }
              }
            } else if (m.kind === 'pvpRaid') {
              // NPC 反击部队抵达我方村庄 → 防御战
              const npc = v.players?.[m.campId];
              if (npc) {
                // 护盾阻挡 NPC 袭击
                if (isShielded(v)) {
                  toast.info(`🛡️ 护盾抵挡了 ${npc.name} 的袭击！`);
                  playSound('defense_win');
                } else {
                  const { wallDefense, army } = computeVillageDefense(v);
                  const raiderAtk = aggregateArmy(m.units, npc.tribe, FORMATIONS.vanguard.atkMod, FORMATIONS.vanguard.defMod);
                  const defenderDef = army.defense + wallDefense * 0.5;

                  let won = false;
                  let troopLossRate = 0;
                  if (defenderDef >= raiderAtk.attack) {
                    won = true;
                    troopLossRate = Math.min(0.5, raiderAtk.attack / (defenderDef * 2)) * 0.6;
                  } else {
                    won = false;
                    troopLossRate = Math.min(0.95, 1 - defenderDef / (raiderAtk.attack * 1.2));
                  }

                  // 分摊守军损失
                  const remainingUnits = { ...v.units };
                  const totalHp = army.hp || 1;
                  const lostByUnit: Partial<Record<UnitType, number>> = {};
                  for (const u of UNIT_ORDER) {
                    const n = remainingUnits[u] || 0;
                    if (n <= 0) continue;
                    const unitHp = (UNIT_CONFIGS[u].hp * n) || 1;
                    const share = unitHp / totalHp;
                    const lost = Math.min(n, Math.floor(n * troopLossRate * share * 2));
                    remainingUnits[u] = Math.max(0, n - lost);
                    if (lost > 0) lostByUnit[u] = lost;
                  }
                  v.units = remainingUnits;

                  // 资源掠夺（战败时，受地窖保护）
                  const crannyLv = v.buildings.cranny || 0;
                  const hideAmount = crannyLv > 0 ? BUILDING_CONFIGS.cranny.levels[crannyLv - 1].effect.hideAmount || 0 : 0;
                  const stealRate = won ? 0 : 0.25;
                  const steal = (amount: number) => Math.max(0, Math.floor((amount - hideAmount) * stealRate));
                  const stolen: ResourceCost = {
                    wood: steal(v.resources.wood),
                    clay: steal(v.resources.clay),
                    iron: steal(v.resources.iron),
                    crop: steal(v.resources.crop),
                  };
                  v.resources = {
                    wood: v.resources.wood - stolen.wood,
                    clay: v.resources.clay - stolen.clay,
                    iron: v.resources.iron - stolen.iron,
                    crop: v.resources.crop - stolen.crop,
                  };

                  v.lastPvpDefenseReport = {
                    time: now,
                    attackerName: npc.name,
                    attackerTribe: npc.tribe,
                    won,
                    attackerLost: won ? UNIT_ORDER.reduce((s, u) => s + (m.units[u] || 0), 0) : 0,
                    troopsLost: Object.values(lostByUnit).reduce((s, n) => s + (n || 0), 0),
                    troopsLostByUnit: lostByUnit,
                    resourcesStolen: stolen,
                  };

                  if (won) {
                    toast.success(`🛡️ 成功击退 ${npc.name} 的袭击！`);
                    playSound('defense_win');
                  } else {
                    toast.error(`💀 ${npc.name} 攻破村庄，掠夺了资源！`);
                    playSound('defense_lose');
                  }
                }
              }
            } else if (m.kind === 'realAttack') {
              // 跨玩家出征抵达真实玩家村庄 → 异步拉取目标并结算（服务端应用）
              // 用 id 去重，避免同一任务被重复结算
              if (!processedMissions.has(m.id)) {
                processedMissions.add(m.id);
                void resolveRealAttack(m);
              }
            }
          } else {
            stillMarching.push(m);
          }
        }
        v.marchQueue = stillMarching;
      }

      // 加速次数每日重置
      if (now >= v.accelResetAt) {
        v.accelUsedToday = 0;
        v.accelResetAt = now + ACCEL_RESET_INTERVAL_MS;
      }

      // 赛季滚动检查
      const rolledSeason = checkSeasonRoll(v.season);
      if (rolledSeason !== v.season) {
        set({ seasonEndReport: { oldSeason: v.season.number, oldPoints: v.season.points, newSeason: rolledSeason.number } });
        v.season = rolledSeason;
        toast.info(`🎉 新赛季开始：第 ${rolledSeason.number} 赛季`);
      }

      v.lastTick = now;
      v.lastSeen = now;
      saveVillage(v);
      const next = { village: v };

      // 在 set 完成后检查任务（通过 setTimeout 避免嵌套）
      setTimeout(() => {
        const wins = useGame.getState().battleReports.filter((r) => r.win).length;
        checkQuests(set, v, useGame.getState().completedQuests, wins);
      }, 0);

      return next;
    });
  },

  enqueueFieldUpgrade: (fieldType, index) => {
    const s = useGame.getState();
    const v = { ...s.village };
    const curLv = v.fields[fieldType][index];
    if (curLv >= 20) { playSound('error'); return; }
    if (getActiveFieldTaskCount(v.buildQueue) >= MAX_FIELD_QUEUE) { playSound('error'); return; }
    if (v.buildQueue.some((t) => t.target.kind === 'field' && t.target.fieldType === fieldType && t.target.index === index)) { playSound('error'); return; }

    const config = FIELD_CONFIGS[fieldType];
    const nextLv = curLv + 1;
    const cost = config.levels[nextLv - 1].cost;
    if (!canAfford(v.resources, cost)) { playSound('error'); return; }
    v.resources = deductCost(v.resources, cost);
    const baseSec = config.levels[nextLv - 1].buildTime;
    const duration = realBuildSeconds(v, baseSec) * 1000;
    const task: BuildTask = {
      id: `field-${fieldType}-${index}-${Date.now()}`,
      target: { kind: 'field', fieldType, index },
      fromLevel: curLv,
      toLevel: nextLv,
      cost,
      startAt: Date.now(),
      duration,
    };
    v.buildQueue = [...v.buildQueue, task];
    // 资源田升级加赛季积分
    v.season = { ...v.season, points: v.season.points + SEASON_POINT_RULES.fieldUpgrade };
    saveVillage(v);
    set({ village: v });
    playSound('build');
  },

  enqueueBuildingUpgrade: (building) => {
    const s = useGame.getState();
    const v = { ...s.village };
    const check = checkBuildingPrereqs(v, building);
    if (!check.ok) { playSound('error'); if (check.missing) toast.warning(check.missing); return; }
    const curLv = v.buildings[building] || 0;
    const config = BUILDING_CONFIGS[building];
    if (curLv >= config.maxLevel) { playSound('error'); toast.warning('已达最高等级'); return; }
    if (getActiveBuildingTaskCount(v.buildQueue) >= MAX_BUILDING_QUEUE) { playSound('error'); toast.warning('建造队列已满'); return; }
    if (v.buildQueue.some((t) => t.target.kind === 'building' && t.target.building === building)) { playSound('error'); toast.warning('该建筑正在升级中'); return; }

    const nextLv = curLv + 1;
    const cost = config.levels[nextLv - 1].cost;
    if (!canAfford(v.resources, cost)) { playSound('error'); toast.warning('资源不足'); return; }
    v.resources = deductCost(v.resources, cost);
    const baseSec = config.levels[nextLv - 1].buildTime;
    const duration = realBuildSeconds(v, baseSec) * 1000;
    const task: BuildTask = {
      id: `building-${building}-${Date.now()}`,
      target: { kind: 'building', building },
      fromLevel: curLv,
      toLevel: nextLv,
      cost,
      startAt: Date.now(),
      duration,
    };
    v.buildQueue = [...v.buildQueue, task];
    // 建筑升级加赛季积分
    v.season = { ...v.season, points: v.season.points + SEASON_POINT_RULES.buildingUpgrade };
    saveVillage(v);
    set({ village: v });
    playSound('build');
  },

  cancelTask: (taskId) => {
    set((s) => {
      const v = { ...s.village };
      const task = v.buildQueue.find((t) => t.id === taskId);
      if (!task) return s;
      v.resources = {
        wood: v.resources.wood + Math.floor(task.cost.wood * 0.8),
        clay: v.resources.clay + Math.floor(task.cost.clay * 0.8),
        iron: v.resources.iron + Math.floor(task.cost.iron * 0.8),
        crop: v.resources.crop + Math.floor(task.cost.crop * 0.8),
      };
      v.buildQueue = v.buildQueue.filter((t) => t.id !== taskId);
      saveVillage(v);
      return { village: v };
    });
    toast.info('已取消任务，退回 80% 资源');
  },

  accelerateTask: (taskId, secondsReduced) => {
    set((s) => {
      const v = { ...s.village };
      const task = v.buildQueue.find((t) => t.id === taskId);
      if (!task) return s;
      const newDuration = Math.max(0, task.duration - secondsReduced * 1000);
      const elapsed = Date.now() - task.startAt;
      const newTask: BuildTask = {
        ...task,
        duration: newDuration,
        startAt: newDuration >= elapsed ? task.startAt : Date.now() - newDuration,
      };
      v.buildQueue = v.buildQueue.map((t) => (t.id === taskId ? newTask : t));
      saveVillage(v);
      return { village: v };
    });
  },

  accelerateTaskByRatio: (taskId, ratio) => {
    // 反P2W：每日加速硬上限 + 纹玉消耗
    const s = useGame.getState();
    const v = { ...s.village };
    if (v.accelUsedToday >= DAILY_ACCEL_LIMIT) {
      toast.warning(`今日加速已用完（${DAILY_ACCEL_LIMIT}次/天），明日重置`);
      return;
    }
    if (v.jade < ACCEL_COST_JADE) {
      toast.warning(`纹玉不足，需要 ${ACCEL_COST_JADE} 纹玉（通过任务/赛季获得）`);
      return;
    }
    const task = v.buildQueue.find((t) => t.id === taskId);
    if (!task) return;
    v.jade -= ACCEL_COST_JADE;
    v.accelUsedToday += 1;
    const elapsed = Date.now() - task.startAt;
    const remaining = Math.max(0, task.duration - elapsed);
    const reduceMs = Math.floor(remaining * ratio);
    const newDuration = Math.max(elapsed, task.duration - reduceMs);
    const newTask: BuildTask = {
      ...task,
      duration: newDuration,
      startAt: task.startAt,
    };
    v.buildQueue = v.buildQueue.map((t) => (t.id === taskId ? newTask : t));
    saveVillage(v);
    set({ village: v });
    toast.success(`⚡ 加速 -${Math.round(ratio * 100)}%（剩 ${DAILY_ACCEL_LIMIT - v.accelUsedToday} 次/天）`);
  },

  enqueueTraining: (unit, count) => {
    const s = useGame.getState();
    const v = { ...s.village };
    const barracksLv = v.buildings.barracks || 0;
    if (barracksLv < 1) return;
    const cfg = UNIT_CONFIGS[unit];
    const totalCost: ResourceCost = {
      wood: cfg.cost.wood * count,
      clay: cfg.cost.clay * count,
      iron: cfg.cost.iron * count,
      crop: cfg.cost.crop * count,
    };
    if (!canAfford(v.resources, totalCost)) return;

    v.resources = deductCost(v.resources, totalCost);
    // 训练时间 = 单只训练时间 × 速度倍率（蚩尤部落训练速度 +20%）
    const effSec = effectiveTrainTime(v, cfg.trainTimeSec);
    const perUnitMs = Math.max(1, Math.round(effSec * SPEED_MULTIPLIER * 1000));
    const task: TrainTask = {
      id: `train-${unit}-${Date.now()}`,
      unit,
      count,
      done: 0,
      startAt: Date.now(),
      perUnitMs,
    };
    v.trainQueue = [...v.trainQueue, task];
    // 训练士兵加赛季积分
    v.season = { ...v.season, points: v.season.points + SEASON_POINT_RULES.trainUnit * count };
    saveVillage(v);
    set({ village: v });
    const u = getUnitDisplay(v.tribe, unit);
    toast.info(`开始训练 ${u.emoji} ${u.name} ×${count}`);
    playSound('train');
  },

  cancelTrainTask: (taskId) => {
    set((s) => {
      const v = { ...s.village };
      const task = v.trainQueue.find((t) => t.id === taskId);
      if (!task) return s;
      // 退还未完成部分的资源（80%）
      const remaining = task.count - task.done;
      const cfg = UNIT_CONFIGS[task.unit];
      const refund: ResourceCost = {
        wood: Math.floor(cfg.cost.wood * remaining * 0.8),
        clay: Math.floor(cfg.cost.clay * remaining * 0.8),
        iron: Math.floor(cfg.cost.iron * remaining * 0.8),
        crop: Math.floor(cfg.cost.crop * remaining * 0.8),
      };
      v.resources = {
        wood: v.resources.wood + refund.wood,
        clay: v.resources.clay + refund.clay,
        iron: v.resources.iron + refund.iron,
        crop: v.resources.crop + refund.crop,
      };
      v.trainQueue = v.trainQueue.filter((t) => t.id !== taskId);
      saveVillage(v);
      return { village: v };
    });
  },

  // 出征：创建行军任务，到达后自动战斗
  attackCamp: (campId, deployed, formation) => {
    const s = useGame.getState();
    const v = { ...s.village };
    const camp = v.camps[campId];
    if (!camp) return;
    if (camp.occupied) {
      toast.warning(`${camp.name} 已被占领，无需出征`);
      return;
    }
    const deployCount = UNIT_ORDER.reduce((sum, u) => sum + (deployed[u] || 0), 0);
    if (deployCount <= 0) return;
    for (const u of UNIT_ORDER) {
      if ((deployed[u] || 0) > (v.units[u] || 0)) return;
    }
    if (camp.raiders <= 0) {
      toast.warning(`${camp.name} 已无妖兽`);
      return;
    }

    // 扣除出征兵力
    const afterDeploy = { ...v.units };
    for (const u of UNIT_ORDER) afterDeploy[u] = (afterDeploy[u] || 0) - (deployed[u] || 0);
    v.units = afterDeploy;

    // 创建行军任务
    const marchSec = calcMarchTime(camp.position) / getMarchSpeedMultiplier(v.techLevels || {});
    const now = Date.now();
    const mission: MarchMission = {
      id: `march-${campId}-${now}`,
      campId,
      campName: camp.name,
      kind: 'attack',
      units: { ...deployed },
      formation,
      startAt: now,
      arriveAt: now + marchSec * 1000,
      status: 'marching',
    };
    v.marchQueue = [...v.marchQueue, mission];

    saveVillage(v);
    set({ village: v });
    toast.info(`🏹 出征 ${camp.name}，预计 ${marchSec}s 后到达`);
  },

  // 驻守已占领据点
  garrisonCamp: (campId, deployed) => {
    const s = useGame.getState();
    const v = { ...s.village };
    const camp = v.camps[campId];
    if (!camp || !camp.occupied) return;
    const deployCount = UNIT_ORDER.reduce((sum, u) => sum + (deployed[u] || 0), 0);
    if (deployCount <= 0) return;
    for (const u of UNIT_ORDER) {
      if ((deployed[u] || 0) > (v.units[u] || 0)) return;
    }
    // 扣除兵力（驻守兵力行军到达后计入据点）
    const afterDeploy = { ...v.units };
    for (const u of UNIT_ORDER) afterDeploy[u] = (afterDeploy[u] || 0) - (deployed[u] || 0);
    v.units = afterDeploy;

    const marchSec = calcMarchTime(camp.position) / getMarchSpeedMultiplier(v.techLevels || {});
    const now = Date.now();
    const mission: MarchMission = {
      id: `garrison-${campId}-${now}`,
      campId,
      campName: camp.name,
      kind: 'garrison',
      units: { ...deployed },
      formation: 'wings',
      startAt: now,
      arriveAt: now + marchSec * 1000,
      status: 'marching',
    };
    v.marchQueue = [...v.marchQueue, mission];
    saveVillage(v);
    set({ village: v });
    toast.info(`🏴 派兵驻守 ${camp.name}，${marchSec}s 后到达`);
  },

  // 撤回驻守兵力
  recallGarrison: (campId) => {
    const s = useGame.getState();
    const v = { ...s.village };
    const camp = v.camps[campId];
    if (!camp || !camp.occupied || !camp.garrison) return;
    const garrison = { ...camp.garrison };
    const total = UNIT_ORDER.reduce((sum, u) => sum + (garrison[u] || 0), 0);
    if (total <= 0) return;

    // 撤回行军
    const marchSec = calcMarchTime(camp.position) / getMarchSpeedMultiplier(v.techLevels || {});
    const now = Date.now();
    const mission: MarchMission = {
      id: `recall-${campId}-${now}`,
      campId,
      campName: camp.name,
      kind: 'recall',
      units: garrison,
      formation: 'wings',
      startAt: now,
      arriveAt: now + marchSec * 1000,
      status: 'marching',
    };
    // 清空据点驻守，解除占领
    v.camps = { ...v.camps, [campId]: { ...camp, garrison: {}, occupied: false } };
    v.marchQueue = [...v.marchQueue, mission];
    saveVillage(v);
    set({ village: v });
    toast.info(`↩️ 撤回 ${camp.name} 驻守兵力，${marchSec}s 后归营`);
  },

  // 侦查据点
  scoutCamp: (campId) => {
    const s = useGame.getState();
    const v = { ...s.village };
    const camp = v.camps[campId];
    if (!camp) return;
    // 斥候术降低侦查花费
    const cost = Math.round(50 * getScoutCostMultiplier(v.techLevels));
    if (v.resources.iron < cost) {
      toast.warning(`需要 ${cost} 铜矿进行侦查`);
      return;
    }
    v.resources = { ...v.resources, iron: v.resources.iron - cost };
    v.camps = { ...v.camps, [campId]: { ...camp, scouted: true, scoutedAt: Date.now() } };
    saveVillage(v);
    set({ village: v });
    toast.success(`🔍 已侦查 ${camp.name}（-${cost} 铜）`);
  },

  // PVP：出征攻击 NPC 村庄
  attackPlayer: (npcId, deployed, formation) => {
    const s = useGame.getState();
    const v = { ...s.village };
    const npc = v.players?.[npcId];
    if (!npc) return;
    // 废墟期不可攻击
    if (npc.defeatedAt && Date.now() - npc.defeatedAt < NPC_REVIVE_MS) {
      toast.warning(`${npc.name} 已被摧毁，正在重建中`);
      return;
    }
    const deployCount = UNIT_ORDER.reduce((sum, u) => sum + (deployed[u] || 0), 0);
    if (deployCount <= 0) return;
    for (const u of UNIT_ORDER) {
      if ((deployed[u] || 0) > (v.units[u] || 0)) return;
    }

    // 扣除出征兵力
    const afterDeploy = { ...v.units };
    for (const u of UNIT_ORDER) afterDeploy[u] = (afterDeploy[u] || 0) - (deployed[u] || 0);
    v.units = afterDeploy;

    const marchSec = calcMarchTime(npc.position) / getMarchSpeedMultiplier(v.techLevels || {});
    const now = Date.now();
    const mission: MarchMission = {
      id: `pvpAttack-${npcId}-${now}`,
      campId: npcId,
      campName: npc.name,
      kind: 'pvpAttack',
      units: { ...deployed },
      formation,
      startAt: now,
      arriveAt: now + marchSec * 1000,
      status: 'marching',
    };
    v.marchQueue = [...v.marchQueue, mission];
    saveVillage(v);
    set({ village: v });
    toast.info(`⚔️ 出征 ${npc.name}，预计 ${marchSec}s 后到达`);
  },

  // PVP：侦查 NPC 村庄
  scoutPlayer: (npcId) => {
    const s = useGame.getState();
    const v = { ...s.village };
    const npc = v.players?.[npcId];
    if (!npc) return;
    const cost = Math.round(80 * getScoutCostMultiplier(v.techLevels));
    if (v.resources.iron < cost) {
      toast.warning(`需要 ${cost} 铜矿进行侦查`);
      return;
    }
    v.resources = { ...v.resources, iron: v.resources.iron - cost };
    v.players = { ...v.players, [npcId]: { ...npc, scouted: true, scoutedAt: Date.now() } };
    saveVillage(v);
    set({ village: v });
    toast.success(`🔍 已侦查 ${npc.name}（-${cost} 铜）`);
  },

  dismissPvpReport: (id) => {
    set((s) => {
      const reports = s.pvpReports.filter((r) => r.id !== id);
      savePvpReports(reports, s.village.playerName || undefined);
      return { pvpReports: reports };
    });
  },

  // 跨玩家：刷新全服排行榜
  refreshLeaderboard: async () => {
    if (!isSupabaseConfigured) return;
    set({ isLeaderboardLoading: true });
    const list = await fetchLeaderboard();
    set({ leaderboard: list, isLeaderboardLoading: false });
  },

  // 跨玩家：出征真实玩家（部队先扣除，抵达后异步结算）
  attackRealPlayer: (targetName, deployed, formation) => {
    const s = useGame.getState();
    const v = { ...s.village };
    if (targetName === v.playerName) {
      toast.warning('不能攻击自己的村庄');
      return false;
    }
    const deployCount = UNIT_ORDER.reduce((sum, u) => sum + (deployed[u] || 0), 0);
    if (deployCount <= 0) {
      toast.warning('请先选择出征兵力');
      return false;
    }
    for (const u of UNIT_ORDER) {
      if ((deployed[u] || 0) > (v.units[u] || 0)) {
        toast.warning('出征兵力超过现有兵力');
        return false;
      }
    }
    // 扣除出征兵力
    const afterDeploy = { ...v.units };
    for (const u of UNIT_ORDER) afterDeploy[u] = (afterDeploy[u] || 0) - (deployed[u] || 0);
    v.units = afterDeploy;

    const marchSec = 25;
    const now = Date.now();
    const mission: MarchMission = {
      id: `realAttack-${targetName}-${now}`,
      campId: targetName,
      campName: targetName,
      kind: 'realAttack',
      units: { ...deployed },
      formation,
      startAt: now,
      arriveAt: now + marchSec * 1000,
      status: 'marching',
    };
    v.marchQueue = [...v.marchQueue, mission];
    saveVillage(v);
    set({ village: v });
    toast.info(`⚔️ 出征 ${targetName}，预计 ${marchSec}s 后到达`);
    return true;
  },

  // 跨玩家：标记全部来袭战报已读
  markAllIncomingSeen: () => {
    set((s) => {
      const list = (s.village.incomingAttacks || []);
      if (!list.some((a) => !a.seen)) return {};
      const v = { ...s.village, incomingAttacks: list.map((a) => (a.seen ? a : { ...a, seen: true })) };
      saveVillage(v);
      return { village: v };
    });
  },

  // 开始研发科技
  startResearch: (tech) => {
    const s = useGame.getState();
    const v = { ...s.village };
    const cfg = TECH_CONFIGS[tech];
    const currentLevel = v.techLevels[tech] || 0;
    const nextLevel = currentLevel + 1;

    if (v.researchQueue.length > 0) {
      toast.warning('灵台已有研发进行中');
      return;
    }
    if (currentLevel >= cfg.maxLevel) {
      toast.warning(`${cfg.name} 已满级`);
      return;
    }
    // 灵台等级要求
    const academy = v.buildings.academy || 0;
    if (academy < cfg.academyReq(nextLevel)) {
      toast.warning(`需要灵台 Lv${cfg.academyReq(nextLevel)}`);
      return;
    }
    const cost = cfg.cost(nextLevel);
    if (v.resources.wood < cost.wood || v.resources.clay < cost.clay || v.resources.iron < cost.iron || v.resources.crop < cost.crop) {
      toast.warning('资源不足');
      return;
    }
    v.resources = {
      wood: v.resources.wood - cost.wood,
      clay: v.resources.clay - cost.clay,
      iron: v.resources.iron - cost.iron,
      crop: v.resources.crop - cost.crop,
    };
    const task: ResearchTask = {
      id: `res_${tech}_${Date.now()}`,
      tech,
      level: nextLevel,
      startAt: Date.now(),
      duration: Math.round(cfg.duration(nextLevel) * 1000 / SPEED_MULTIPLIER),
    };
    v.researchQueue = [task];
    saveVillage(v);
    set({ village: v });
    toast.success(`📚 开始研发 ${cfg.name} Lv${nextLevel}`);
  },

  // 取消研发（不退款）
  cancelResearch: () => {
    const s = useGame.getState();
    const v = { ...s.village };
    if (v.researchQueue.length === 0) return;
    v.researchQueue = [];
    saveVillage(v);
    set({ village: v });
    toast.info('已取消研发');
  },

  // 集市资源交易
  tradeResources: (from, to, amount) => {
    const s = useGame.getState();
    const v = { ...s.village };
    if (from === to) return false;
    const maxTrade = getMarketMaxTrade(v);
    if (maxTrade <= 0) {
      toast.warning('请先建造集市');
      return false;
    }
    if (amount > maxTrade) {
      toast.warning(`单笔最多交易 ${maxTrade}`);
      return false;
    }
    if (v.resources[from] < amount) {
      toast.warning('资源不足');
      return false;
    }
    const taxRate = getMarketTaxRate(v);
    const receive = Math.floor(amount * (1 - taxRate));
    v.resources = {
      ...v.resources,
      [from]: v.resources[from] - amount,
      [to]: v.resources[to] + receive,
    };
    saveVillage(v);
    set({ village: v });
    toast.success(`交易完成：-${amount} ${RESOURCE_LABEL[from]} → +${receive} ${RESOURCE_LABEL[to]}`);
    playSound('coin');
    return true;
  },

  // 购买外观（消耗纹玉，仅外观不影响数值 —— 反P2W）
  purchaseCosmetic: (id) => {
    const s = useGame.getState();
    const v = { ...s.village };
    const cosmetic = getCosmetic(id);
    if (!cosmetic) return;
    if (v.cosmetics.includes(id)) {
      toast.warning('已拥有该外观');
      return;
    }
    if (v.jade < cosmetic.price) {
      toast.warning(`纹玉不足，需要 ${cosmetic.price} 纹玉`);
      return;
    }
    v.jade -= cosmetic.price;
    v.cosmetics = [...v.cosmetics, id];
    saveVillage(v);
    set({ village: v });
    toast.success(`✨ 已获得 ${cosmetic.name}`);
  },

  // 装备外观（按分类装备）
  equipCosmetic: (id) => {
    const s = useGame.getState();
    const v = { ...s.village };
    if (id && !v.cosmetics.includes(id)) return;
    const cosmetic = getCosmetic(id);
    if (!cosmetic) return;
    v.equippedCosmetics = { ...v.equippedCosmetics, [cosmetic.category]: id };
    saveVillage(v);
    set({ village: v });
  },

  // 获得纹玉（通过游戏行为：任务、赛季、签到等）
  addJade: (amount, reason) => {
    const s = useGame.getState();
    const v = { ...s.village };
    v.jade += amount;
    saveVillage(v);
    set({ village: v });
    if (amount > 0) toast.success(`💎 获得 ${amount} 纹玉（${reason}）`);
  },

  dismissBattleReport: (id) => {
    set((s) => {
      const reports = s.battleReports.filter((r) => `${r.campId}-${r.at}` !== id);
      saveBattleReports(reports, s.village.playerName || undefined);
      return { battleReports: reports };
    });
  },

  checkOfflineEarnings: () => {
    const s = useGame.getState();
    const v = { ...s.village };
    const now = Date.now();
    const offlineMs = now - (v.lastSeen || now);

    if (offlineMs < OFFLINE_THRESHOLD_MS) return;

    // 计算离线期间资源产出（限上限）
    const effectiveMs = Math.min(offlineMs, OFFLINE_CAP_MS);
    const dt = effectiveMs / 1000;
    const prod = computeProduction(v);
    const cap = computeCapacity(v);

    // 起始资源 = 当前（已扣到上限的）
    // 离线累积：按生产率 × 时间，但不超过容量
    const gathered: ResourceCost = {
      wood: Math.min(cap.wood, prod.wood / 3600 * dt),
      clay: Math.min(cap.clay, prod.clay / 3600 * dt),
      iron: Math.min(cap.iron, prod.iron / 3600 * dt),
      crop: Math.min(cap.crop, prod.crop / 3600 * dt),
    };

    // 实际能添加的（不超过容量 - 当前）
    const actualAdd: ResourceCost = {
      wood: Math.max(0, Math.min(gathered.wood, cap.wood - v.resources.wood)),
      clay: Math.max(0, Math.min(gathered.clay, cap.clay - v.resources.clay)),
      iron: Math.max(0, Math.min(gathered.iron, cap.iron - v.resources.iron)),
      crop: Math.max(0, Math.min(gathered.crop, cap.crop - v.resources.crop)),
    };

    v.resources = {
      wood: v.resources.wood + actualAdd.wood,
      clay: v.resources.clay + actualAdd.clay,
      iron: v.resources.iron + actualAdd.iron,
      crop: v.resources.crop + actualAdd.crop,
    };

    // 巡逻队事件：有士兵且离线超过 1 分钟才触发
    let patrolEvent: { raidersRepelled: number; cropSaved: number } | null = null;
    const totalArmy = UNIT_ORDER.reduce((s, u) => s + (v.units[u] || 0), 0);
    if (totalArmy > 0 && offlineMs > 60 * 1000) {
      // 简化：每 50 兵击退 1 只妖兽，最多 5 只
      const repelled = Math.min(5, Math.floor(totalArmy / 50) + 1);
      const saved = repelled * 30;
      patrolEvent = { raidersRepelled: repelled, cropSaved: saved };
      v.resources.crop = Math.min(cap.crop, v.resources.crop + saved);
    }

    v.lastTick = now;
    v.lastSeen = now;
    saveVillage(v);

    const report: OfflineReport = {
      offlineSeconds: Math.floor(offlineMs / 1000),
      gatheredResources: actualAdd,
      patrolEvent,
      at: now,
    };

    set({ village: v, offlineReport: report });
  },

  dismissOfflineReport: () => {
    set({ offlineReport: null });
  },

  dismissSeasonEnd: () => {
    set({ seasonEndReport: null });
  },

  claimSeasonMilestone: (points) => {
    const s = useGame.getState();
    const v = { ...s.village };
    const milestone = SEASON_MILESTONES_BY_POINTS[points];
    if (!milestone) return;
    if (v.season.points < milestone.points) return;
    if (v.season.claimedMilestones.includes(milestone.points)) return;

    v.resources = {
      wood: v.resources.wood + milestone.reward.wood,
      clay: v.resources.clay + milestone.reward.clay,
      iron: v.resources.iron + milestone.reward.iron,
      crop: v.resources.crop + milestone.reward.crop,
    };
    v.jade += milestone.jade;
    v.season = {
      ...v.season,
      claimedMilestones: [...v.season.claimedMilestones, milestone.points],
    };
    saveVillage(v);
    set({ village: v });
    toast.success(`🎁 领取里程碑奖励：${milestone.title}（+${milestone.jade}💎）`);
  },

  activateShield: (hours, jadeCost) => {
    const s = useGame.getState();
    const v = { ...s.village };
    const check = canActivateShield(v);
    if (!check.ok) { playSound('error'); if (check.reason) toast.warning(check.reason); return; }
    if (v.jade < jadeCost) { playSound('error'); toast.warning(`纹玉不足，需要 ${jadeCost} 纹玉`); return; }

    v.jade -= jadeCost;
    const cur = v.shield;
    v.shield = createActiveShield(hours, cur?.cooldownUntil || 0);
    saveVillage(v);
    set({ village: v });
    playSound('build_complete');
    toast.success(`🛡️ 护盾已激活（${hours}小时），期间不受攻击`);
  },

  reset: () => {
    const fresh = createInitialVillage();
    const name = useGame.getState().village.playerName;
    fresh.playerName = name;
    saveVillage(fresh);
    saveCompletedQuests([], name || undefined);
    set({ village: fresh, completedQuests: [], battleReports: [], pvpReports: [], offlineReport: null });
    toast.info('已重置存档，请重新选择部落');
  },
}));

// 调试入口：方便测试时在控制台访问 store
if (typeof window !== 'undefined') {
  (window as any).__game = useGame;
}

function applyCompletion(v: VillageState, target: BuildTarget, toLevel: number) {
  if (target.kind === 'field') {
    v.fields = { ...v.fields };
    v.fields[target.fieldType] = [...v.fields[target.fieldType]];
    v.fields[target.fieldType][target.index] = toLevel;
  } else {
    v.buildings = { ...v.buildings, [target.building]: toLevel };
  }
}

function getTaskName(task: BuildTask): string {
  if (task.target.kind === 'field') {
    const cfg = FIELD_CONFIGS[task.target.fieldType];
    return `${cfg.emoji} ${cfg.name} #${task.target.index + 1}`;
  }
  const cfg = BUILDING_CONFIGS[task.target.building];
  return `${cfg.emoji} ${cfg.name}`;
}

// ============== 存档 ==============

function loadVillage(playerName?: string): VillageState {
  try {
    // 如果指定了玩家名，从对应存档槽加载；否则尝试旧版全局存档或新建
    const saveKey = playerName ? getSaveKey(playerName) : STORAGE_KEY;
    const raw = localStorage.getItem(saveKey);
    if (raw) {
      const parsed = JSON.parse(raw) as VillageState;
      parsed.playerName = playerName || parsed.playerName || '';
      parsed.lastTick = Date.now();
      parsed.buildQueue = parsed.buildQueue || [];
      parsed.trainQueue = parsed.trainQueue || [];
      // 迁移旧存档：{ legionnaire: N } → 多兵种格式
      const oldUnits = parsed.units as Record<string, number>;
      parsed.units = {
        warrior: oldUnits?.warrior ?? oldUnits?.legionnaire ?? 0,
        archer: oldUnits?.archer ?? 0,
        cavalry: oldUnits?.cavalry ?? 0,
        guard: oldUnits?.guard ?? 0,
      };
      // 迁移旧据点：补充 raiderType/occupied/scouted/kind 字段，补全新据点
      const migratedCamps: VillageState['camps'] = {};
      for (const [id, c] of Object.entries(parsed.camps || {})) {
        migratedCamps[id] = {
          ...c,
          raiderType: c.raiderType || 'demon',
          occupied: c.occupied || false,
          scouted: c.scouted || false,
          kind: c.kind || 'normal',
          clearCount: c.clearCount || 0,
        };
      }
      // 补全新增据点（资源矿点/世界Boss/秘境）
      const freshCamps = createInitialVillage().camps;
      for (const [id, c] of Object.entries(freshCamps)) {
        if (!migratedCamps[id]) migratedCamps[id] = c;
      }
      parsed.camps = migratedCamps;
      parsed.marchQueue = parsed.marchQueue || [];
      parsed.techLevels = parsed.techLevels ?? {};
      parsed.researchQueue = parsed.researchQueue ?? [];
      parsed.nextInvasionAt = parsed.nextInvasionAt ?? (Date.now() + 5 * 60 * 1000);
      parsed.jade = parsed.jade ?? 0;
      parsed.accelUsedToday = parsed.accelUsedToday ?? 0;
      parsed.accelResetAt = parsed.accelResetAt ?? (Date.now() + 24 * 60 * 60 * 1000);
      parsed.cosmetics = parsed.cosmetics ?? ['banner_default', 'theme_default', 'frame_default'];
      parsed.equippedCosmetics = parsed.equippedCosmetics ?? { banner: 'banner_default', theme: 'theme_default', frame: 'frame_default' };
      parsed.camps = parsed.camps && Object.keys(parsed.camps).length > 0
        ? parsed.camps
        : createInitialVillage().camps;
      // 迁移：旧存档无 NPC 村庄
      parsed.players = parsed.players && Object.keys(parsed.players).length > 0
        ? parsed.players
        : createInitialVillage().players;
      parsed.season = parsed.season || createInitialVillage().season;
      // 护盾迁移：旧存档无 shield，新手给 7 天保护，老存档给 1 天保护
      if (!parsed.shield) {
        parsed.shield = { type: 'newbie', expiresAt: Date.now() + 24 * 60 * 60 * 1000, cooldownUntil: 0 };
      }
      parsed.lastSeen = parsed.lastSeen || Date.now();
      // 部落字段迁移：旧存档无 tribe，默认为黄帝部落
      parsed.tribe = parsed.tribe || 'huang';
      return parsed;
    }
  } catch (e) {
    console.error('存档读取失败', e);
  }
  // 未找到存档：返回带玩家名的新存档
  const fresh = createInitialVillage();
  if (playerName) fresh.playerName = playerName;
  return fresh;
}

function saveVillage(v: VillageState) {
  saveVillageLocal(v);
  // 同步到 Supabase（debounce 5 秒）
  if (isSupabaseConfigured) uploadVillage(v);
}

// 只写本地（用于远端推送来的数据，避免回环）
function saveVillageLocal(v: VillageState) {
  try {
    const key = v.playerName ? getSaveKey(v.playerName) : STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(v));
  } catch (e) {
    console.error('存档失败', e);
  }
}

const QUESTS_KEY = 'travian-mvp-quests-v1';
const BATTLE_REPORTS_KEY = 'travian-mvp-battle-reports-v1';
const PVP_REPORTS_KEY = 'travian-mvp-pvp-reports-v1';
const MAX_REPORTS = 50;

function loadBattleReports(playerName?: string): BattleReport[] {
  try {
    const key = playerName ? `${BATTLE_REPORTS_KEY}-${playerName}` : BATTLE_REPORTS_KEY;
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return [];
}
function saveBattleReports(reports: BattleReport[], playerName?: string) {
  try {
    const key = playerName ? `${BATTLE_REPORTS_KEY}-${playerName}` : BATTLE_REPORTS_KEY;
    localStorage.setItem(key, JSON.stringify(reports));
  } catch (e) { /* ignore */ }
}
function loadPvpReports(playerName?: string): PvpBattleReport[] {
  try {
    const key = playerName ? `${PVP_REPORTS_KEY}-${playerName}` : PVP_REPORTS_KEY;
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return [];
}
function savePvpReports(reports: PvpBattleReport[], playerName?: string) {
  try {
    const key = playerName ? `${PVP_REPORTS_KEY}-${playerName}` : PVP_REPORTS_KEY;
    localStorage.setItem(key, JSON.stringify(reports));
  } catch (e) { /* ignore */ }
}
function loadCompletedQuests(playerName?: string): string[] {
  try {
    const key = playerName ? `${QUESTS_KEY}-${playerName}` : QUESTS_KEY;
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return [];
}
function saveCompletedQuests(q: string[], playerName?: string) {
  try {
    const key = playerName ? `${QUESTS_KEY}-${playerName}` : QUESTS_KEY;
    localStorage.setItem(key, JSON.stringify(q));
  } catch (e) {
    console.error(e);
  }
}

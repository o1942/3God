import type { FormationType, RaiderType, ResourceCost, TribeType, UnitType } from './types';

// ============ 兵种配置 ============

export type UnitConfig = {
  id: UnitType;
  name: string;          // 通用名
  emoji: string;
  attack: number;
  defense: number;
  hp: number;
  cost: ResourceCost;
  trainTimeSec: number;  // 标准速度秒
  upkeepCrop: number;    // 每小时粟米消耗
  requireBarracksLv: number; // 军帐等级
  // 其他前置建筑
  prerequisites?: { building: string; level: number }[];
  description: string;
  role: string;          // 定位标签
};

export const UNIT_CONFIGS: Record<UnitType, UnitConfig> = {
  warrior: {
    id: 'warrior',
    name: '部落战士',
    emoji: '🗡️',
    attack: 40,
    defense: 35,
    hp: 100,
    cost: { wood: 120, clay: 100, iron: 150, crop: 60 },
    trainTimeSec: 200,
    upkeepCrop: 1,
    requireBarracksLv: 1,
    description: '部落基础步兵，攻防均衡，是军队的中坚力量。',
    role: '均衡',
  },
  archer: {
    id: 'archer',
    name: '神射手',
    emoji: '🏹',
    attack: 55,
    defense: 15,
    hp: 70,
    cost: { wood: 100, clay: 80, iron: 200, crop: 70 },
    trainTimeSec: 250,
    upkeepCrop: 1,
    requireBarracksLv: 1,
    prerequisites: [{ building: 'academy', level: 1 }],
    description: '百步穿杨的弓箭手，攻击力出众但近身脆弱。',
    role: '高攻',
  },
  cavalry: {
    id: 'cavalry',
    name: '铁骑',
    emoji: '🐎',
    attack: 65,
    defense: 30,
    hp: 120,
    cost: { wood: 200, clay: 150, iron: 250, crop: 150 },
    trainTimeSec: 400,
    upkeepCrop: 2,
    requireBarracksLv: 1,
    prerequisites: [
      { building: 'stable', level: 1 },
      { building: 'academy', level: 5 },
    ],
    description: '冲锋陷阵的骑兵，攻高血厚，训练昂贵。',
    role: '突击',
  },
  guard: {
    id: 'guard',
    name: '重装甲士',
    emoji: '🛡️',
    attack: 25,
    defense: 60,
    hp: 160,
    cost: { wood: 150, clay: 180, iron: 300, crop: 100 },
    trainTimeSec: 350,
    upkeepCrop: 2,
    requireBarracksLv: 1,
    prerequisites: [{ building: 'smithy', level: 3 }],
    description: '身披重甲的精锐步兵，防御极高，是难以撼动的壁垒。',
    role: '坦克',
  },
};

export const UNIT_ORDER: UnitType[] = ['warrior', 'archer', 'cavalry', 'guard'];

// ============ 兵种克制系统 ============
// 循环克制：战士(枪) → 骑兵 → 弓兵 → 战士(枪)
// 重甲(guard) 无克制关系，作为平衡单位
export const COUNTER_BONUS = 0.5; // 克制时造成 +50% 伤害

// 每个兵种克制的目标兵种
export const UNIT_COUNTERS: Record<UnitType, UnitType | null> = {
  warrior: 'cavalry',   // 战士克骑兵
  cavalry: 'archer',    // 骑兵克弓兵
  archer: 'warrior',    // 弓兵克战士
  guard: null,          // 重甲无克制
};

// 被谁克制（反向查询）
export function getCounteredBy(unit: UnitType): UnitType | null {
  for (const [attacker, target] of Object.entries(UNIT_COUNTERS)) {
    if (target === unit) return attacker as UnitType;
  }
  return null;
}

// 克制关系描述
export const COUNTER_DESCRIPTIONS: Record<UnitType, string> = {
  warrior: '战士克制骑兵，被弓兵克制',
  archer: '弓兵克制战士，被骑兵克制',
  cavalry: '骑兵克制弓兵，被战士克制',
  guard: '重甲无克制关系',
};

// 部落专属兵种命名与描述
const TRIBE_UNIT_NAMES: Record<TribeType, Partial<Record<UnitType, { name: string; emoji: string; description: string }>>> = {
  yan: {
    warrior: { name: '神农卫士', emoji: '🛡️', description: '炎帝部落的农耕勇士，持耒耜化戈，防御坚实。' },
    archer: { name: '炎帝弓手', emoji: '🏹', description: '炎帝部落的猎手，善射且耐战，防御出众。' },
    cavalry: { name: '炎帝骑从', emoji: '🐎', description: '炎帝部落的轻骑兵，稳健耐战，防御坚实。' },
    guard: { name: '神农重甲', emoji: '🛡️', description: '炎帝部落的重装步兵，身披重甲，血厚防高。' },
  },
  huang: {
    warrior: { name: '轩辕甲士', emoji: '🗡️', description: '黄帝部落的精锐甲士，身披玄甲、手持玉戈，攻守兼备。' },
    archer: { name: '轩辕射手', emoji: '🏹', description: '黄帝部落的精准射手，工艺加持，攻击力出众。' },
    cavalry: { name: '轩辕铁骑', emoji: '🐎', description: '黄帝部落的精锐骑兵，攻防均衡，进退有度。' },
    guard: { name: '轩辕近卫', emoji: '🛡️', description: '黄帝部落的近卫步兵，防御精湛，守护王庭。' },
  },
  chi: {
    warrior: { name: '蚩尤狂战', emoji: '🔱', description: '蚩尤部落的狂战士，铜头铁额、以一当十，攻势凌厉。' },
    archer: { name: '蚩尤强弓', emoji: '🏹', description: '蚩尤部落的强弓手，体魄强健，生命力顽强。' },
    cavalry: { name: '蚩尤骁骑', emoji: '🐎', description: '蚩尤部落的骁勇骑兵，悍不畏死，血厚耐战。' },
    guard: { name: '蚩尤铜甲', emoji: '🛡️', description: '蚩尤部落的铜甲步兵，铜头铁额，坚不可摧。' },
  },
};

// 部落对各兵种的属性微调（倍率，1 为不变）
// 炎帝：防御/韧性型（农耕民族更耐战）
// 黄帝：均衡/工艺型（攻防兼备，弓手略强）
// 蚩尤：嗜血坚韧（已有全局攻+25%，侧重补 HP/防御）
export type UnitModifier = { atk: number; def: number; hp: number };
export const TRIBE_UNIT_MODIFIERS: Record<TribeType, Partial<Record<UnitType, UnitModifier>>> = {
  yan: {
    archer:  { atk: 0.95, def: 1.20, hp: 1.00 },
    cavalry: { atk: 0.95, def: 1.15, hp: 1.00 },
    guard:   { atk: 1.00, def: 1.05, hp: 1.15 },
  },
  huang: {
    archer:  { atk: 1.10, def: 1.00, hp: 1.00 },
    cavalry: { atk: 1.05, def: 1.05, hp: 1.00 },
    guard:   { atk: 1.00, def: 1.10, hp: 1.05 },
  },
  chi: {
    archer:  { atk: 1.00, def: 1.00, hp: 1.20 },
    cavalry: { atk: 1.00, def: 1.05, hp: 1.15 },
    guard:   { atk: 1.00, def: 1.10, hp: 1.10 },
  },
};

// 获取部落修正后的兵种属性
export function getUnitStats(tribe: TribeType, unit: UnitType): { attack: number; defense: number; hp: number } {
  const base = UNIT_CONFIGS[unit];
  const mod = TRIBE_UNIT_MODIFIERS[tribe]?.[unit];
  return {
    attack: Math.round(base.attack * (mod?.atk || 1)),
    defense: Math.round(base.defense * (mod?.def || 1)),
    hp: Math.round(base.hp * (mod?.hp || 1)),
  };
}

export function getUnitDisplay(tribe: TribeType, unit: UnitType): { name: string; emoji: string; description: string } {
  const base = UNIT_CONFIGS[unit];
  const tribeOverride = TRIBE_UNIT_NAMES[tribe]?.[unit];
  return {
    name: tribeOverride?.name || base.name,
    emoji: tribeOverride?.emoji || base.emoji,
    description: tribeOverride?.description || base.description,
  };
}

// ============ 妖兽类型 ============

export type RaiderConfig = {
  type: RaiderType;
  name: string;
  emoji: string;
  attack: number;
  defense: number;
  hp: number;
  lore: string;
};

export const RAIDER_CONFIGS: Record<RaiderType, RaiderConfig> = {
  demon: { type: 'demon', name: '妖兽', emoji: '👹', attack: 30, defense: 25, hp: 80, lore: '山林间的低级妖兽，成群出没。' },
  mountainSpirit: { type: 'mountainSpirit', name: '山精', emoji: '👺', attack: 25, defense: 40, hp: 90, lore: '深山的精怪，皮糙肉厚，防御出众。' },
  wolf: { type: 'wolf', name: '妖狼', emoji: '🐺', attack: 40, defense: 15, hp: 70, lore: '迅捷的妖狼，攻击凌厉但脆弱。' },
  serpent: { type: 'serpent', name: '巨蟒', emoji: '🐍', attack: 45, defense: 20, hp: 110, lore: '体型庞大的巨蟒，血厚攻高。' },
  demonKing: { type: 'demonKing', name: '妖王', emoji: '😈', attack: 55, defense: 45, hp: 150, lore: '一方妖王，实力强横，麾下妖兽无数。' },
};

// 兼容旧代码
export const RAIDER_CONFIG = RAIDER_CONFIGS.demon;

export function getRaiderConfig(type: RaiderType): RaiderConfig {
  return RAIDER_CONFIGS[type];
}

// ============ 妖兽据点模板 ============

export type CampTemplate = {
  name: string;
  raiderType: RaiderType;
  difficulty: 'small' | 'medium' | 'large';
  maxRaiders: number;
  reward: ResourceCost;
  garrisonYield: ResourceCost; // 占领后每小时产出
};

export const CAMP_TEMPLATES: CampTemplate[] = [
  { name: '妖兽巢穴', raiderType: 'demon', difficulty: 'small', maxRaiders: 8, reward: { wood: 200, clay: 200, iron: 200, crop: 200 }, garrisonYield: { wood: 30, clay: 30, iron: 30, crop: 30 } },
  { name: '妖狼谷', raiderType: 'wolf', difficulty: 'small', maxRaiders: 10, reward: { wood: 250, clay: 200, iron: 300, crop: 250 }, garrisonYield: { wood: 40, clay: 30, iron: 50, crop: 40 } },
  { name: '山精洞窟', raiderType: 'mountainSpirit', difficulty: 'medium', maxRaiders: 20, reward: { wood: 500, clay: 500, iron: 500, crop: 500 }, garrisonYield: { wood: 80, clay: 80, iron: 80, crop: 80 } },
  { name: '巨蟒沼泽', raiderType: 'serpent', difficulty: 'medium', maxRaiders: 18, reward: { wood: 450, clay: 600, iron: 550, crop: 700 }, garrisonYield: { wood: 70, clay: 100, iron: 90, crop: 120 } },
  { name: '妖王殿', raiderType: 'demonKing', difficulty: 'large', maxRaiders: 50, reward: { wood: 1500, clay: 1500, iron: 1500, crop: 1500 }, garrisonYield: { wood: 250, clay: 250, iron: 250, crop: 250 } },
  // 新增据点
  { name: '幽狼荒原', raiderType: 'wolf', difficulty: 'small', maxRaiders: 15, reward: { wood: 300, clay: 250, iron: 350, crop: 300 }, garrisonYield: { wood: 50, clay: 40, iron: 60, crop: 50 } },
  { name: '蛇窟深穴', raiderType: 'serpent', difficulty: 'medium', maxRaiders: 25, reward: { wood: 600, clay: 700, iron: 650, crop: 800 }, garrisonYield: { wood: 90, clay: 120, iron: 100, crop: 140 } },
  { name: '蛮荒妖窟', raiderType: 'demon', difficulty: 'medium', maxRaiders: 30, reward: { wood: 700, clay: 700, iron: 700, crop: 700 }, garrisonYield: { wood: 100, clay: 100, iron: 100, crop: 100 } },
];

// 据点网格坐标（0..9），距我方部落远近决定行军时长
export const CAMP_POSITIONS: Record<string, { x: number; y: number }> = {
  camp_1: { x: 6, y: 4 },   // 妖兽巢穴：近（新手）
  camp_2: { x: 7, y: 6 },   // 妖狼谷
  camp_3: { x: 3, y: 3 },   // 山精洞窟
  camp_4: { x: 8, y: 8 },   // 巨蟒沼泽
  camp_5: { x: 9, y: 9 },   // 妖王殿：最远
  camp_6: { x: 2, y: 5 },   // 幽狼荒原
  camp_7: { x: 5, y: 1 },   // 蛇窟深穴
  camp_8: { x: 1, y: 8 },   // 蛮荒妖窟
};

// 资源矿点：占领后持续产出单一资源
export const RESOURCE_NODE_TEMPLATES = [
  { id: 'res_wood', name: '灵木林', resourceType: 'wood' as const, maxRaiders: 12, raiderType: 'mountainSpirit' as RaiderType, reward: { wood: 400, clay: 100, iron: 100, crop: 100 }, garrisonYield: { wood: 120, clay: 0, iron: 0, crop: 0 } },
  { id: 'res_clay', name: '陶土丘', resourceType: 'clay' as const, maxRaiders: 12, raiderType: 'mountainSpirit' as RaiderType, reward: { wood: 100, clay: 400, iron: 100, crop: 100 }, garrisonYield: { wood: 0, clay: 120, iron: 0, crop: 0 } },
  { id: 'res_iron', name: '铜矿山', resourceType: 'iron' as const, maxRaiders: 15, raiderType: 'wolf' as RaiderType, reward: { wood: 100, clay: 100, iron: 400, crop: 100 }, garrisonYield: { wood: 0, clay: 0, iron: 120, crop: 0 } },
  { id: 'res_crop', name: '灵粟田', resourceType: 'crop' as const, maxRaiders: 10, raiderType: 'demon' as RaiderType, reward: { wood: 100, clay: 100, iron: 100, crop: 400 }, garrisonYield: { wood: 0, clay: 0, iron: 0, crop: 120 } },
];

export const RESOURCE_NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  res_wood: { x: 8, y: 5 },
  res_clay: { x: 1, y: 2 },
  res_iron: { x: 7, y: 4 },
  res_crop: { x: 4, y: 8 },
};

// 世界Boss：洪荒巨兽
export const WORLD_BOSS_CONFIG = {
  name: '洪荒巨兽',
  raiderType: 'demonKing' as RaiderType,
  bossMaxHp: 5000,       // 总血量
  bossMaxRaiders: 200,   // 显示妖兽数
  reward: { wood: 3000, clay: 3000, iron: 3000, crop: 3000 },
  garrisonYield: { wood: 500, clay: 500, iron: 500, crop: 500 },
  respawnMs: 30 * 60 * 1000,   // 30 分钟刷新
  activeDurationMs: 15 * 60 * 1000,  // 活跃 15 分钟
  position: { x: 5, y: 0 },
};

// 秘境：限时高难本
export const REALM_CONFIG = {
  name: '洪荒秘境',
  raiderType: 'demonKing' as RaiderType,
  maxRaiders: 80,
  reward: { wood: 5000, clay: 5000, iron: 5000, crop: 5000 },
  garrisonYield: { wood: 400, clay: 400, iron: 400, crop: 400 },
  spawnMs: 2 * 60 * 60 * 1000,    // 2 小时刷新一次
  activeDurationMs: 30 * 60 * 1000, // 活跃 30 分钟
  position: { x: 0, y: 9 },
};

// 大地图尺寸：10×10 网格，坐标为整数 0..9（列 x 从左到右，行 y 从上到下）
export const GRID_SIZE = 10;

// 我方部落位置（地图中枢）
export const VILLAGE_POSITION = { x: 5, y: 5 };

// 根据据点与村庄的网格坐标距离计算行军时间（秒）
// 单格距离约 7 秒，基础 3 秒；最远处（约 6.4 格）≈ 48 秒
export function calcMarchTime(campPos: { x: number; y: number }): number {
  const dx = campPos.x - VILLAGE_POSITION.x;
  const dy = campPos.y - VILLAGE_POSITION.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Math.max(6, Math.round(3 + dist * 7));
}

// ============ 阵型 ============

export type FormationConfig = {
  id: FormationType;
  name: string;
  emoji: string;
  atkMod: number;   // 攻击倍率
  defMod: number;   // 防御倍率
  desc: string;
};

export const FORMATIONS: Record<FormationType, FormationConfig> = {
  vanguard: { id: 'vanguard', name: '锋矢阵', emoji: '➹', atkMod: 1.20, defMod: 0.90, desc: '前锋突击，攻 +20% / 防 -10%' },
  shield:   { id: 'shield',   name: '方圆阵', emoji: '⬢', atkMod: 0.90, defMod: 1.25, desc: '结阵自守，攻 -10% / 防 +25%' },
  wings:    { id: 'wings',    name: '鹤翼阵', emoji: '⋈', atkMod: 1.10, defMod: 1.10, desc: '左右包抄，攻 +10% / 防 +10%' },
  cone:     { id: 'cone',     name: '锥形阵', emoji: '▲', atkMod: 1.30, defMod: 0.80, desc: '全力突击，攻 +30% / 防 -20%' },
};

export const FORMATION_ORDER: FormationType[] = ['vanguard', 'shield', 'wings', 'cone'];

// ============ 混合部队战斗模拟 ============

// 一支军队的聚合属性
export type ArmyPower = {
  count: number;
  attack: number;   // 总攻击
  defense: number;  // 总防御
  hp: number;       // 总血量
  units: Partial<Record<UnitType, number>>; // 各兵种数量
};

// 计算一支军队的聚合战力（应用部落兵种修正 + 阵型/全局倍率）
export function aggregateArmy(
  units: Partial<Record<UnitType, number>>,
  tribe: TribeType,
  atkMultiplier = 1,
  defMultiplier = 1,
): ArmyPower {
  let count = 0, attack = 0, defense = 0, hp = 0;
  const out: Partial<Record<UnitType, number>> = {};
  for (const u of UNIT_ORDER) {
    const n = units[u] || 0;
    if (n <= 0) continue;
    const stats = getUnitStats(tribe, u);
    count += n;
    attack += n * stats.attack * atkMultiplier;
    defense += n * stats.defense * defMultiplier;
    hp += n * stats.hp;
    out[u] = n;
  }
  return { count, attack, defense, hp, units: out };
}

// 妖兽聚合
export function aggregateRaiders(count: number, raiderType: RaiderType = 'demon'): ArmyPower {
  const cfg = RAIDER_CONFIGS[raiderType];
  return {
    count,
    attack: count * cfg.attack,
    defense: count * cfg.defense,
    hp: count * cfg.hp,
    units: {},
  };
}

export type BattleResult = {
  attackerWin: boolean;
  attackerLost: number;
  attackerLostByUnit: Partial<Record<UnitType, number>>;
  defenderLost: number;
};

// 计算克制倍率：攻击方部队对防御方部队的克制加成
// 原理：攻击方每个兵种若克制防御方某兵种，则该部分攻击力获得加成
// 加成幅度 = 克制兵种在防御方中的占比 × COUNTER_BONUS
export function computeCounterMultiplier(
  attackerUnits: Partial<Record<UnitType, number>>,
  defenderUnits: Partial<Record<UnitType, number>>,
  attackerTribe: TribeType,
): number {
  let totalAttack = 0;
  let effectiveAttack = 0;
  const totalDefender = Object.values(defenderUnits).reduce((s, n) => s + (n || 0), 0);

  for (const u of UNIT_ORDER) {
    const count = attackerUnits[u] || 0;
    if (count <= 0) continue;
    const stats = getUnitStats(attackerTribe, u);
    const baseAttack = count * stats.attack;
    totalAttack += baseAttack;

    const counteredTarget = UNIT_COUNTERS[u];
    if (counteredTarget && totalDefender > 0) {
      const counteredCount = defenderUnits[counteredTarget] || 0;
      const ratio = counteredCount / totalDefender;
      effectiveAttack += baseAttack * (1 + COUNTER_BONUS * ratio);
    } else {
      effectiveAttack += baseAttack;
    }
  }

  return totalAttack > 0 ? effectiveAttack / totalAttack : 1;
}

// 简化混合部队战斗公式
// 1. 计算克制倍率（攻防双方互相克制）
// 2. 比较总战力（攻防加权）决定胜负
// 3. 败方全灭，胜方按比例损失，损失按各兵种 HP 占比分摊
export function simulateBattle(
  attacker: ArmyPower,
  defender: ArmyPower,
  attackerTribe: TribeType = 'huang',
  defenderTribe: TribeType = 'huang',
): BattleResult {
  // 克制倍率：攻击方对防御方的克制 / 防御方对攻击方的克制
  const atkCounterMult = computeCounterMultiplier(attacker.units, defender.units, attackerTribe);
  const defCounterMult = computeCounterMultiplier(defender.units, attacker.units, defenderTribe);

  const atkPower = attacker.attack * atkCounterMult;
  const defPower = defender.defense * defCounterMult;

  if (atkPower > defPower) {
    // 攻方胜：守方全灭
    const lossRate = Math.min(0.95, defPower / (atkPower * 1.5));
    const attackerLost = Math.floor(attacker.count * lossRate);
    const lostByUnit = distributeLosses(attacker.units, attackerLost, attackerTribe);
    return {
      attackerWin: true,
      attackerLost,
      attackerLostByUnit: lostByUnit,
      defenderLost: defender.count,
    };
  } else {
    // 守方胜：攻方全灭
    const lossRate = Math.min(0.95, atkPower / (defPower * 1.5));
    const defenderLost = Math.floor(defender.count * lossRate);
    return {
      attackerWin: false,
      attackerLost: attacker.count,
      attackerLostByUnit: { ...attacker.units },
      defenderLost,
    };
  }
}

// 按各兵种总 HP 占比分摊损失（HP 高的兵种更能扛，损失比例更低）
function distributeLosses(
  units: Partial<Record<UnitType, number>>,
  totalLost: number,
  tribe: TribeType,
): Partial<Record<UnitType, number>> {
  const totalHP = UNIT_ORDER.reduce((s, u) => s + (units[u] || 0) * getUnitStats(tribe, u).hp, 0);
  if (totalHP === 0) return {};
  const losses: Partial<Record<UnitType, number>> = {};
  let remaining = totalLost;
  // 先按比例分配，再处理取整误差
  const order = [...UNIT_ORDER].sort(
    (a, b) => (units[b] || 0) * getUnitStats(tribe, b).hp - (units[a] || 0) * getUnitStats(tribe, a).hp,
  );
  for (const u of order) {
    const n = units[u] || 0;
    if (n <= 0 || remaining <= 0) { losses[u] = 0; continue; }
    const share = Math.min(n, Math.round(totalLost * (n * getUnitStats(tribe, u).hp) / totalHP));
    losses[u] = share;
    remaining -= share;
  }
  // 若还有剩余损失（取整导致），从剩余兵多的兵种扣
  if (remaining > 0) {
    for (const u of order) {
      const left = (units[u] || 0) - (losses[u] || 0);
      if (left <= 0) continue;
      const take = Math.min(left, remaining);
      losses[u] = (losses[u] || 0) + take;
      remaining -= take;
      if (remaining <= 0) break;
    }
  }
  return losses;
}

// 战斗预估（胜率）—— PvE 妖兽
export function predictBattle(
  attackerUnits: Partial<Record<UnitType, number>>,
  tribe: TribeType,
  defenderCount: number,
  raiderType: RaiderType = 'demon',
  atkMod = 1,
  defMod = 1,
): { atkPower: number; defPower: number; winChance: number } {
  const atk = aggregateArmy(attackerUnits, tribe, atkMod, defMod);
  const def = aggregateRaiders(defenderCount, raiderType);
  // PvE 中妖兽无兵种构成，克制倍率为 1（不影响）
  const atkCounterMult = computeCounterMultiplier(atk.units, def.units, tribe);
  const defCounterMult = computeCounterMultiplier(def.units, atk.units, tribe);
  const ratio = (atk.attack * atkCounterMult) / Math.max(1, def.defense * defCounterMult);
  const winChance = 1 / (1 + Math.exp(-(ratio - 1) * 3));
  return { atkPower: atk.attack * atkCounterMult, defPower: def.defense * defCounterMult, winChance };
}

// 战斗预估（胜率）—— PVP 玩家 vs NPC 村庄
// 考虑 NPC 城墙防御加成与血量池
export function predictPvPBattle(
  attackerUnits: Partial<Record<UnitType, number>>,
  attackerTribe: TribeType,
  defenderUnits: Partial<Record<UnitType, number>>,
  defenderTribe: TribeType,
  wallLevel: number,
  atkMod = 1,
  defMod = 1,
): { atkPower: number; defPower: number; winChance: number } {
  const atk = aggregateArmy(attackerUnits, attackerTribe, atkMod, defMod);
  const wallBonus = 1 + wallLevel * 0.04;
  const wallHp = wallLevel * 80;
  const def = aggregateArmy(defenderUnits, defenderTribe, 1, wallBonus);
  const defPower = def.defense + wallHp * 0.5;
  const atkCounterMult = computeCounterMultiplier(atk.units, def.units, attackerTribe);
  const defCounterMult = computeCounterMultiplier(def.units, atk.units, defenderTribe);
  const ratio = (atk.attack * atkCounterMult) / Math.max(1, defPower * defCounterMult);
  const winChance = 1 / (1 + Math.exp(-(ratio - 1) * 3));
  return { atkPower: atk.attack * atkCounterMult, defPower: defPower * defCounterMult, winChance };
}

// 计算军队总维持消耗
export function computeUpkeep(units: Partial<Record<UnitType, number>>): number {
  return UNIT_ORDER.reduce((s, u) => s + (units[u] || 0) * UNIT_CONFIGS[u].upkeepCrop, 0);
}

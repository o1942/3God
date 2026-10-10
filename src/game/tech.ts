// 科技树配置（在灵台研发，提供永久加成）
// 三大派系：农耕（资源）、兵戈（军事）、营造（发展）

export type TechCategory = 'agriculture' | 'military' | 'construction';

export type TechType =
  | 'logging' | 'digging' | 'smelting' | 'farming'  // 农耕
  | 'strong_attack' | 'strong_defense' | 'drill' | 'forced_march'  // 兵戈
  | 'granary' | 'architecture' | 'scouting';  // 营造

export type TechConfig = {
  id: TechType;
  name: string;
  category: TechCategory;
  emoji: string;
  desc: string;
  maxLevel: number;
  // 每级效果描述
  effectPerLevel: string;
  // 第 level 级（1-based）的解锁所需灵台等级
  academyReq: (level: number) => number;
  // 第 level 级（1-based）的研发消耗
  cost: (level: number) => { wood: number; clay: number; iron: number; crop: number };
  // 第 level 级（1-based）的研发时间（秒）
  duration: (level: number) => number;
};

export const TECH_CONFIGS: Record<TechType, TechConfig> = {
  // === 农耕系 ===
  logging: {
    id: 'logging', name: '伐木术', category: 'agriculture', emoji: '🪓',
    desc: '改进伐木工具，提升木材产量', maxLevel: 3,
    effectPerLevel: '木材产量 +10%',
    academyReq: (l) => 1 + (l - 1) * 2,
    cost: (l) => ({ wood: 100 * l, clay: 80 * l, iron: 120 * l, crop: 0 }),
    duration: (l) => 20 * l,
  },
  digging: {
    id: 'digging', name: '掘土术', category: 'agriculture', emoji: '⛏️',
    desc: '改进挖掘工具，提升陶土产量', maxLevel: 3,
    effectPerLevel: '陶土产量 +10%',
    academyReq: (l) => 1 + (l - 1) * 2,
    cost: (l) => ({ wood: 80 * l, clay: 100 * l, iron: 120 * l, crop: 0 }),
    duration: (l) => 20 * l,
  },
  smelting: {
    id: 'smelting', name: '冶炼术', category: 'agriculture', emoji: '🔨',
    desc: '改进冶炼工艺，提升铜矿产量', maxLevel: 3,
    effectPerLevel: '铜矿产量 +10%',
    academyReq: (l) => 1 + (l - 1) * 2,
    cost: (l) => ({ wood: 80 * l, clay: 120 * l, iron: 100 * l, crop: 0 }),
    duration: (l) => 20 * l,
  },
  farming: {
    id: 'farming', name: '精耕术', category: 'agriculture', emoji: '🌾',
    desc: '改进农耕技术，提升粟米产量', maxLevel: 3,
    effectPerLevel: '粟米产量 +10%',
    academyReq: (l) => 1 + (l - 1) * 2,
    cost: (l) => ({ wood: 100 * l, clay: 100 * l, iron: 60 * l, crop: 50 * l }),
    duration: (l) => 20 * l,
  },

  // === 兵戈系 ===
  strong_attack: {
    id: 'strong_attack', name: '强兵术', category: 'military', emoji: '🗡️',
    desc: '改进兵器锻造，提升所有兵种攻击力', maxLevel: 3,
    effectPerLevel: '全兵种攻击 +5%',
    academyReq: (l) => 2 + (l - 1) * 2,
    cost: (l) => ({ wood: 150 * l, clay: 100 * l, iron: 200 * l, crop: 100 * l }),
    duration: (l) => 40 * l,
  },
  strong_defense: {
    id: 'strong_defense', name: '坚甲术', category: 'military', emoji: '🛡️',
    desc: '改进甲胄工艺，提升所有兵种防御力', maxLevel: 3,
    effectPerLevel: '全兵种防御 +5%',
    academyReq: (l) => 2 + (l - 1) * 2,
    cost: (l) => ({ wood: 120 * l, clay: 200 * l, iron: 180 * l, crop: 100 * l }),
    duration: (l) => 40 * l,
  },
  drill: {
    id: 'drill', name: '兵法', category: 'military', emoji: '📜',
    desc: '改进训练方法，加快兵种训练速度', maxLevel: 3,
    effectPerLevel: '训练速度 +10%',
    academyReq: (l) => 3 + (l - 1) * 2,
    cost: (l) => ({ wood: 100 * l, clay: 100 * l, iron: 100 * l, crop: 200 * l }),
    duration: (l) => 35 * l,
  },
  forced_march: {
    id: 'forced_march', name: '速行军', category: 'military', emoji: '🏃',
    desc: '改进行军组织，提升部队行军速度', maxLevel: 3,
    effectPerLevel: '行军速度 +15%',
    academyReq: (l) => 3 + (l - 1) * 2,
    cost: (l) => ({ wood: 80 * l, clay: 80 * l, iron: 120 * l, crop: 250 * l }),
    duration: (l) => 35 * l,
  },

  // === 营造系 ===
  granary: {
    id: 'granary', name: '仓廪术', category: 'construction', emoji: '🛖',
    desc: '改进仓储设计，提升所有资源容量', maxLevel: 3,
    effectPerLevel: '资源容量 +15%',
    academyReq: (l) => 2 + (l - 1) * 2,
    cost: (l) => ({ wood: 200 * l, clay: 200 * l, iron: 100 * l, crop: 0 }),
    duration: (l) => 30 * l,
  },
  architecture: {
    id: 'architecture', name: '筑造术', category: 'construction', emoji: '🏗️',
    desc: '改进营造工艺，加快建筑升级速度', maxLevel: 3,
    effectPerLevel: '建造速度 +10%',
    academyReq: (l) => 2 + (l - 1) * 2,
    cost: (l) => ({ wood: 180 * l, clay: 180 * l, iron: 120 * l, crop: 80 * l }),
    duration: (l) => 30 * l,
  },
  scouting: {
    id: 'scouting', name: '斥候术', category: 'construction', emoji: '🔭',
    desc: '训练斥候，降低侦查花费', maxLevel: 3,
    effectPerLevel: '侦查花费 -33%',
    academyReq: (l) => 1 + (l - 1) * 2,
    cost: (l) => ({ wood: 60 * l, clay: 60 * l, iron: 80 * l, crop: 120 * l }),
    duration: (l) => 15 * l,
  },
};

// 科技派系名称
export const TECH_CATEGORY_INFO: Record<TechCategory, { name: string; emoji: string; color: string }> = {
  agriculture: { name: '农耕', emoji: '🌾', color: 'text-emerald-600' },
  military: { name: '兵戈', emoji: '🏹', color: 'text-red-600' },
  construction: { name: '营造', emoji: '🏗️', color: 'text-amber-600' },
};

export const TECH_ORDER: TechType[] = [
  'logging', 'digging', 'smelting', 'farming',
  'strong_attack', 'strong_defense', 'drill', 'forced_march',
  'granary', 'architecture', 'scouting',
];

// === 科技效果计算函数（领域层纯函数，UI 只展示不计算）===

// 资源产量百分比加成
export function getResourceTechBonus(techLevels: Partial<Record<TechType, number>>) {
  return {
    wood: 1 + 0.1 * (techLevels.logging || 0),
    clay: 1 + 0.1 * (techLevels.digging || 0),
    iron: 1 + 0.1 * (techLevels.smelting || 0),
    crop: 1 + 0.1 * (techLevels.farming || 0),
  };
}

// 兵种攻击加成倍数
export function getAttackTechMultiplier(techLevels: Partial<Record<TechType, number>>) {
  return 1 + 0.05 * (techLevels.strong_attack || 0);
}

// 兵种防御加成倍数
export function getDefenseTechMultiplier(techLevels: Partial<Record<TechType, number>>) {
  return 1 + 0.05 * (techLevels.strong_defense || 0);
}

// 训练速度加成倍数（duration / multiplier）
export function getTrainSpeedMultiplier(techLevels: Partial<Record<TechType, number>>) {
  return 1 + 0.1 * (techLevels.drill || 0);
}

// 行军速度加成倍数
export function getMarchSpeedMultiplier(techLevels: Partial<Record<TechType, number>>) {
  return 1 + 0.15 * (techLevels.forced_march || 0);
}

// 容量加成倍数
export function getCapacityTechMultiplier(techLevels: Partial<Record<TechType, number>>) {
  return 1 + 0.15 * (techLevels.granary || 0);
}

// 建造速度加成倍数（duration / multiplier）
export function getBuildSpeedMultiplier(techLevels: Partial<Record<TechType, number>>) {
  return 1 + 0.1 * (techLevels.architecture || 0);
}

// 侦查花费倍数
export function getScoutCostMultiplier(techLevels: Partial<Record<TechType, number>>) {
  return Math.max(0, 1 - 0.33 * (techLevels.scouting || 0));
}

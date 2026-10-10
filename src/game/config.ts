import type { BuildingConfig, BuildingLevel, BuildingType, FieldConfig, FieldLevel, FieldType, ResourceCost, ResourceType } from './types';

// Travian 取整规则：个位+小数 < 2.5 → 个位置 0；[2.5, 7.5) → 个位置 5；>= 7.5 → 进位
function travianRound(n: number): number {
  const base = Math.floor(n / 10) * 10;
  const remainder = n - base;
  if (remainder < 2.5) return base;
  if (remainder < 7.5) return base + 5;
  return base + 10;
}

// 资源田：等级 N+1 = 等级 N × 1.67
function fieldUpgradeCost(level1: ResourceCost, targetLevel: number): ResourceCost {
  let cost = { ...level1 };
  for (let i = 2; i <= targetLevel; i++) {
    cost = {
      wood: travianRound(cost.wood * 1.67),
      clay: travianRound(cost.clay * 1.67),
      iron: travianRound(cost.iron * 1.67),
      crop: travianRound(cost.crop * 1.67),
    };
  }
  return cost;
}

// 建造时间公式：每级 × 1.4（资源田）/ × 1.28（建筑）
function fieldBuildSeconds(level1Sec: number, targetLevel: number): number {
  let sec = level1Sec;
  for (let i = 2; i <= targetLevel; i++) {
    sec = sec * 1.4;
  }
  return Math.round(sec);
}

function buildingBuildSeconds(level1Sec: number, targetLevel: number): number {
  let sec = level1Sec;
  for (let i = 2; i <= targetLevel; i++) {
    sec = sec * 1.28;
  }
  return Math.round(sec);
}

// 资源田每小时产量（标准 Travian：Lv1=30, Lv2=70, Lv3=125, ...）
function fieldProduction(level: number): number {
  if (level === 0) return 0;
  // 简化：production = 30 + 40 * (level - 1) + 5 * (level - 1) ^ 1.5
  return Math.round(30 + 40 * (level - 1) + 5 * Math.pow(level - 1, 1.5));
}

// 建筑等级成本：等级 N+1 = 等级 N × 1.28
function buildingUpgradeCost(level1: ResourceCost, targetLevel: number): ResourceCost {
  let cost = { ...level1 };
  for (let i = 2; i <= targetLevel; i++) {
    cost = {
      wood: travianRound(cost.wood * 1.28),
      clay: travianRound(cost.clay * 1.28),
      iron: travianRound(cost.iron * 1.28),
      crop: travianRound(cost.crop * 1.28),
    };
  }
  return cost;
}

// 4 种资源田的等级 1 基础成本（来自 Travian 已验证数据）
// 上古主题：木（山林）、陶土（制陶）、铜矿（铸兵）、粟米（农耕）
export const FIELD_CONFIGS: Record<FieldType, FieldConfig> = {
  woodcutter: buildFieldConfig('woodcutter', '采林场', 'wood', 'bg-amber-700', '🪵', { wood: 40, clay: 100, iron: 50, crop: 60 }),
  clayPit: buildFieldConfig('clayPit', '陶土坑', 'clay', 'bg-yellow-700', '🏺', { wood: 80, clay: 40, iron: 80, crop: 50 }),
  ironMine: buildFieldConfig('ironMine', '铜矿场', 'iron', 'bg-orange-600', '🔶', { wood: 100, clay: 80, iron: 30, crop: 60 }),
  cropland: buildFieldConfig('cropland', '粟田', 'crop', 'bg-green-700', '🌾', { wood: 70, clay: 90, iron: 60, crop: 50 }),
};

// 资源显示元数据（统一管理，便于全局主题）
export const RESOURCE_META = {
  wood: { name: '木材', icon: '🪵' },
  clay: { name: '陶土', icon: '🏺' },
  iron: { name: '铜矿', icon: '🔶' },
  crop: { name: '粟米', icon: '🌾' },
} as const;

function buildFieldConfig(
  type: FieldType,
  name: string,
  produces: ResourceType,
  colorClass: string,
  emoji: string,
  level1Cost: ResourceCost
): FieldConfig {
  const levels: FieldLevel[] = [];
  // 资源田 Lv1 标准耗时 25 秒（Travian 原版约 33 秒，MVP 适度压缩）
  const baseBuildTime = 25;
  for (let lv = 1; lv <= 20; lv++) {
    levels.push({
      level: lv,
      cost: fieldUpgradeCost(level1Cost, lv),
      buildTime: fieldBuildSeconds(baseBuildTime, lv),
      production: fieldProduction(lv),
    });
  }
  return { type, name, produces, colorClass, emoji, levels };
}

// 8 种核心建筑的等级 1 基础数据（来自 Travian 已验证数据）
// 上古主题：封禅台、仓廪、粟仓、秘窖、点将台、军帐、会盟台、集市、铸铜坊、灵台、马场、工坊
export const BUILDING_CONFIGS: Record<BuildingType, BuildingConfig> = {
  mainBuilding: buildBuildingConfig(
    'mainBuilding', '封禅台', '⛰️',
    '夯土筑台，燔柴祭天、瘗埋祭地之所。等级越高，营造越快。',
    { wood: 70, clay: 40, iron: 60, crop: 20 },
    30, 20, [], (lv) => ({ buildSpeed: 1 + (lv - 1) * 0.05 })
  ),
  warehouse: buildBuildingConfig(
    'warehouse', '仓廪', '🛖',
    '存放木/陶土/铜矿，等级越高容量越大。',
    { wood: 130, clay: 160, iron: 90, crop: 40 },
    33, 20, [{ building: 'mainBuilding', level: 1 }], (lv) => ({ capacity: 800 + (lv - 1) * 480 })
  ),
  granary: buildBuildingConfig(
    'granary', '粟仓', '🌾',
    '存放粟米，等级越高容量越大。',
    { wood: 80, clay: 100, iron: 70, crop: 20 },
    27, 20, [{ building: 'mainBuilding', level: 1 }], (lv) => ({ cropCapacity: 800 + (lv - 1) * 480 })
  ),
  cranny: buildBuildingConfig(
    'cranny', '秘窖', '🪨',
    '被攻击时隐藏资源，等级 1 隐藏 100 单位。',
    { wood: 40, clay: 50, iron: 30, crop: 10 },
    13, 10, [], (lv) => ({ hideAmount: 100 + (lv - 1) * 90 })
  ),
  rallyPoint: buildBuildingConfig(
    'rallyPoint', '点将台', '🚩',
    '部众集合点，可派遣军队出征。等级越高，单次出兵上限越高。',
    { wood: 110, clay: 160, iron: 90, crop: 70 },
    33, 20, [], (lv) => ({ deployLimit: 10 + lv * 5 })
  ),
  barracks: buildBuildingConfig(
    'barracks', '军帐', '🏹',
    '训练部落战士，等级越高训练越快。',
    { wood: 210, clay: 140, iron: 260, crop: 120 },
    33, 20, [{ building: 'mainBuilding', level: 3 }, { building: 'rallyPoint', level: 1 }], () => ({})
  ),
  embassy: buildBuildingConfig(
    'embassy', '会盟台', '🤲',
    '可加入或创建部落联盟。',
    { wood: 180, clay: 130, iron: 150, crop: 80 },
    33, 20, [{ building: 'mainBuilding', level: 1 }], () => ({})
  ),
  market: buildBuildingConfig(
    'market', '集市', '🪙',
    '与他部落交易资源，每升一级多一名商人。',
    { wood: 80, clay: 70, iron: 120, crop: 70 },
    30, 20, [{ building: 'mainBuilding', level: 3 }, { building: 'warehouse', level: 1 }, { building: 'granary', level: 1 }],
    (lv) => ({ merchantCount: lv })
  ),
  smithy: buildBuildingConfig(
    'smithy', '铸铜坊', '🔨',
    '铸造铜兵，提升部队武器攻击力。',
    { wood: 170, clay: 200, iron: 380, crop: 130 },
    33, 20, [{ building: 'mainBuilding', level: 3 }, { building: 'academy', level: 3 }], () => ({})
  ),
  academy: buildBuildingConfig(
    'academy', '灵台', '📚',
    '巫祝观星之所，研究新兵种与秘术。',
    { wood: 220, clay: 160, iron: 90, crop: 40 },
    33, 20, [{ building: 'mainBuilding', level: 3 }, { building: 'barracks', level: 3 }], () => ({})
  ),
  stable: buildBuildingConfig(
    'stable', '马场', '🐎',
    '驯养战马，训练骑兵。',
    { wood: 260, clay: 140, iron: 220, crop: 100 },
    37, 20, [{ building: 'smithy', level: 3 }, { building: 'academy', level: 5 }], () => ({})
  ),
  workshop: buildBuildingConfig(
    'workshop', '工坊', '🧰',
    '百工之所，生产攻城器械。',
    { wood: 460, clay: 510, iron: 600, crop: 320 },
    50, 20, [{ building: 'academy', level: 10 }, { building: 'mainBuilding', level: 5 }], () => ({})
  ),
  wall: buildBuildingConfig(
    'wall', '城墙', '🧱',
    '部落防御工事，每级提供防御值并提升守军防御力。',
    { wood: 140, clay: 280, iron: 60, crop: 40 },
    30, 20, [{ building: 'mainBuilding', level: 3 }, { building: 'rallyPoint', level: 1 }],
    (lv) => ({ defense: 80 * lv, defenseBonus: 0.04 * lv })
  ),
};

function buildBuildingConfig(
  type: BuildingType,
  name: string,
  emoji: string,
  description: string,
  level1Cost: ResourceCost,
  level1BuildSec: number,
  maxLevel: number,
  prerequisites: { building: BuildingType; level: number }[],
  effectFn: (lv: number) => Record<string, number>
): BuildingConfig {
  const levels: BuildingLevel[] = [];
  for (let lv = 1; lv <= maxLevel; lv++) {
    levels.push({
      level: lv,
      cost: buildingUpgradeCost(level1Cost, lv),
      buildTime: buildingBuildSeconds(level1BuildSec, lv),
      pop: 1 + Math.floor((lv - 1) / 4),
      effect: effectFn(lv),
    });
  }
  return { type, name, description, emoji, maxLevel, prerequisites, levels };
}

import type { TribeType, UnitType, VillageState } from './types';
import { CAMP_TEMPLATES, CAMP_POSITIONS } from './units';
import { createInitialSeason } from './season';
import { createNewbieShield } from './shield';
import { generateNpcVillages } from './pvp';

// 默认部落（黄帝，华夏正统）
export const DEFAULT_TRIBE: TribeType = 'huang';

// 空兵种表
export const EMPTY_UNITS: Record<UnitType, number> = {
  warrior: 0,
  archer: 0,
  cavalry: 0,
  guard: 0,
};

// 标准 6 田村开局：4 木 + 4 泥 + 4 铁 + 6 粮 = 18 块资源田
export const INITIAL_FIELDS = {
  woodcutter: [0, 0, 0, 0],
  clayPit: [0, 0, 0, 0],
  ironMine: [0, 0, 0, 0],
  cropland: [0, 0, 0, 0, 0, 0],
};

// 初始资源：调优后 1500，让玩家开局可连续升级 2-3 块田，反馈密集
export const INITIAL_RESOURCES = {
  wood: 1500,
  clay: 1500,
  iron: 1500,
  crop: 1500,
};

// 初始建筑：只有中心大楼 Lv1
export const INITIAL_BUILDINGS = {
  mainBuilding: 1,
};

// 创建初始野怪据点
function createInitialCamps(): VillageState['camps'] {
  const camps: VillageState['camps'] = {};
  Object.entries(CAMP_POSITIONS).forEach(([id, pos], idx) => {
    const tpl = CAMP_TEMPLATES[idx];
    camps[id] = {
      id,
      name: tpl.name,
      raiderType: tpl.raiderType,
      difficulty: tpl.difficulty,
      raiders: tpl.maxRaiders,
      maxRaiders: tpl.maxRaiders,
      reward: { ...tpl.reward },
      position: pos,
      occupied: false,
      scouted: false,
    };
  });
  return camps;
}

export function createInitialVillage(tribe: TribeType = DEFAULT_TRIBE): VillageState {
  return {
    playerName: '',
    tribe,
    resources: { ...INITIAL_RESOURCES },
    fields: {
      woodcutter: [...INITIAL_FIELDS.woodcutter],
      clayPit: [...INITIAL_FIELDS.clayPit],
      ironMine: [...INITIAL_FIELDS.ironMine],
      cropland: [...INITIAL_FIELDS.cropland],
    },
    buildings: { ...INITIAL_BUILDINGS },
    buildQueue: [],
    trainQueue: [],
    units: { ...EMPTY_UNITS },
    camps: createInitialCamps(),
    players: generateNpcVillages(),
    marchQueue: [],
    techLevels: {},
    researchQueue: [],
    nextInvasionAt: Date.now() + 5 * 60 * 1000,
    jade: 100,
    accelUsedToday: 0,
    accelResetAt: Date.now() + 24 * 60 * 60 * 1000,
    cosmetics: ['banner_default', 'theme_default', 'frame_default'],
    equippedCosmetics: { banner: 'banner_default', theme: 'theme_default', frame: 'frame_default' },
    season: createInitialSeason(),
    shield: createNewbieShield(),
    lastTick: Date.now(),
    lastSeen: Date.now(),
  };
}

// 全局速度倍率：1.0 = Travian 标准节奏；0.1 = 1/10 速度（适合 MVP 试玩）
// 调优后 0.1，让早期升级有决策感不过快，中期加速按钮才有价值
// 资源田 Lv1 ≈ 4 秒，Lv5 ≈ 22 秒，Lv10 ≈ 2 分钟（加速按钮策略感明显）
export const SPEED_MULTIPLIER = 0.1;

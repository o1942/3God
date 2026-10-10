// 任务系统：首日 5 步任务链
// 验证 D1 留存假设：通过任务驱动前 2 小时玩家行为

export type QuestId = 'first_field' | 'level3_field' | 'first_building' | 'level5_field' | 'main_level3' | 'barracks_built' | 'first_battle' | 'first_victory';

export type Quest = {
  id: QuestId;
  title: string;
  description: string;
  // 检查是否完成（接收当前村庄状态的快照）
  check: (ctx: QuestContext) => boolean;
  // 奖励资源
  reward: { wood: number; clay: number; iron: number; crop: number };
  jade: number; // 纹玉奖励（反P2W：仅游戏行为获得）
  rewardText: string;
};

export type QuestContext = {
  // 所有资源田的最高等级
  maxFieldLevel: number;
  // 已建造的村内建筑数量（不含中心大楼）
  buildingCount: number;
  // 中心大楼等级
  mainLevel: number;
  // 任意资源田达到 Lv3 数量
  level3FieldCount: number;
  // 任意资源田达到 Lv5 数量
  level5FieldCount: number;
  // 兵营等级
  barracksLevel: number;
  // 已训练士兵数
  units: number;
  // 战斗胜利数
  victories: number;
};

export const QUESTS: Quest[] = [
  {
    id: 'first_field',
    title: '初辟洪荒',
    description: '升级任意资源田到 Lv1，开启资源生产',
    check: (c) => c.maxFieldLevel >= 1,
    reward: { wood: 100, clay: 100, iron: 100, crop: 100 },
    jade: 10,
    rewardText: '+100 木/陶土/铜/粟 +10💎',
  },
  {
    id: 'level3_field',
    title: '开辟山林',
    description: '升级任意资源田到 Lv3',
    check: (c) => c.maxFieldLevel >= 3,
    reward: { wood: 300, clay: 300, iron: 300, crop: 300 },
    jade: 15,
    rewardText: '+300 木/陶土/铜/粟 +15💎',
  },
  {
    id: 'first_building',
    title: '筑造仓廪',
    description: '建造任意村内建筑（推荐仓廪）',
    check: (c) => c.buildingCount >= 1,
    reward: { wood: 200, clay: 200, iron: 200, crop: 200 },
    jade: 10,
    rewardText: '+200 木/陶土/铜/粟 +10💎',
  },
  {
    id: 'level5_field',
    title: '百业渐兴',
    description: '升级任意资源田到 Lv5',
    check: (c) => c.maxFieldLevel >= 5,
    reward: { wood: 600, clay: 600, iron: 600, crop: 600 },
    jade: 20,
    rewardText: '+600 木/陶土/铜/粟 +20💎',
  },
  {
    id: 'main_level3',
    title: '封禅升级',
    description: '升级封禅台到 Lv3，加速建造',
    check: (c) => c.mainLevel >= 3,
    reward: { wood: 800, clay: 800, iron: 800, crop: 800 },
    jade: 20,
    rewardText: '+800 木/陶土/铜/粟 +20💎',
  },
  {
    id: 'barracks_built',
    title: '军帐建成',
    description: '建造军帐，开启军事训练',
    check: (c) => c.barracksLevel >= 1,
    reward: { wood: 300, clay: 300, iron: 300, crop: 300 },
    jade: 25,
    rewardText: '+300 木/陶土/铜/粟 +25💎',
  },
  {
    id: 'first_battle',
    title: '厉兵秣马',
    description: '训练 5 名部落战士',
    check: (c) => c.units >= 5,
    reward: { wood: 500, clay: 500, iron: 500, crop: 500 },
    jade: 30,
    rewardText: '+500 木/陶土/铜/粟 +30💎',
  },
  {
    id: 'first_victory',
    title: '首战告捷',
    description: '攻占任意妖兽据点',
    check: (c) => c.victories >= 1,
    reward: { wood: 1000, clay: 1000, iron: 1000, crop: 1000 },
    jade: 50,
    rewardText: '+1000 木/陶土/铜/粟 +50💎',
  },
];

// 根据当前村庄状态构建任务上下文
export function buildQuestContext(
  fields: { woodcutter: number[]; clayPit: number[]; ironMine: number[]; cropland: number[] },
  buildings: Record<string, number | undefined>,
  units: Record<string, number> = {},
  victories = 0,
): QuestContext {
  const allLevels: number[] = [
    ...fields.woodcutter,
    ...fields.clayPit,
    ...fields.ironMine,
    ...fields.cropland,
  ];
  const maxFieldLevel = allLevels.length > 0 ? Math.max(...allLevels) : 0;
  const level3FieldCount = allLevels.filter((lv) => lv >= 3).length;
  const level5FieldCount = allLevels.filter((lv) => lv >= 5).length;

  const buildingKeys = Object.keys(buildings).filter(
    (k) => k !== 'mainBuilding' && (buildings[k] || 0) > 0,
  );
  const buildingCount = buildingKeys.length;
  const mainLevel = buildings.mainBuilding || 0;
  const barracksLevel = buildings.barracks || 0;

  // 所有兵种总数
  const totalUnits = Object.values(units).reduce((s, n) => s + (n || 0), 0);

  return {
    maxFieldLevel,
    buildingCount,
    mainLevel,
    level3FieldCount,
    level5FieldCount,
    barracksLevel,
    units: totalUnits,
    victories,
  };
}

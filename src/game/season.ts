import type { SeasonState } from './types';

// 赛季长度（毫秒）：MVP 设为 7 天
export const SEASON_LENGTH_MS = 7 * 24 * 60 * 60 * 1000;

// 离线判定阈值：超过 30 秒未活跃 → 触发离线收益弹窗
export const OFFLINE_THRESHOLD_MS = 30 * 1000;

// 离线收益上限：8 小时（避免无限挂机）
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;

// 赛季积分来源
export const SEASON_POINT_RULES = {
  fieldUpgrade: 5,    // 每升一级资源田
  buildingUpgrade: 10, // 每升一级建筑
  trainUnit: 2,       // 每训练一名士兵
  battleWin: 30,      // 每次战斗胜利
  questComplete: 50,   // 每完成一个任务
  researchComplete: 25, // 每完成一项研发
};

// 赛季里程碑：积分 → 奖励（含纹玉，纹玉仅可通过游戏行为获得）
export type Milestone = {
  points: number;
  reward: { wood: number; clay: number; iron: number; crop: number };
  jade: number;   // 纹玉奖励（反P2W：非充值获得）
  title: string;
};

export const SEASON_MILESTONES: Milestone[] = [
  { points: 100,  reward: { wood: 500,  clay: 500,  iron: 500,  crop: 500  }, jade: 30,  title: '初辟洪荒' },
  { points: 500,  reward: { wood: 2000, clay: 2000, iron: 2000, crop: 2000 }, jade: 60,  title: '部落初兴' },
  { points: 1000, reward: { wood: 5000, clay: 5000, iron: 5000, crop: 5000 }, jade: 100, title: '威震四方' },
  { points: 2000, reward: { wood: 15000, clay: 15000, iron: 15000, crop: 15000 }, jade: 200, title: '涿鹿之主' },
];

// 按积分快速查找
export const SEASON_MILESTONES_BY_POINTS: Record<number, Milestone> =
  SEASON_MILESTONES.reduce((acc, m) => { acc[m.points] = m; return acc; }, {} as Record<number, Milestone>);

export function createInitialSeason(): SeasonState {
  const now = Date.now();
  return {
    number: 1,
    points: 0,
    startAt: now,
    endsAt: now + SEASON_LENGTH_MS,
    claimedMilestones: [],
  };
}

// 检查赛季是否结束，结束则重置积分（村庄保留）
export function checkSeasonRoll(season: SeasonState): SeasonState {
  if (Date.now() >= season.endsAt) {
    return {
      number: season.number + 1,
      points: 0,
      startAt: Date.now(),
      endsAt: Date.now() + SEASON_LENGTH_MS,
      claimedMilestones: [],
    };
  }
  return season;
}

// 获取下一个未领取的里程碑
export function getNextMilestone(season: SeasonState): Milestone | null {
  for (const m of SEASON_MILESTONES) {
    if (season.points >= m.points && !season.claimedMilestones.includes(m.points)) {
      return m;
    }
  }
  return null;
}

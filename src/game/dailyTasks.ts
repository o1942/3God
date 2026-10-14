// 每日任务：每天重置的 5 项小目标，完成后给经验；完成一定数量还有额外加奖
// 目的：给玩家「今天上来做什么」的短期目标，与主线任务（一次性）互补

export type DailyMetric =
  | 'fieldUpgrades'      // 升级资源田次数
  | 'buildingUpgrades'   // 建造/升级建筑次数
  | 'unitsTrained'       // 训练士兵数
  | 'researchDone'       // 完成研发项数
  | 'battlesWon';        // 战斗胜利次数

export type DailyTaskId = 'd_field' | 'd_building' | 'd_train' | 'd_research' | 'd_battle';

export type DailyTask = {
  id: DailyTaskId;
  title: string;
  desc: string;
  metric: DailyMetric;
  target: number;
  xp: number;
};

export const DAILY_TASKS: DailyTask[] = [
  { id: 'd_field',    title: '开垦荒地', desc: '升级 3 次资源田',     metric: 'fieldUpgrades',  target: 3,  xp: 300 },
  { id: 'd_building', title: '营建部族', desc: '建造或升级 1 次建筑',  metric: 'buildingUpgrades', target: 1, xp: 300 },
  { id: 'd_train',    title: '厉兵秣马', desc: '训练 20 名士兵',      metric: 'unitsTrained',   target: 20, xp: 300 },
  { id: 'd_research', title: '研习古道', desc: '完成 1 项研发',        metric: 'researchDone',   target: 1,  xp: 350 },
  { id: 'd_battle',   title: '征讨四方', desc: '战斗胜利 1 次',        metric: 'battlesWon',     target: 1,  xp: 400 },
];

// 额外加奖：完成的每日任务达到档位数量时，额外发放经验
export type DailyBonusTier = { need: number; xp: number; label: string };

export const DAILY_BONUS_TIERS: DailyBonusTier[] = [
  { need: 3, xp: 500,  label: '完成 3 项每日任务' },
  { need: 5, xp: 1000, label: '完成全部每日任务' },
];

export type DailyState = {
  // 所属自然日 'YYYY-MM-DD'（本地时区），跨日即整体重置
  date: string;
  progress: Partial<Record<DailyMetric, number>>;
  // 已完成（经验已发放）的每日任务
  claimed: DailyTaskId[];
  // 已发放加奖的档位（存 need 值）
  bonusClaimed: number[];
};

export function todayKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function createInitialDaily(): DailyState {
  return { date: todayKey(), progress: {}, claimed: [], bonusClaimed: [] };
}

export function dailyProgressOf(daily: DailyState | undefined, metric: DailyMetric): number {
  return daily?.progress?.[metric] || 0;
}

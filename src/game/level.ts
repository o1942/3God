// 玩家等级与经验系统
// 经验值来自「真实游戏行为」：升级资源田 / 升级建筑 / 训练士兵 / 研发 / 战斗胜利 / 完成任务
// 反 P2W：经验不可购买，只能靠游玩积累；满级 60。

export const MAX_LEVEL = 60;

// 升到下一级所需经验：随等级加速增长（前几级很快，后期明显变慢）
// Lv1→2 = 100，Lv10→11 ≈ 1.17k，Lv30→31 ≈ 4.98k，Lv59→60 ≈ 12.3k，累计约 31 万
export function xpToNext(level: number): number {
  if (level >= MAX_LEVEL) return Infinity;
  return Math.round(50 * Math.pow(level, 1.35) + 50);
}

export type LevelInfo = {
  level: number;
  // 当前等级内已积累的经验
  expIntoLevel: number;
  // 升到下一级还需的经验（满级为 Infinity）
  expForNext: number;
  isMax: boolean;
};

// 由「累计经验」反解等级（等级不单独存档，避免多端不同步）
export function resolveLevel(exp: number): LevelInfo {
  let level = 1;
  let rest = Math.max(0, exp || 0);
  while (level < MAX_LEVEL) {
    const need = xpToNext(level);
    if (rest < need) break;
    rest -= need;
    level += 1;
  }
  const expForNext = xpToNext(level);
  return {
    level,
    expIntoLevel: rest,
    expForNext,
    isMax: level >= MAX_LEVEL,
  };
}

// 各级经验来源。资源田/建筑按「升到的目标等级」给经验，鼓励往高级升
export const XP_RULES = {
  fieldUpgrade: (toLevel: number) => 30 + toLevel * 10,
  buildingUpgrade: (toLevel: number) => 50 + toLevel * 15,
  trainUnit: 8,          // 每训练 1 名士兵
  researchComplete: 80,  // 每完成 1 项研发
  battleWin: 120,        // 每次战斗胜利
  bossDefeat: 360,       // 击败世界Boss / 秘境（战斗胜利的 3 倍）
  questComplete: 200,    // 每完成 1 个主线任务
};

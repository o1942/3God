// PVP 阶段1：NPC 敌方部落系统
// 由于 MVP 为单机，PVP 表现为玩家 vs AI 控制的敌方部落村庄
// - 玩家可出征攻击 NPC 村庄，战胜后掠夺资源
// - NPC 会在玩家攻击后发起反击（受护盾阻挡）
// - NPC 兵力与资源随时间恢复

import type { NpcVillage, ResourceCost, TribeType, UnitType } from './types';
import { UNIT_ORDER, aggregateArmy, simulateBattle } from './units';
import { VILLAGE_POSITION } from './units';
import { TRIBE_CONFIGS } from './tribes';

// 城墙每级防御加成（与 config.ts 中 wall 保持一致：80 防御值 / 4% 守军防御加成）
const WALL_DEFENSE_PER_LEVEL = 80;
const WALL_BONUS_PER_LEVEL = 0.04;

// 掠夺比例：战胜后可掠夺 NPC 可掠夺资源的百分比
export const PLUNDER_RATE = 0.3;
// NPC 反击概率：玩家攻击后，NPC 有概率发起反击
export const COUNTER_ATTACK_CHANCE = 0.45;
// NPC 反击出兵比例：用守军的多少比例反击
export const COUNTER_SEND_RATIO = 0.5;
// NPC 反击最小间隔（ms）：避免过于频繁
export const COUNTER_ATTACK_COOLDOWN_MS = 2 * 60 * 1000;
// NPC 废墟恢复时间：被击败后多久恢复满员
export const NPC_REVIVE_MS = 3 * 60 * 1000;
// NPC 兵力恢复速率：每秒恢复多少兵
export const NPC_TROOP_REGEN_PER_SEC = 0.5;

// NPC 村庄模板：名字/部落/位置/基础兵力/城墙/资源上限
type NpcTemplate = {
  name: string;
  tribe: TribeType;
  position: { x: number; y: number };
  baseUnits: Partial<Record<UnitType, number>>;
  wallLevel: number;
  resourceCap: ResourceCost;
  difficulty: 'low' | 'mid' | 'high';
};

export const NPC_TEMPLATES: NpcTemplate[] = [
  {
    name: '有巢氏聚落',
    tribe: 'huang',
    position: { x: 12, y: 28 },
    baseUnits: { warrior: 12, archer: 4 },
    wallLevel: 1,
    resourceCap: { wood: 2000, clay: 2000, iron: 1500, crop: 2000 },
    difficulty: 'low',
  },
  {
    name: '风后营寨',
    tribe: 'huang',
    position: { x: 38, y: 18 },
    baseUnits: { warrior: 18, archer: 8, cavalry: 2 },
    wallLevel: 2,
    resourceCap: { wood: 3500, clay: 3500, iron: 3000, crop: 3500 },
    difficulty: 'mid',
  },
  {
    name: '祝融火部',
    tribe: 'yan',
    position: { x: 8, y: 55 },
    baseUnits: { warrior: 20, guard: 6 },
    wallLevel: 3,
    resourceCap: { wood: 4000, clay: 4000, iron: 3500, crop: 5000 },
    difficulty: 'mid',
  },
  {
    name: '刑天战部',
    tribe: 'chi',
    position: { x: 92, y: 75 },
    baseUnits: { warrior: 25, cavalry: 8, guard: 4 },
    wallLevel: 3,
    resourceCap: { wood: 5000, clay: 5000, iron: 5000, crop: 5000 },
    difficulty: 'high',
  },
  {
    name: '共工水寨',
    tribe: 'yan',
    position: { x: 60, y: 8 },
    baseUnits: { warrior: 30, archer: 12, cavalry: 6, guard: 5 },
    wallLevel: 4,
    resourceCap: { wood: 8000, clay: 8000, iron: 7000, crop: 9000 },
    difficulty: 'high',
  },
];

// 生成初始 NPC 村庄
export function generateNpcVillages(): Record<string, NpcVillage> {
  const out: Record<string, NpcVillage> = {};
  NPC_TEMPLATES.forEach((tpl, idx) => {
    const id = `npc_${idx + 1}`;
    out[id] = {
      id,
      name: tpl.name,
      tribe: tpl.tribe,
      position: { ...tpl.position },
      units: { ...tpl.baseUnits },
      baseUnits: { ...tpl.baseUnits },
      wallLevel: tpl.wallLevel,
      resources: { ...tpl.resourceCap },
      resourceCap: { ...tpl.resourceCap },
      scouted: false,
    };
  });
  return out;
}

// 获取 NPC 模板（用于恢复与显示）
export function getNpcTemplate(id: string): NpcTemplate | undefined {
  const idx = parseInt(id.replace('npc_', ''), 10) - 1;
  return NPC_TEMPLATES[idx];
}

// 计算 NPC 行军到我方村庄的时间（秒）
export function calcNpcMarchTime(npcPos: { x: number; y: number }): number {
  const dx = npcPos.x - VILLAGE_POSITION.x;
  const dy = npcPos.y - VILLAGE_POSITION.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Math.max(5, Math.round(dist * 0.5));
}

// PVP 攻击结算：玩家 → NPC
// 返回：胜负、攻方损失、守方损失、掠夺资源、NPC 战后兵力
export type PvpAttackResult = {
  win: boolean;
  attackerLost: number;
  attackerLostByUnit: Partial<Record<UnitType, number>>;
  defenderLost: number;
  plundered: ResourceCost;
  remainingNpcUnits: Partial<Record<UnitType, number>>;
  remainingNpcResources: ResourceCost;
};

export function resolvePvpAttack(
  attackerUnits: Partial<Record<UnitType, number>>,
  attackerTribe: TribeType,
  atkMult: number,
  defMult: number,
  npc: NpcVillage,
): PvpAttackResult {
  // 守方军队 = NPC 当前兵力（应用城墙防御加成）
  const wallBonus = 1 + npc.wallLevel * WALL_BONUS_PER_LEVEL;
  const wallHp = npc.wallLevel * WALL_DEFENSE_PER_LEVEL;
  const defArmy = aggregateArmy(npc.units, npc.tribe, 1, wallBonus);
  // 城墙防御值作为额外血量池叠加到防御
  const defArmyWithWall = {
    ...defArmy,
    defense: defArmy.defense + wallHp * 0.5,
  };

  const atkArmy = aggregateArmy(attackerUnits, attackerTribe, atkMult, defMult);
  const result = simulateBattle(atkArmy, defArmyWithWall, attackerTribe, npc.tribe);

  // 战后 NPC 兵力
  const remainingNpcUnits: Partial<Record<UnitType, number>> = { ...npc.units };
  if (result.attackerWin) {
    // 守方全灭
    for (const u of UNIT_ORDER) remainingNpcUnits[u] = 0;
  } else {
    // 守方按损失比例扣减
    for (const u of UNIT_ORDER) {
      const cur = remainingNpcUnits[u] || 0;
      const lost = Math.min(cur, Math.floor(result.defenderLost * (cur / Math.max(1, defArmy.count))));
      remainingNpcUnits[u] = cur - lost;
    }
  }

  // 掠夺：战胜时掠夺 PLUNDER_RATE 的可掠夺资源
  let plundered: ResourceCost = { wood: 0, clay: 0, iron: 0, crop: 0 };
  let remainingNpcResources = { ...npc.resources };
  if (result.attackerWin) {
    plundered = {
      wood: Math.floor(npc.resources.wood * PLUNDER_RATE),
      clay: Math.floor(npc.resources.clay * PLUNDER_RATE),
      iron: Math.floor(npc.resources.iron * PLUNDER_RATE),
      crop: Math.floor(npc.resources.crop * PLUNDER_RATE),
    };
    remainingNpcResources = {
      wood: npc.resources.wood - plundered.wood,
      clay: npc.resources.clay - plundered.clay,
      iron: npc.resources.iron - plundered.iron,
      crop: npc.resources.crop - plundered.crop,
    };
  }

  return {
    win: result.attackerWin,
    attackerLost: result.attackerLost,
    attackerLostByUnit: result.attackerLostByUnit,
    defenderLost: result.defenderLost,
    plundered,
    remainingNpcUnits,
    remainingNpcResources,
  };
}

// NPC 反击兵力：抽取守军的一部分发起反击
export function buildCounterAttackForce(npc: NpcVillage): Partial<Record<UnitType, number>> {
  const force: Partial<Record<UnitType, number>> = {};
  for (const u of UNIT_ORDER) {
    const n = npc.units[u] || 0;
    if (n > 0) force[u] = Math.max(1, Math.floor(n * COUNTER_SEND_RATIO));
  }
  return force;
}

// NPC 恢复：兵力与资源随时间回涨
// dtSeconds 为距上次结算的秒数
export function regenNpc(npc: NpcVillage, dtSeconds: number): NpcVillage {
  const now = Date.now();
  // 被击败后进入废墟期，期间不恢复
  if (npc.defeatedAt && now - npc.defeatedAt < NPC_REVIVE_MS) {
    return npc;
  }
  // 废墟期结束：一次性恢复满员
  if (npc.defeatedAt && now - npc.defeatedAt >= NPC_REVIVE_MS) {
    return {
      ...npc,
      units: { ...npc.baseUnits },
      resources: { ...npc.resourceCap },
      defeatedAt: undefined,
    };
  }

  // 正常恢复：兵力线性恢复到 baseUnits
  const regenCount = NPC_TROOP_REGEN_PER_SEC * dtSeconds;
  const newUnits = { ...npc.units };
  let remaining = regenCount;
  for (const u of UNIT_ORDER) {
    if (remaining <= 0) break;
    const base = npc.baseUnits[u] || 0;
    const cur = newUnits[u] || 0;
    if (cur < base) {
      const add = Math.min(base - cur, remaining);
      newUnits[u] = cur + add;
      remaining -= add;
    }
  }

  // 资源缓慢恢复（每小时回到上限的 10%）
  const resRegenRate = 0.1 / 3600; // 每秒恢复比例
  const newRes = { ...npc.resources };
  (['wood', 'clay', 'iron', 'crop'] as (keyof ResourceCost)[]).forEach((k) => {
    const cap = npc.resourceCap[k];
    newRes[k] = Math.min(cap, newRes[k] + (cap - newRes[k]) * resRegenRate * dtSeconds);
  });

  return { ...npc, units: newUnits, resources: newRes };
}

// 是否处于废墟（被击败恢复期）
export function isNpcDefeated(npc: NpcVillage): boolean {
  return !!npc.defeatedAt && Date.now() - npc.defeatedAt < NPC_REVIVE_MS;
}

// NPC 显示名（带部落 emoji）
export function getNpcDisplayName(npc: NpcVillage): string {
  const t = TRIBE_CONFIGS[npc.tribe];
  return `${t.emoji} ${npc.name}`;
}

// 难度颜色
export function getDifficultyColor(diff: 'low' | 'mid' | 'high'): string {
  switch (diff) {
    case 'low': return 'text-green-700 bg-green-100';
    case 'mid': return 'text-amber-700 bg-amber-100';
    case 'high': return 'text-red-700 bg-red-100';
  }
}

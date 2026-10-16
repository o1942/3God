// 英雄系统配置（MVP 版本）
// MVP 契约：9 位英雄全部预置，玩家开局即拥有，可切换主将；主将三维进战斗模拟，非主将 50% 生效
// MVP 不做：招募、纹玉消耗、专属被动、稀有度解锁槽位

import type { TribeType } from './types';
import { resolveLevel } from './level';

export type HeroId =
  | 'shennong'  // 炎帝·神农
  | 'zhurong'   // 祝融
  | 'jingwei'   // 精卫
  | 'xuanyuan'  // 黄帝·轩辕
  | 'houji'     // 后稷
  | 'fenghou'   // 风后
  | 'chiyou'    // 蚩尤
  | 'kuafu'     // 夸父
  | 'xingtian'; // 刑天

export type HeroType = 'sage' | 'general' | 'assassin' | 'tank' | 'strategist';
export type HeroRarity = 'R' | 'SR' | 'SSR';

export type HeroConfig = {
  id: HeroId;
  name: string;
  title: string;       // 称号
  tribe: TribeType;
  type: HeroType;
  rarity: HeroRarity;
  rarityMult: number;  // 稀有度系数
  desc: string;        // 一句话定位
  lore: string;        // 神话背景
};

export const HERO_CONFIGS: Record<HeroId, HeroConfig> = {
  shennong: {
    id: 'shennong', name: '炎帝·神农', title: '农耕始祖',
    tribe: 'yan', type: 'sage', rarity: 'SSR', rarityMult: 1.8,
    desc: '粮食与防御的贤者',
    lore: '神农尝百草、教民稼穑，火德称王。',
  },
  zhurong: {
    id: 'zhurong', name: '祝融', title: '火德神将',
    tribe: 'yan', type: 'general', rarity: 'SSR', rarityMult: 1.8,
    desc: '火攻与暴击的神将',
    lore: '祝融司夏，祝融之墟。掌光炎、主征伐。',
  },
  jingwei: {
    id: 'jingwei', name: '精卫', title: '青鸟刺客',
    tribe: 'yan', type: 'assassin', rarity: 'SR', rarityMult: 1.4,
    desc: '先手与反击的刺客',
    lore: '精卫填海，以微躯抗巨涛。',
  },

  xuanyuan: {
    id: 'xuanyuan', name: '黄帝·轩辕', title: '文明之祖',
    tribe: 'huang', type: 'sage', rarity: 'SSR', rarityMult: 1.8,
    desc: '建造与科技的贤者',
    lore: '轩辕造宫室、制衣冠、创文字。',
  },
  houji: {
    id: 'houji', name: '后稷', title: '甲兵神将',
    tribe: 'huang', type: 'general', rarity: 'SR', rarityMult: 1.4,
    desc: '甲兵与血量的神将',
    lore: '后稷播百谷，为周之祖。',
  },
  fenghou: {
    id: 'fenghou', name: '风后', title: '八卦谋士',
    tribe: 'huang', type: 'strategist', rarity: 'SR', rarityMult: 1.4,
    desc: '阵型与行军的谋士',
    lore: '风后造指南车，破蚩尤大雾。',
  },

  chiyou: {
    id: 'chiyou', name: '蚩尤', title: '九黎之君',
    tribe: 'chi', type: 'general', rarity: 'SSR', rarityMult: 1.8,
    desc: '狂攻与吸血的神将',
    lore: '蚩尤铸铜为兵、威震天下，铜头铁额。',
  },
  kuafu: {
    id: 'kuafu', name: '夸父', title: '逐日之将',
    tribe: 'chi', type: 'tank', rarity: 'SR', rarityMult: 1.4,
    desc: '抗打与反击的坦克',
    lore: '夸父逐日，道渴而死，弃杖化为邓林。',
  },
  xingtian: {
    id: 'xingtian', name: '刑天', title: '不屈战神',
    tribe: 'chi', type: 'assassin', rarity: 'R', rarityMult: 1.0,
    desc: '越战越勇的刺客',
    lore: '刑天舞干戚，猛志固常在。',
  },
};

export const HERO_ORDER: HeroId[] = [
  'shennong', 'zhurong', 'jingwei',
  'xuanyuan', 'houji', 'fenghou',
  'chiyou', 'kuafu', 'xingtian',
];

// 英雄类型中文名 + emoji
export const HERO_TYPE_META: Record<HeroType, { name: string; icon: string }> = {
  sage: { name: '贤者', icon: '📜' },
  general: { name: '神将', icon: '⚔️' },
  assassin: { name: '刺客', icon: '🗡️' },
  tank: { name: '坦克', icon: '🛡️' },
  strategist: { name: '谋士', icon: '🪭' },
};

export const HERO_RARITY_META: Record<HeroRarity, { name: string; color: string; border: string }> = {
  R:   { name: '凡将', color: 'text-slate-500',   border: 'border-slate-300' },
  SR:  { name: '名将', color: 'text-blue-600',    border: 'border-blue-400' },
  SSR: { name: '神将', color: 'text-amber-600',   border: 'border-amber-500' },
};

// 英雄等级上限：SSR 80、SR 50、R 30（都不超过玩家满级 60，MVP 统一到 60）
export function heroLevelMax(rarity: HeroRarity): number {
  if (rarity === 'SSR') return 60;
  if (rarity === 'SR') return 50;
  return 30;
}

// 英雄三维系数：每级 0.3% 攻击 / 0.3% 防御 / 0.2% 速度（再乘稀有度）
const ATK_PER_LEVEL = 0.3;
const DEF_PER_LEVEL = 0.3;
const SPD_PER_LEVEL = 0.2;

// 玩家累计 exp → 英雄等级（受稀有度上限约束）
export function heroLevelFromExp(hero: HeroConfig, playerExp: number): number {
  const cap = heroLevelMax(hero.rarity);
  const lvl = resolveLevel(playerExp).level;
  return Math.min(lvl, cap);
}

// 计算英雄三维加成（百分比，如 15 = +15%）
export function heroStats(heroId: HeroId, playerExp: number, isGeneral: boolean) {
  const cfg = HERO_CONFIGS[heroId];
  const level = heroLevelFromExp(cfg, playerExp);
  const baseMult = isGeneral ? 1.0 : 0.5;
  const rarityMult = cfg.rarityMult;
  return {
    level,
    atkPct: +(level * ATK_PER_LEVEL * rarityMult * baseMult).toFixed(1),
    defPct: +(level * DEF_PER_LEVEL * rarityMult * baseMult).toFixed(1),
    speedPct: +(level * SPD_PER_LEVEL * rarityMult * baseMult).toFixed(1),
  };
}

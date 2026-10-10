import type { TribeType } from './types';

// 三大部落设定（对标 Travian 罗马/高卢/日耳曼，但中国上古神话背景）
// - 炎帝（火德）：神农氏，擅长农耕，粮食产量与容量加成
// - 黄帝（土德）：轩辕氏，擅长营造，建造速度加成
// - 蚩尤（金德）：九黎之君，擅长兵戈，士兵攻击与训练速度加成

export type TribeConfig = {
  id: TribeType;
  name: string;       // 部落名
  title: string;      // 族长称号
  emoji: string;
  color: string;      // 主题色（tailwind 类名片段）
  bgColor: string;    // 背景色
  desc: string;       // 一句话描述
  lore: string;       // 神话背景
  bonuses: string[];  // 被动加成描述
  unitName: string;   // 该部落基础兵种名
  unitEmoji: string;
  unitDesc: string;
};

export const TRIBE_CONFIGS: Record<TribeType, TribeConfig> = {
  yan: {
    id: 'yan',
    name: '炎帝部落',
    title: '神农氏',
    emoji: '🔥',
    color: 'red',
    bgColor: 'from-red-50 to-orange-50',
    desc: '火德之君，农耕始祖',
    lore: '炎帝神农氏，尝百草、教民稼穑，火德称王。其部众精于农耕，粟米满仓，为天下粮仓。',
    bonuses: [
      '🌾 粮食产量 +25%',
      '🏺 粮食容量 +20%',
    ],
    unitName: '神农卫士',
    unitEmoji: '🛡️',
    unitDesc: '炎帝部落的农耕勇士，持耒耜化戈，防御坚实，守土安民。',
  },
  huang: {
    id: 'huang',
    name: '黄帝部落',
    title: '轩辕氏',
    emoji: '⚡',
    color: 'amber',
    bgColor: 'from-amber-50 to-yellow-50',
    desc: '土德之君，文明之祖',
    lore: '黄帝轩辕氏，造宫室、制衣冠、创文字，土德称王。其部众善营造、百工兴旺，为华夏正统。',
    bonuses: [
      '🏗️ 建造速度 +20%',
      '📚 科技研发加成',
    ],
    unitName: '轩辕甲士',
    unitEmoji: '🗡️',
    unitDesc: '黄帝部落的精锐甲士，身披玄甲、手持玉戈，攻守兼备，征伐四方。',
  },
  chi: {
    id: 'chi',
    name: '蚩尤部落',
    title: '九黎之君',
    emoji: '🗡️',
    color: 'slate',
    bgColor: 'from-slate-100 to-zinc-100',
    desc: '金德之君，兵戈之主',
    lore: '蚩尤九黎之君，铸铜为兵、威震天下，金德称王。其部众剽悍善战、铜头铁额，为当世强军。',
    bonuses: [
      '🏹 士兵攻击 +25%',
      '🔥 训练速度 +20%',
    ],
    unitName: '蚩尤狂战',
    unitEmoji: '🔱',
    unitDesc: '蚩尤部落的狂战士，铜头铁额、以一当十，攻势凌厉，所向披靡。',
  },
};

export const TRIBE_ORDER: TribeType[] = ['yan', 'huang', 'chi'];

// 部落加成数值
export const TRIBE_BONUS = {
  yan:   { cropProduction: 1.25, cropCapacity: 1.20 },
  huang: { buildSpeed: 1.20 },
  chi:   { unitAttack: 1.25, trainSpeed: 1.20 },
} as const;

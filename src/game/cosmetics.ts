// 外观商城配置（纯外观，不影响任何数值 —— 反P2W核心）
// 所有外观只能用纹玉购买，纹玉只能通过游戏行为获得

export type CosmeticCategory = 'banner' | 'theme' | 'frame';

export type CosmeticConfig = {
  id: string;
  name: string;
  category: CosmeticCategory;
  emoji: string;
  desc: string;
  price: number; // 纹玉价格
  // 主题类外观影响的 CSS 变量
  cssVars?: Record<string, string>;
};

export const COSMETICS: CosmeticConfig[] = [
  // 部落旗帜
  { id: 'banner_default', name: '素色旗帜', category: 'banner', emoji: '🚩', desc: '部落的默认旗帜，朴实无华。', price: 0 },
  { id: 'banner_phoenix', name: '朱雀旗', category: 'banner', emoji: '🔥', desc: '火焰纹章的朱雀旗，象征炎帝火德。', price: 50 },
  { id: 'banner_dragon', name: '黄龙旗', category: 'banner', emoji: '🐉', desc: '黄龙盘绕的旗帜，象征黄帝土德。', price: 50 },
  { id: 'banner_tiger', name: '白虎旗', category: 'banner', emoji: '🐯', desc: '白虎獠牙的战旗，象征蚩尤金德。', price: 50 },
  { id: 'banner_qilin', name: '麒麟旗', category: 'banner', emoji: '🐲', desc: '瑞兽麒麟旗，传说中的王者之旗。', price: 120 },

  // 主题配色
  { id: 'theme_default', name: '洪荒原色', category: 'theme', emoji: '🎨', desc: '默认的洪荒主题配色。', price: 0 },
  { id: 'theme_night', name: '暗夜洪荒', category: 'theme', emoji: '🌙', desc: '深邃的暗夜主题，适合夜间游玩。', price: 80,
    cssVars: { '--bg-primary': '#0f172a', '--bg-secondary': '#1e293b', '--bg-card': '#1e293b', '--text-primary': '#e2e8f0', '--text-secondary': '#94a3b8', '--text-muted': '#64748b', '--border': '#334155', '--pop': '#38bdf8' } },
  { id: 'theme_spring', name: '春意盎然', category: 'theme', emoji: '🌸', desc: '春日清新的绿色主题。', price: 80,
    cssVars: { '--bg-primary': '#f0fdf4', '--bg-secondary': '#dcfce7', '--bg-card': '#ffffff', '--border': '#bbf7d0', '--pop': '#16a34a' } },
  { id: 'theme_gold', name: '金玉满堂', category: 'theme', emoji: '✨', desc: '华丽的金色主题，彰显尊贵。', price: 150,
    cssVars: { '--bg-primary': '#fffbeb', '--bg-secondary': '#fef3c7', '--bg-card': '#ffffff', '--border': '#fcd34d', '--pop': '#d97706', '--text-primary': '#78350f' } },

  // 头像框
  { id: 'frame_default', name: '原木边框', category: 'frame', emoji: '🖼️', desc: '朴素的木质边框。', price: 0 },
  { id: 'frame_bronze', name: '青铜边框', category: 'frame', emoji: '🏺', desc: '古朴的青铜纹饰边框。', price: 40 },
  { id: 'frame_jade', name: '翠玉边框', category: 'frame', emoji: '💚', desc: '温润如玉的翠玉边框。', price: 100 },
  { id: 'frame_gold', name: '赤金边框', category: 'frame', emoji: '👑', desc: '赤金打造的尊贵边框。', price: 180 },
];

export function getCosmetic(id: string | null): CosmeticConfig | undefined {
  if (!id) return undefined;
  return COSMETICS.find((c) => c.id === id);
}

// 反P2W：每日加速硬上限
export const DAILY_ACCEL_LIMIT = 3;
export const ACCEL_COST_JADE = 20; // 每次加速消耗纹玉
export const ACCEL_RATIO = 0.3; // 加速减少剩余时间比例

// 加速每日重置间隔（24小时）
export const ACCEL_RESET_INTERVAL_MS = 24 * 60 * 60 * 1000;

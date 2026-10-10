import { useEffect } from 'react';
import { getCosmetic } from '../game/cosmetics';
import { useGame } from '../store/gameStore';

// 外观应用器：根据已装备的主题，将 CSS 变量写入 :root，实现全局主题切换
// 旗帜和边框在 PlayerWorldBar 中渲染
export function CosmeticApplier() {
  const equippedCosmetics = useGame((s) => s.village.equippedCosmetics);

  useEffect(() => {
    const themeId = equippedCosmetics?.theme;
    const theme = getCosmetic(themeId);
    const root = document.documentElement;

    if (theme?.cssVars) {
      for (const [key, val] of Object.entries(theme.cssVars)) {
        root.style.setProperty(key, val);
      }
    } else {
      // 默认主题：清除自定义变量，回退到 index.css :root
      const defaultVars = ['--bg-primary', '--bg-secondary', '--bg-card', '--bg-card-hover', '--text-primary', '--text-secondary', '--text-muted', '--border', '--pop'];
      for (const v of defaultVars) root.style.removeProperty(v);
    }
  }, [equippedCosmetics?.theme]);

  return null;
}

export default CosmeticApplier;

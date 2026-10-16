// 英雄 SVG 立绘：3 套部落基础徽章 + 9 位英雄特色元素
// 所有 SVG 80×80，带 tribe 色环 + 特色元素叠层

import type { HeroId } from '../game/heroes';

type Props = {
  heroId: HeroId;
  size?: number;
  showRing?: boolean;   // 显示部落色环
  glow?: boolean;        // SSR/SR 稀有度光晕
  className?: string;
};

// 部落基础配色
const TRIBE_PALETTE: Record<string, { ring: string; ring2: string; bg: string; accent: string }> = {
  yan:   { ring: '#dc2626', ring2: '#fbbf24', bg: '#7f1d1d', accent: '#fde68a' }, // 炎帝 火红
  huang: { ring: '#d97706', ring2: '#fef3c7', bg: '#78350f', accent: '#fef3c7' }, // 黄帝 土黄
  chi:   { ring: '#334155', ring2: '#94a3b8', bg: '#1e293b', accent: '#fca5a5' }, // 蚩尤 黑金
};

export function HeroBadge({ heroId, size = 80, showRing = true, glow = false, className }: Props) {
  const tribe = heroTribe(heroId);
  const pal = TRIBE_PALETTE[tribe];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      className={className}
      style={glow ? { filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.6))' } : undefined}
    >
      {/* 部落色环（双层） */}
      {showRing && (
        <>
          <circle cx="40" cy="40" r="38" fill={pal.ring} stroke={pal.ring2} strokeWidth="2" />
          <circle cx="40" cy="40" r="34" fill={pal.bg} />
        </>
      )}

      {/* 英雄特色元素 —— 每个 id 独立画 */}
      {heroFeature(heroId, pal)}
    </svg>
  );
}

function heroTribe(id: HeroId): string {
  if (id === 'shennong' || id === 'zhurong' || id === 'jingwei') return 'yan';
  if (id === 'xuanyuan' || id === 'houji' || id === 'fenghou') return 'huang';
  return 'chi';
}

// 每位英雄独立的 SVG 特色层（相对坐标系 80×80，中心 40,40）
function heroFeature(id: HeroId, pal: { accent: string; ring: string; ring2: string }) {
  switch (id) {
    // ===== 炎帝部落（火德）=====
    case 'shennong': // 神农：耒耜 + 火焰光晕
      return (
        <g>
          <path d="M28 58 L40 24 L52 58 Z" fill="#92400e" stroke="#78350f" strokeWidth="1" />
          <rect x="37" y="22" width="6" height="20" fill="#b45309" />
          <circle cx="40" cy="18" r="4" fill={pal.accent} opacity="0.9" />
          <path d="M40 8 C36 14 44 14 40 20 C36 14 44 14 40 8" fill="#f97316" opacity="0.7" />
        </g>
      );
    case 'zhurong': // 祝融：朱雀羽翼 + 火戟
      return (
        <g>
          <path d="M40 20 L22 50 L40 44 L58 50 Z" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1" />
          <path d="M34 26 L40 14 L46 26" fill="#fbbf24" stroke="#92400e" strokeWidth="1" />
          <rect x="38" y="28" width="4" height="30" fill="#78350f" />
          <path d="M34 28 L42 28 L40 20 Z" fill="#f97316" />
          <circle cx="40" cy="62" r="3" fill="#fde68a" opacity="0.9" />
        </g>
      );
    case 'jingwei': // 精卫：青鸟斗篷 + 双刃
      return (
        <g>
          <ellipse cx="40" cy="38" rx="16" ry="20" fill="#0ea5e9" opacity="0.5" />
          <path d="M20 42 Q40 30 60 42 Q40 54 20 42 Z" fill="#0369a1" stroke="#075985" strokeWidth="1" />
          <circle cx="35" cy="32" r="2.5" fill="#fbbf24" />
          <circle cx="45" cy="32" r="2.5" fill="#fbbf24" />
          <rect x="14" y="34" width="20" height="2" fill="#94a3b8" transform="rotate(-20 24 35)" />
          <rect x="46" y="34" width="20" height="2" fill="#94a3b8" transform="rotate(20 56 35)" />
        </g>
      );

    // ===== 黄帝部落（土德）=====
    case 'xuanyuan': // 轩辕：玉圭 + 黄龙
      return (
        <g>
          <rect x="36" y="20" width="8" height="32" rx="2" fill="#fef3c7" stroke="#92400e" strokeWidth="1" />
          <circle cx="40" cy="24" r="2" fill="#10b981" />
          <path d="M40 56 C30 60 20 54 18 46 C24 52 32 52 40 50 C48 48 56 48 62 52 C58 48 50 44 40 46" fill="#d97706" opacity="0.8" stroke="#92400e" strokeWidth="0.8" />
        </g>
      );
    case 'houji': // 后稷：玄甲 + 玉戈
      return (
        <g>
          <path d="M26 34 L40 22 L54 34 L54 58 L26 58 Z" fill="#57534e" stroke="#292524" strokeWidth="1.2" />
          <path d="M32 38 L40 32 L48 38" fill="none" stroke="#fef3c7" strokeWidth="1.2" />
          <rect x="38" y="14" width="4" height="30" fill="#78350f" />
          <path d="M30 16 L46 16 L44 22 L32 22 Z" fill="#94a3b8" stroke="#44403c" strokeWidth="0.8" />
        </g>
      );
    case 'fenghou': // 风后：羽扇 + 八卦
      return (
        <g>
          <path d="M18 58 Q40 10 62 58" fill="#fef3c7" stroke="#92400e" strokeWidth="1" />
          <path d="M26 58 Q40 22 54 58" fill="none" stroke="#92400e" strokeWidth="0.6" />
          <circle cx="40" cy="54" r="10" fill="none" stroke="#fbbf24" strokeWidth="1" strokeDasharray="1,1" />
          <circle cx="40" cy="54" r="2" fill="#1f2937" />
        </g>
      );

    // ===== 蚩尤部落（金德）=====
    case 'chiyou': // 蚩尤：铜头 + 战斧 + 白虎纹
      return (
        <g>
          <circle cx="40" cy="32" r="14" fill="#475569" stroke="#1e293b" strokeWidth="1.5" />
          <rect x="32" y="22" width="16" height="3" fill="#dc2626" />
          <path d="M28 38 L32 42 L36 38 M44 38 L48 42 L52 38" stroke="#fca5a5" strokeWidth="1.5" fill="none" />
          <rect x="54" y="20" width="12" height="28" fill="#64748b" stroke="#1e293b" strokeWidth="1" />
          <circle cx="40" cy="58" r="4" fill="#fca5a5" opacity="0.6" />
        </g>
      );
    case 'kuafu': // 夸父：重盾 + 逐日之靴
      return (
        <g>
          <path d="M22 24 L40 14 L58 24 L58 58 Q40 70 22 58 Z" fill="#78350f" stroke="#431407" strokeWidth="1.5" />
          <circle cx="40" cy="38" r="10" fill="#fbbf24" stroke="#92400e" strokeWidth="1" />
          <circle cx="40" cy="38" r="5" fill="#f97316" />
          <path d="M22 60 L30 64 M58 60 L50 64" stroke="#44403c" strokeWidth="2" />
        </g>
      );
    case 'xingtian': // 刑天：无头 + 干戚（斧盾）
      return (
        <g>
          <path d="M30 34 L50 34 L52 60 L28 60 Z" fill="#7c2d12" stroke="#431407" strokeWidth="1" />
          <ellipse cx="36" cy="40" rx="1" ry="2" fill="#fef3c7" />
          <ellipse cx="44" cy="40" rx="1" ry="2" fill="#fef3c7" />
          <path d="M36 44 L44 44 M34 48 L46 48" stroke="#fef3c7" strokeWidth="0.8" />
          <rect x="52" y="30" width="8" height="30" fill="#44403c" />
          <path d="M52 30 L60 30 L56 24 Z" fill="#dc2626" />
          <path d="M14 30 L22 30 L22 60 L14 60 Z" fill="#64748b" stroke="#1e293b" strokeWidth="1" />
        </g>
      );
  }
}

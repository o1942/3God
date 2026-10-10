import type { ReactElement } from 'react';
import type { BuildingType } from './types';

/**
 * 建筑立绘（纯 SVG 内联，无外部图片）
 * 统一风格：上古洪荒 · 夯土木石结构 · 等距视角
 * 所有立绘 viewBox="0 0 120 120"，透明背景，可任意缩放
 */

type ArtProps = { className?: string };

// ========== 封禅台（mainBuilding） ==========
// 夯土三层台基 + 顶部燔柴祭火 + 四隅玉柱
export function MainBuildingArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* 燔柴火焰渐变 */}
        <radialGradient id="mb-fire" cx="50%" cy="60%" r="60%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="40%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#b91c1c" />
        </radialGradient>
        {/* 夯土台面渐变（顶亮侧暗，模拟光照） */}
        <linearGradient id="mb-earth-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="mb-earth-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#92400e" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <linearGradient id="mb-earth-side2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#78350f" />
          <stop offset="100%" stopColor="#a16207" />
        </linearGradient>
      </defs>

      {/* 地面投影 */}
      <ellipse cx="60" cy="108" rx="44" ry="6" fill="#000" opacity="0.28" />

      {/* 第一层台基（最底层） */}
      {/* 顶面 */}
      <polygon points="20,64 60,52 100,64 60,76" fill="url(#mb-earth-top)" stroke="#78350f" strokeWidth="0.8" />
      {/* 左侧面 */}
      <polygon points="20,64 20,84 60,96 60,76" fill="url(#mb-earth-side)" stroke="#78350f" strokeWidth="0.8" />
      {/* 右侧面 */}
      <polygon points="100,64 100,84 60,96 60,76" fill="url(#mb-earth-side2)" stroke="#78350f" strokeWidth="0.8" />
      {/* 夯土层理线 */}
      <line x1="22" y1="71" x2="58" y2="82" stroke="#78350f" strokeWidth="0.6" opacity="0.5" />
      <line x1="62" y1="82" x2="98" y2="71" stroke="#78350f" strokeWidth="0.6" opacity="0.5" />

      {/* 第二层台基 */}
      <polygon points="30,48 60,38 90,48 60,58" fill="url(#mb-earth-top)" stroke="#78350f" strokeWidth="0.8" />
      <polygon points="30,48 30,62 60,72 60,58" fill="url(#mb-earth-side)" stroke="#78350f" strokeWidth="0.8" />
      <polygon points="90,48 90,62 60,72 60,58" fill="url(#mb-earth-side2)" stroke="#78350f" strokeWidth="0.8" />

      {/* 第三层台基（顶层，燔柴台） */}
      <polygon points="40,32 60,25 80,32 60,39" fill="url(#mb-earth-top)" stroke="#78350f" strokeWidth="0.8" />
      <polygon points="40,32 40,44 60,51 60,39" fill="url(#mb-earth-side)" stroke="#78350f" strokeWidth="0.8" />
      <polygon points="80,32 80,44 60,51 60,39" fill="url(#mb-earth-side2)" stroke="#78350f" strokeWidth="0.8" />

      {/* 四隅玉柱（祭天礼器） */}
      {[
        { x: 42, y: 30 }, { x: 78, y: 30 },
        { x: 48, y: 22 }, { x: 72, y: 22 },
      ].map((p, i) => (
        <g key={i}>
          <rect x={p.x - 1.5} y={p.y - 12} width="3" height="12" rx="1" fill="#0ea5e9" stroke="#0369a1" strokeWidth="0.5" />
          <circle cx={p.x} cy={p.y - 12} r="2" fill="#38bdf8" stroke="#0369a1" strokeWidth="0.4" />
        </g>
      ))}

      {/* 燔柴祭火 */}
      {/* 柴薪堆 */}
      <ellipse cx="60" cy="26" rx="11" ry="3.5" fill="#78350f" stroke="#451a03" strokeWidth="0.6" />
      <path d="M52 25 L60 18 L68 25 Z" fill="#92400e" stroke="#451a03" strokeWidth="0.5" />
      <path d="M54 26 L60 20 L66 26 Z" fill="#b45309" stroke="#451a03" strokeWidth="0.5" />
      {/* 火焰 */}
      <path d="M60 8 C54 14 52 18 55 22 C57 20 58 21 60 19 C62 21 63 20 65 22 C68 18 66 14 60 8 Z" fill="url(#mb-fire)" />
      <path d="M60 12 C56 16 55 19 57 21 C59 20 60 21 60 19 C60 21 61 20 63 21 C65 19 64 16 60 12 Z" fill="#fef3c7" opacity="0.8" />

      {/* 袅袅青烟（祭天） */}
      <path d="M58 6 C54 2 56 -1 58 -4" stroke="#a8a29e" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5" />
      <path d="M62 5 C66 1 64 -2 62 -5" stroke="#a8a29e" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.4" />
      <path d="M60 4 C60 0 58 -2 60 -5" stroke="#d6d3d1" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

// ========== 城墙（wall）· 详情面板立绘 ==========
// 一段带敌楼的城墙截面：垛口 + 中央敌楼 + 城门
export function WallArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="wall-stone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a8a29e" />
          <stop offset="100%" stopColor="#57534e" />
        </linearGradient>
        <linearGradient id="wall-stone-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#78716c" />
          <stop offset="100%" stopColor="#44403c" />
        </linearGradient>
        <linearGradient id="wall-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b91c1c" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </linearGradient>
      </defs>

      {/* 地面投影 */}
      <ellipse cx="60" cy="108" rx="50" ry="5" fill="#000" opacity="0.25" />

      {/* 城墙主体（横向石墙） */}
      <rect x="8" y="62" width="104" height="38" fill="url(#wall-stone)" stroke="#44403c" strokeWidth="1" />
      {/* 石砖纹理 */}
      {[0, 1, 2, 3].map((row) => (
        <g key={row}>
          {[0, 1, 2, 3, 4, 5, 6].map((col) => {
            const offset = row % 2 === 0 ? 0 : 7.5;
            return (
              <rect
                key={col}
                x={8 + col * 15 + offset}
                y={64 + row * 9}
                width="14"
                height="8"
                fill="none"
                stroke="#57534e"
                strokeWidth="0.4"
                opacity="0.6"
              />
            );
          })}
        </g>
      ))}

      {/* 垛口（墙顶齿状） */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
        <rect
          key={i}
          x={8 + i * 8}
          y={56}
          width="5"
          height="8"
          fill="url(#wall-stone)"
          stroke="#44403c"
          strokeWidth="0.6"
        />
      ))}

      {/* 中央敌楼 */}
      <rect x="46" y="30" width="28" height="36" fill="url(#wall-stone-dark)" stroke="#292524" strokeWidth="1" />
      {/* 敌楼砖纹 */}
      {[0, 1, 2].map((row) => (
        <line key={row} x1="46" y1={38 + row * 10} x2="74" y2={38 + row * 10} stroke="#292524" strokeWidth="0.4" opacity="0.5" />
      ))}
      {/* 敌楼箭窗 */}
      <rect x="56" y="42" width="8" height="10" rx="1" fill="#1c1917" stroke="#0c0a09" strokeWidth="0.5" />
      {/* 敌楼垛口 */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={46 + i * 7} y={24} width="4" height="7" fill="url(#wall-stone-dark)" stroke="#292524" strokeWidth="0.5" />
      ))}
      {/* 敌楼顶（红色飞檐） */}
      <polygon points="42,24 78,24 74,18 46,18" fill="url(#wall-roof)" stroke="#7f1d1d" strokeWidth="0.6" />
      <polygon points="44,18 76,18 72,13 48,13" fill="#dc2626" opacity="0.8" />

      {/* 城门（拱形） */}
      <path d="M52 100 L52 82 Q60 70 68 82 L68 100 Z" fill="#451a03" stroke="#1c1917" strokeWidth="1" />
      {/* 城门木纹 */}
      <line x1="60" y1="74" x2="60" y2="100" stroke="#1c1917" strokeWidth="0.8" />
      <line x1="55" y1="88" x2="65" y2="88" stroke="#1c1917" strokeWidth="0.5" opacity="0.6" />
      {/* 门钉 */}
      <circle cx="55" cy="84" r="0.8" fill="#fbbf24" />
      <circle cx="65" cy="84" r="0.8" fill="#fbbf24" />
      <circle cx="55" cy="94" r="0.8" fill="#fbbf24" />
      <circle cx="65" cy="94" r="0.8" fill="#fbbf24" />
    </svg>
  );
}

// ========== 城墙环（wall）· 地图环绕层 ==========
// 沿着村落实景地图边缘的城墙环，随等级进化：夯土→石砌→包石→铜墙铁壁
// viewBox 100 x 56.25 对应 16:9 地图，preserveAspectRatio="none" 拉伸填充
type WallRingProps = { level: number; className?: string; onClick?: () => void };
export function WallRing({ level, className, onClick }: WallRingProps) {
  // 等级分段决定材质
  const tier = level >= 16 ? 4 : level >= 11 ? 3 : level >= 6 ? 2 : level >= 1 ? 1 : 0;
  const palette = [
    { wall: '#a16207', wallTop: '#ca8a04', merlon: '#854d0e', glow: 'rgba(161,98,7,0.3)' },   // 0 未建
    { wall: '#a16207', wallTop: '#ca8a04', merlon: '#854d0e', glow: 'rgba(161,98,7,0.35)' },  // 1 夯土
    { wall: '#78716c', wallTop: '#a8a29e', merlon: '#57534e', glow: 'rgba(120,113,108,0.4)' },// 2 石砌
    { wall: '#44403c', wallTop: '#78716c', merlon: '#292524', glow: 'rgba(68,64,60,0.5)' },   // 3 包石
    { wall: '#1c1917', wallTop: '#57534e', merlon: '#0c0a09', glow: 'rgba(251,191,36,0.5)' },// 4 铜墙铁壁
  ][tier];

  const cx = 50;
  const cy = 28.125;
  const rx = 46;
  const ry = 23.5;
  // 墙体厚度随等级增长
  const thickness = 1.4 + level * 0.28;
  // 垛口数量随等级增长
  const merlonCount = 14 + Math.floor(level * 1.2);
  const merlonLen = (2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2)) / (merlonCount * 2);
  const hasTowers = level >= 11;
  const hasGold = level >= 16;

  return (
    <svg
      viewBox="0 0 100 56.25"
      preserveAspectRatio="none"
      className={className}
      onClick={onClick}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id={`wall-glow-${tier}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={tier >= 3 ? '1.2' : '0.6'} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 墙体主体（厚描边椭圆） */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="none"
        stroke={palette.wall}
        strokeWidth={thickness}
        filter={`url(#wall-glow-${tier})`}
      />
      {/* 墙体顶面亮色（内圈细描边模拟光照） */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="none"
        stroke={palette.wallTop}
        strokeWidth={Math.max(0.4, thickness * 0.25)}
        opacity="0.7"
      />

      {/* 垛口（用 dasharray 在椭圆上做出齿状） */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="none"
        stroke={palette.merlon}
        strokeWidth={thickness + 1.2}
        strokeDasharray={`${merlonLen} ${merlonLen}`}
        opacity="0.9"
      />

      {/* 四角敌楼（Lv>=11） */}
      {hasTowers && [
        { x: cx, y: cy - ry },       // 北
        { x: cx + rx, y: cy },       // 东
        { x: cx, y: cy + ry },       // 南
        { x: cx - rx, y: cy },       // 西
      ].map((t, i) => (
        <g key={i} transform={`translate(${t.x},${t.y})`}>
          <rect x={-2.2} y={-2.2} width="4.4" height="4.4" fill={palette.merlon} stroke={hasGold ? '#fbbf24' : 'none'} strokeWidth={hasGold ? 0.3 : 0} />
          {hasGold && <circle cx="0" cy="0" r="0.6" fill="#fbbf24" />}
        </g>
      ))}

      {/* 高等级铜钉装饰（Lv>=16） */}
      {hasGold && (
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill="none"
          stroke="#fbbf24"
          strokeWidth="0.3"
          strokeDasharray="0.5 3"
          opacity="0.6"
        />
      )}
    </svg>
  );
}

// ========== 仓廪（warehouse） ==========
// 夯土储物屋 + 茅草顶 + 门口陶罐
export function WarehouseArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="wh-earth" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d97706"/><stop offset="100%" stopColor="#92400e"/></linearGradient>
        <linearGradient id="wh-thatch" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a16207"/><stop offset="100%" stopColor="#713f12"/></linearGradient>
      </defs>
      <ellipse cx="60" cy="106" rx="46" ry="6" fill="#000" opacity="0.25"/>
      {/* 台基 */}
      <polygon points="18,82 60,72 102,82 60,92" fill="#78350f" stroke="#451a03" strokeWidth="0.8"/>
      {/* 屋身（夯土） */}
      <polygon points="24,82 60,72 96,82 60,92" fill="url(#wh-earth)" stroke="#78350f" strokeWidth="0.8"/>
      <polygon points="24,82 24,98 60,108 60,92" fill="#78350f" stroke="#451a03" strokeWidth="0.8"/>
      <polygon points="96,82 96,98 60,108 60,92" fill="#92400e" stroke="#451a03" strokeWidth="0.8"/>
      {/* 茅草顶（四坡顶） */}
      <polygon points="18,72 60,52 102,72 60,82" fill="url(#wh-thatch)" stroke="#451a03" strokeWidth="0.8"/>
      <polygon points="60,52 102,72 60,82" fill="#713f12" opacity="0.6"/>
      {/* 茅草纹理 */}
      <path d="M30 68 L42 60" stroke="#451a03" strokeWidth="0.5" opacity="0.4"/>
      <path d="M90 68 L78 60" stroke="#451a03" strokeWidth="0.5" opacity="0.4"/>
      {/* 门 */}
      <rect x="54" y="84" width="12" height="16" fill="#451a03" stroke="#1c1917" strokeWidth="0.6"/>
      {/* 门口陶罐 */}
      <ellipse cx="34" cy="96" rx="5" ry="4" fill="#b45309" stroke="#78350f" strokeWidth="0.5"/>
      <ellipse cx="34" cy="92" rx="3" ry="1.5" fill="#92400e"/>
      <ellipse cx="86" cy="96" rx="5" ry="4" fill="#b45309" stroke="#78350f" strokeWidth="0.5"/>
      <ellipse cx="86" cy="92" rx="3" ry="1.5" fill="#92400e"/>
      {/* 原木堆（木材） */}
      <rect x="20" y="98" width="10" height="3" rx="1" fill="#92400e"/>
      <rect x="20" y="102" width="10" height="3" rx="1" fill="#78350f"/>
    </svg>
  );
}

// ========== 粟仓（granary） ==========
// 高架干栏式粮仓 + 粟穗
export function GranaryArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gr-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d97706"/><stop offset="100%" stopColor="#92400e"/></linearGradient>
        <linearGradient id="gr-thatch" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ca8a04"/><stop offset="100%" stopColor="#854d0e"/></linearGradient>
      </defs>
      <ellipse cx="60" cy="108" rx="44" ry="5" fill="#000" opacity="0.25"/>
      {/* 四根支柱（高架防潮） */}
      <rect x="26" y="78" width="4" height="26" fill="#78350f" stroke="#451a03" strokeWidth="0.4"/>
      <rect x="90" y="78" width="4" height="26" fill="#78350f" stroke="#451a03" strokeWidth="0.4"/>
      <rect x="40" y="82" width="3" height="22" fill="#78350f" stroke="#451a03" strokeWidth="0.3" opacity="0.7"/>
      <rect x="77" y="82" width="3" height="22" fill="#78350f" stroke="#451a03" strokeWidth="0.3" opacity="0.7"/>
      {/* 仓身（木板围合） */}
      <rect x="24" y="56" width="72" height="24" fill="url(#gr-wood)" stroke="#78350f" strokeWidth="0.8"/>
      {[0,1,2,3,4,5].map(i => (
        <line key={i} x1={30 + i*12} y1="56" x2={30 + i*12} y2="80" stroke="#78350f" strokeWidth="0.5" opacity="0.5"/>
      ))}
      {/* 通风窗 */}
      <rect x="54" y="62" width="12" height="8" fill="#1c1917" stroke="#451a03" strokeWidth="0.5"/>
      <line x1="60" y1="62" x2="60" y2="70" stroke="#451a03" strokeWidth="0.4"/>
      <line x1="54" y1="66" x2="66" y2="66" stroke="#451a03" strokeWidth="0.4"/>
      {/* 茅草顶（庑殿顶） */}
      <polygon points="18,56 60,34 102,56 60,66" fill="url(#gr-thatch)" stroke="#713f12" strokeWidth="0.8"/>
      <polygon points="60,34 102,56 60,66" fill="#713f12" opacity="0.5"/>
      {/* 粟穗（金色谷穗挂在檐下） */}
      <path d="M30 58 Q30 66 32 72" stroke="#fbbf24" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <ellipse cx="32" cy="72" rx="2" ry="4" fill="#facc15"/>
      <path d="M90 58 Q90 66 88 72" stroke="#fbbf24" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <ellipse cx="88" cy="72" rx="2" ry="4" fill="#facc15"/>
      <path d="M60 56 Q60 64 60 70" stroke="#fbbf24" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <ellipse cx="60" cy="70" rx="2.5" ry="5" fill="#fde047"/>
    </svg>
  );
}

// ========== 秘窖（cranny） ==========
// 半埋地下石窖 + 伪装石板盖
export function CrannyArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cr-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#78716c"/><stop offset="100%" stopColor="#44403c"/></linearGradient>
        <linearGradient id="cr-dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#292524"/><stop offset="100%" stopColor="#1c1917"/></linearGradient>
      </defs>
      <ellipse cx="60" cy="108" rx="46" ry="5" fill="#000" opacity="0.2"/>
      {/* 地面 */}
      <ellipse cx="60" cy="92" rx="50" ry="10" fill="#57534e" opacity="0.4"/>
      {/* 窖口（石砌圆口） */}
      <ellipse cx="60" cy="70" rx="32" ry="14" fill="url(#cr-stone)" stroke="#292524" strokeWidth="1"/>
      <ellipse cx="60" cy="70" rx="26" ry="10" fill="url(#cr-dark)" stroke="#0c0a09" strokeWidth="0.6"/>
      {/* 石砌窖壁纹路 */}
      {[0,1,2,3,4,5,6,7].map(i => {
        const a = (i / 8) * Math.PI * 2;
        return <circle key={i} cx={60 + Math.cos(a)*29} cy={70 + Math.sin(a)*12} r="2.5" fill="#57534e" stroke="#292524" strokeWidth="0.4"/>;
      })}
      {/* 石板盖（半开） */}
      <ellipse cx="48" cy="64" rx="16" ry="7" fill="#a8a29e" stroke="#57534e" strokeWidth="0.8" transform="rotate(-12 48 64)"/>
      <ellipse cx="48" cy="63" rx="14" ry="5.5" fill="#d6d3d1" opacity="0.5"/>
      {/* 铁链 */}
      <path d="M64 64 Q72 58 78 52" stroke="#78716c" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      {/* 内部微光（暗示藏有资源） */}
      <ellipse cx="60" cy="72" rx="10" ry="4" fill="#fbbf24" opacity="0.15"/>
      {/* 伪装草丛 */}
      <path d="M22 88 L24 80 L26 88" fill="#65a30d" stroke="#3f6212" strokeWidth="0.4"/>
      <path d="M94 88 L96 80 L98 88" fill="#65a30d" stroke="#3f6212" strokeWidth="0.4"/>
      <path d="M30 90 L31 84 L32 90" fill="#65a30d" stroke="#3f6212" strokeWidth="0.3" opacity="0.7"/>
    </svg>
  );
}

// ========== 点将台（rallyPoint） ==========
// 夯土点将台 + 高杆旗帜 + 部众
export function RallyPointArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="rp-earth" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b45309"/><stop offset="100%" stopColor="#78350f"/></linearGradient>
        <linearGradient id="rp-flag" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#dc2626"/><stop offset="100%" stopColor="#991b1b"/></linearGradient>
      </defs>
      <ellipse cx="60" cy="108" rx="48" ry="5" fill="#000" opacity="0.25"/>
      {/* 台基（两层） */}
      <polygon points="22,90 60,80 98,90 60,100" fill="#78350f" stroke="#451a03" strokeWidth="0.8"/>
      <polygon points="30,76 60,66 90,76 60,86" fill="url(#rp-earth)" stroke="#78350f" strokeWidth="0.8"/>
      <polygon points="30,76 30,90 60,100 60,86" fill="#78350f" stroke="#451a03" strokeWidth="0.8"/>
      <polygon points="90,76 90,90 60,100 60,86" fill="#92400e" stroke="#451a03" strokeWidth="0.8"/>
      {/* 旗杆 */}
      <rect x="59" y="14" width="2" height="56" fill="#451a03" stroke="#1c1917" strokeWidth="0.4"/>
      {/* 旗帜（红） */}
      <path d="M61 16 L90 20 L61 32 Z" fill="url(#rp-flag)" stroke="#7f1d1d" strokeWidth="0.5"/>
      <path d="M61 34 L84 37 L61 46 Z" fill="#dc2626" opacity="0.8" stroke="#7f1d1d" strokeWidth="0.4"/>
      {/* 旗杆顶珠 */}
      <circle cx="60" cy="14" r="2.5" fill="#fbbf24" stroke="#b45309" strokeWidth="0.5"/>
      {/* 台上将领（小人） */}
      <circle cx="60" cy="62" r="3" fill="#fde68a" stroke="#92400e" strokeWidth="0.4"/>
      <rect x="57" y="65" width="6" height="8" fill="#7f1d1d" stroke="#450a0a" strokeWidth="0.4"/>
      {/* 台下两侧部众 */}
      <circle cx="38" cy="84" r="2.5" fill="#fde68a" stroke="#92400e" strokeWidth="0.3"/>
      <rect x="36" y="86" width="4" height="6" fill="#b45309" stroke="#451a03" strokeWidth="0.3"/>
      <circle cx="82" cy="84" r="2.5" fill="#fde68a" stroke="#92400e" strokeWidth="0.3"/>
      <rect x="80" y="86" width="4" height="6" fill="#b45309" stroke="#451a03" strokeWidth="0.3"/>
    </svg>
  );
}

// ========== 军帐（barracks） ==========
// 大型军帐 + 交叉兵器
export function BarracksArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ba-tent" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#65a30d"/><stop offset="100%" stopColor="#3f6212"/></linearGradient>
        <linearGradient id="ba-tent-dark" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#3f6212"/><stop offset="100%" stopColor="#1a2e05"/></linearGradient>
      </defs>
      <ellipse cx="60" cy="106" rx="48" ry="6" fill="#000" opacity="0.25"/>
      {/* 军帐主体（等腰三角帐篷） */}
      <polygon points="16,100 60,32 104,100" fill="url(#ba-tent)" stroke="#1a2e05" strokeWidth="1"/>
      <polygon points="60,32 104,100 60,100" fill="url(#ba-tent-dark)" opacity="0.6"/>
      {/* 帐篷纹路（竖向） */}
      {[0,1,2,3,4].map(i => (
        <line key={i} x1={30 + i*15} y1="100" x2={60} y2="32" stroke="#1a2e05" strokeWidth="0.4" opacity="0.3"/>
      ))}
      {/* 帐门 */}
      <path d="M50 100 L60 50 L70 100 Z" fill="#1a2e05" stroke="#052e16" strokeWidth="0.6"/>
      <path d="M50 100 L60 50 L60 100 Z" fill="#3f6212" opacity="0.5"/>
      {/* 帐顶飘带 */}
      <rect x="59" y="20" width="2" height="14" fill="#451a03"/>
      <path d="M61 22 L75 25 L61 30 Z" fill="#dc2626" stroke="#7f1d1d" strokeWidth="0.4"/>
      {/* 左侧交叉长矛 */}
      <line x1="18" y1="98" x2="38" y2="40" stroke="#78350f" strokeWidth="2" strokeLinecap="round"/>
      <polygon points="38,40 34,46 42,46" fill="#a8a29e" stroke="#44403c" strokeWidth="0.5"/>
      <line x1="38" y1="98" x2="18" y2="40" stroke="#78350f" strokeWidth="2" strokeLinecap="round"/>
      <polygon points="18,40 14,46 22,46" fill="#a8a29e" stroke="#44403c" strokeWidth="0.5"/>
      {/* 右侧弓 */}
      <path d="M100 60 Q108 70 100 90" fill="none" stroke="#78350f" strokeWidth="2"/>
      <line x1="100" y1="60" x2="100" y2="90" stroke="#d6d3d1" strokeWidth="0.6"/>
    </svg>
  );
}

// ========== 会盟台（embassy） ==========
// 双旗会盟台 + 握手礼器
export function EmbassyArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="em-earth" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7"/><stop offset="100%" stopColor="#6b21a8"/></linearGradient>
        <linearGradient id="em-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a8a29e"/><stop offset="100%" stopColor="#57534e"/></linearGradient>
      </defs>
      <ellipse cx="60" cy="106" rx="48" ry="6" fill="#000" opacity="0.25"/>
      {/* 石质台基 */}
      <polygon points="20,88 60,78 100,88 60,98" fill="url(#em-stone)" stroke="#44403c" strokeWidth="0.8"/>
      <polygon points="20,88 20,98 60,108 60,98" fill="#57534e" stroke="#44403c" strokeWidth="0.8"/>
      <polygon points="100,88 100,98 60,108 60,98" fill="#78716c" stroke="#44403c" strokeWidth="0.8"/>
      {/* 中央礼器（玉琮/鼎） */}
      <rect x="50" y="60" width="20" height="18" fill="#0ea5e9" stroke="#0369a1" strokeWidth="0.8" rx="2"/>
      <rect x="52" y="56" width="16" height="6" fill="#38bdf8" stroke="#0369a1" strokeWidth="0.5" rx="1"/>
      <rect x="54" y="52" width="12" height="5" fill="#7dd3fc" stroke="#0369a1" strokeWidth="0.4" rx="1"/>
      {/* 左旗（炎帝-红） */}
      <rect x="29" y="30" width="2" height="50" fill="#451a03"/>
      <path d="M31 32 L50 36 L31 46 Z" fill="#dc2626" stroke="#7f1d1d" strokeWidth="0.4"/>
      {/* 右旗（黄帝-黄） */}
      <rect x="89" y="30" width="2" height="50" fill="#451a03"/>
      <path d="M89 32 L70 36 L89 46 Z" fill="#fbbf24" stroke="#b45309" strokeWidth="0.4"/>
      {/* 两旗顶端珠 */}
      <circle cx="30" cy="30" r="2" fill="#fbbf24"/>
      <circle cx="90" cy="30" r="2" fill="#fbbf24"/>
      {/* 台下两侧部众（会盟者） */}
      <circle cx="34" cy="82" r="2.5" fill="#fde68a" stroke="#92400e" strokeWidth="0.3"/>
      <rect x="32" y="84" width="4" height="6" fill="#7c2d12" stroke="#451a03" strokeWidth="0.3"/>
      <circle cx="86" cy="82" r="2.5" fill="#fde68a" stroke="#92400e" strokeWidth="0.3"/>
      <rect x="84" y="84" width="4" height="6" fill="#7c2d12" stroke="#451a03" strokeWidth="0.3"/>
    </svg>
  );
}

// ========== 集市（market） ==========
// 遮阳棚摊位 + 钱币货物
export function MarketArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mk-awning" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0ea5e9"/><stop offset="100%" stopColor="#0369a1"/></linearGradient>
        <linearGradient id="mk-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b45309"/><stop offset="100%" stopColor="#78350f"/></linearGradient>
      </defs>
      <ellipse cx="60" cy="106" rx="48" ry="6" fill="#000" opacity="0.22"/>
      {/* 木支架 */}
      <rect x="24" y="56" width="4" height="44" fill="url(#mk-wood)" stroke="#451a03" strokeWidth="0.5"/>
      <rect x="92" y="56" width="4" height="44" fill="url(#mk-wood)" stroke="#451a03" strokeWidth="0.5"/>
      {/* 遮阳棚（蓝白条纹） */}
      <polygon points="18,56 60,42 102,56 60,66" fill="url(#mk-awning)" stroke="#0c4a6e" strokeWidth="0.8"/>
      {[0,1,2,3,4].map(i => (
        <polygon key={i} points={`${22 + i*16},52 ${30 + i*16},49 ${30 + i*16},57 ${22 + i*16},60`} fill="#f0f9ff" opacity="0.4"/>
      ))}
      {/* 棚顶流苏 */}
      <path d="M18 56 L22 62 M34 54 L36 60 M50 50 L52 56 M66 50 L68 56 M82 54 L84 60 M98 56 L102 62" stroke="#0369a1" strokeWidth="1" strokeLinecap="round"/>
      {/* 货台 */}
      <rect x="26" y="78" width="68" height="22" fill="url(#mk-wood)" stroke="#451a03" strokeWidth="0.8"/>
      <rect x="26" y="78" width="68" height="4" fill="#d97706"/>
      {/* 货物：陶罐 */}
      <ellipse cx="38" cy="82" rx="5" ry="6" fill="#b45309" stroke="#78350f" strokeWidth="0.5"/>
      <ellipse cx="38" cy="77" rx="3" ry="1.5" fill="#92400e"/>
      {/* 货物：铜锭 */}
      <rect x="52" y="78" width="12" height="6" fill="#ca8a04" stroke="#854d0e" strokeWidth="0.5" rx="1"/>
      <rect x="54" y="86" width="8" height="5" fill="#a16207" stroke="#854d0e" strokeWidth="0.4" rx="0.5"/>
      {/* 货物：钱币 */}
      <circle cx="76" cy="82" r="4" fill="#fbbf24" stroke="#b45309" strokeWidth="0.5"/>
      <rect x="74.5" y="80.5" width="3" height="3" fill="#b45309"/>
      <circle cx="86" cy="85" r="3.5" fill="#fbbf24" stroke="#b45309" strokeWidth="0.5"/>
      <rect x="84.8" y="83.8" width="2.4" height="2.4" fill="#b45309"/>
      {/* 招牌旗 */}
      <rect x="60" y="20" width="2" height="26" fill="#451a03"/>
      <rect x="52" y="22" width="16" height="10" fill="#fef3c7" stroke="#92400e" strokeWidth="0.5"/>
      <text x="60" y="30" textAnchor="middle" fontSize="7" fill="#92400e" fontWeight="bold">市</text>
    </svg>
  );
}

// ========== 铸铜坊（smithy） ==========
// 石砌熔炉 + 铁砧 + 锤 + 火焰
export function SmithyArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="sm-fire" cx="50%" cy="60%" r="60%">
          <stop offset="0%" stopColor="#fde68a"/><stop offset="40%" stopColor="#f97316"/><stop offset="100%" stopColor="#b91c1c"/>
        </radialGradient>
        <linearGradient id="sm-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#78716c"/><stop offset="100%" stopColor="#44403c"/></linearGradient>
      </defs>
      <ellipse cx="60" cy="106" rx="48" ry="6" fill="#000" opacity="0.25"/>
      {/* 熔炉（石砌墩） */}
      <rect x="30" y="56" width="28" height="40" fill="url(#sm-stone)" stroke="#292524" strokeWidth="0.8"/>
      <rect x="30" y="56" width="28" height="6" fill="#a8a29e"/>
      {/* 石砖纹 */}
      <line x1="30" y1="72" x2="58" y2="72" stroke="#292524" strokeWidth="0.4" opacity="0.5"/>
      <line x1="30" y1="86" x2="58" y2="86" stroke="#292524" strokeWidth="0.4" opacity="0.5"/>
      <line x1="44" y1="56" x2="44" y2="96" stroke="#292524" strokeWidth="0.3" opacity="0.4"/>
      {/* 炉口（火焰） */}
      <rect x="36" y="68" width="16" height="14" fill="#1c1917" stroke="#0c0a09" strokeWidth="0.5" rx="1"/>
      <path d="M44 70 C40 76 40 80 43 82 C45 80 46 81 44 79 C46 81 47 80 46 82 C49 80 49 76 44 70 Z" fill="url(#sm-fire)"/>
      {/* 烟囱 */}
      <rect x="40" y="42" width="8" height="14" fill="#57534e" stroke="#292524" strokeWidth="0.5"/>
      <ellipse cx="44" cy="42" rx="5" ry="2" fill="#44403c" stroke="#292524" strokeWidth="0.4"/>
      {/* 烟 */}
      <path d="M42 40 C38 34 40 28 42 22" stroke="#a8a29e" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.4"/>
      <path d="M46 39 C50 33 48 27 46 21" stroke="#d6d3d1" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.3"/>
      {/* 铁砧 */}
      <rect x="70" y="80" width="22" height="6" fill="#57534e" stroke="#292524" strokeWidth="0.6" rx="1"/>
      <rect x="78" y="86" width="6" height="10" fill="#44403c" stroke="#292524" strokeWidth="0.5"/>
      <rect x="74" y="96" width="14" height="4" fill="#57534e" stroke="#292524" strokeWidth="0.5"/>
      {/* 锤子 */}
      <rect x="84" y="62" width="3" height="16" fill="#78350f" stroke="#451a03" strokeWidth="0.4" transform="rotate(20 85 70)"/>
      <rect x="80" y="58" width="10" height="6" fill="#a8a29e" stroke="#44403c" strokeWidth="0.5" rx="1" transform="rotate(20 85 61)"/>
      {/* 风箱 */}
      <rect x="64" y="92" width="10" height="6" fill="#78350f" stroke="#451a03" strokeWidth="0.4" rx="1"/>
    </svg>
  );
}

// ========== 灵台（academy） ==========
// 观星台 + 星图 + 简牍
export function AcademyArt({ className }: ArtProps) {
  const stars = [{x:30,y:24},{x:90,y:20},{x:20,y:40},{x:100,y:38},{x:60,y:12}];
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ac-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1"/><stop offset="100%" stopColor="#4338ca"/></linearGradient>
        <linearGradient id="ac-earth" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a8a29e"/><stop offset="100%" stopColor="#57534e"/></linearGradient>
      </defs>
      <ellipse cx="60" cy="108" rx="44" ry="5" fill="#000" opacity="0.25"/>
      {/* 台基 */}
      <polygon points="24,86 60,76 96,86 60,96" fill="url(#ac-earth)" stroke="#44403c" strokeWidth="0.8"/>
      <polygon points="24,86 24,96 60,106 60,96" fill="#57534e" stroke="#44403c" strokeWidth="0.8"/>
      <polygon points="96,86 96,96 60,106 60,96" fill="#78716c" stroke="#44403c" strokeWidth="0.8"/>
      {/* 灵台主体（圆柱形观星台） */}
      <rect x="44" y="50" width="32" height="28" fill="url(#ac-stone)" stroke="#312e81" strokeWidth="0.8" rx="2"/>
      {/* 砖纹 */}
      <line x1="44" y1="60" x2="76" y2="60" stroke="#312e81" strokeWidth="0.4" opacity="0.5"/>
      <line x1="44" y1="70" x2="76" y2="70" stroke="#312e81" strokeWidth="0.4" opacity="0.5"/>
      <line x1="60" y1="50" x2="60" y2="78" stroke="#312e81" strokeWidth="0.3" opacity="0.4"/>
      {/* 顶部观星平台 */}
      <ellipse cx="60" cy="50" rx="18" ry="5" fill="#4f46e5" stroke="#312e81" strokeWidth="0.6"/>
      <ellipse cx="60" cy="49" rx="15" ry="3.5" fill="#312e81" opacity="0.6"/>
      {/* 浑天仪/观星仪（圆环） */}
      <circle cx="60" cy="42" r="10" fill="none" stroke="#fbbf24" strokeWidth="1"/>
      <ellipse cx="60" cy="42" rx="10" ry="4" fill="none" stroke="#fbbf24" strokeWidth="0.6" opacity="0.7"/>
      <ellipse cx="60" cy="42" rx="4" ry="10" fill="none" stroke="#fbbf24" strokeWidth="0.6" opacity="0.7"/>
      <circle cx="60" cy="42" r="2" fill="#fde68a"/>
      {/* 星点 */}
      {stars.map((s,i) => (
        <g key={i}>
          <circle cx={s.x} cy={s.y} r="1.5" fill="#fde68a"/>
          <circle cx={s.x} cy={s.y} r="3" fill="#fde68a" opacity="0.3"/>
        </g>
      ))}
      {/* 简牍（竹简）靠在台边 */}
      <rect x="80" y="84" width="3" height="14" fill="#d97706" stroke="#78350f" strokeWidth="0.3" rx="1" transform="rotate(15 81 91)"/>
      <rect x="84" y="84" width="3" height="14" fill="#d97706" stroke="#78350f" strokeWidth="0.3" rx="1" transform="rotate(15 85 91)"/>
      <rect x="88" y="84" width="3" height="14" fill="#d97706" stroke="#78350f" strokeWidth="0.3" rx="1" transform="rotate(15 89 91)"/>
    </svg>
  );
}

// ========== 马场（stable） ==========
// 木栅栏马厩 + 战马
export function StableArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="st-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b45309"/><stop offset="100%" stopColor="#78350f"/></linearGradient>
        <linearGradient id="st-horse" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#92400e"/><stop offset="100%" stopColor="#451a03"/></linearGradient>
      </defs>
      <ellipse cx="60" cy="106" rx="50" ry="6" fill="#000" opacity="0.22"/>
      {/* 马厩棚（茅草顶 + 木柱） */}
      <polygon points="14,64 60,44 106,64 60,74" fill="#713f12" stroke="#451a03" strokeWidth="0.8"/>
      <polygon points="60,44 106,64 60,74" fill="#451a03" opacity="0.5"/>
      <rect x="20" y="64" width="4" height="34" fill="url(#st-wood)" stroke="#451a03" strokeWidth="0.4"/>
      <rect x="96" y="64" width="4" height="34" fill="url(#st-wood)" stroke="#451a03" strokeWidth="0.4"/>
      <rect x="58" y="64" width="4" height="34" fill="url(#st-wood)" stroke="#451a03" strokeWidth="0.4"/>
      {/* 木栅栏 */}
      <rect x="14" y="84" width="92" height="3" fill="#78350f" stroke="#451a03" strokeWidth="0.3"/>
      <rect x="14" y="94" width="92" height="3" fill="#78350f" stroke="#451a03" strokeWidth="0.3"/>
      {[0,1,2,3,4,5,6,7,8].map(i => (
        <rect key={i} x={16 + i*11} y="80" width="3" height="20" fill="#92400e" stroke="#451a03" strokeWidth="0.3"/>
      ))}
      {/* 战马（侧视） */}
      <g transform="translate(36,60)">
        {/* 身体 */}
        <ellipse cx="18" cy="18" rx="14" ry="8" fill="url(#st-horse)" stroke="#1c1917" strokeWidth="0.6"/>
        {/* 脖子 */}
        <path d="M28 14 L34 4 L38 6 L32 18 Z" fill="url(#st-horse)" stroke="#1c1917" strokeWidth="0.5"/>
        {/* 头 */}
        <ellipse cx="37" cy="5" rx="4" ry="3" fill="#92400e" stroke="#1c1917" strokeWidth="0.5"/>
        {/* 鬃毛 */}
        <path d="M30 6 Q34 2 38 4" stroke="#1c1917" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        {/* 腿 */}
        <rect x="10" y="24" width="3" height="10" fill="#451a03" stroke="#1c1917" strokeWidth="0.3"/>
        <rect x="18" y="24" width="3" height="10" fill="#451a03" stroke="#1c1917" strokeWidth="0.3"/>
        <rect x="24" y="24" width="3" height="10" fill="#451a03" stroke="#1c1917" strokeWidth="0.3"/>
        {/* 尾巴 */}
        <path d="M6 16 Q0 18 2 24" stroke="#1c1917" strokeWidth="2" fill="none" strokeLinecap="round"/>
        {/* 眼 */}
        <circle cx="39" cy="4" r="0.6" fill="#1c1917"/>
      </g>
      {/* 干草堆 */}
      <ellipse cx="88" cy="96" rx="8" ry="3" fill="#ca8a04" stroke="#854d0e" strokeWidth="0.4"/>
      <path d="M82 96 Q88 86 94 96" fill="#eab308" stroke="#854d0e" strokeWidth="0.4"/>
    </svg>
  );
}

// ========== 工坊（workshop） ==========
// 投石机/攻城器械 + 工具
export function WorkshopArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="wo-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#92400e"/><stop offset="100%" stopColor="#451a03"/></linearGradient>
        <linearGradient id="wo-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a8a29e"/><stop offset="100%" stopColor="#57534e"/></linearGradient>
      </defs>
      <ellipse cx="60" cy="106" rx="50" ry="6" fill="#000" opacity="0.25"/>
      {/* 工坊棚（茅草顶） */}
      <polygon points="16,70 60,50 104,70 60,80" fill="#713f12" stroke="#451a03" strokeWidth="0.8"/>
      <polygon points="60,50 104,70 60,80" fill="#451a03" opacity="0.5"/>
      <rect x="22" y="70" width="4" height="24" fill="#78350f" stroke="#451a03" strokeWidth="0.4"/>
      <rect x="94" y="70" width="4" height="24" fill="#78350f" stroke="#451a03" strokeWidth="0.4"/>
      {/* 投石机主体 */}
      <g transform="translate(30,72)">
        {/* 底座 */}
        <rect x="0" y="20" width="50" height="8" fill="url(#wo-wood)" stroke="#1c1917" strokeWidth="0.6"/>
        {/* 轮子 */}
        <circle cx="8" cy="32" r="5" fill="#451a03" stroke="#1c1917" strokeWidth="0.6"/>
        <circle cx="8" cy="32" r="2" fill="#78350f"/>
        <circle cx="42" cy="32" r="5" fill="#451a03" stroke="#1c1917" strokeWidth="0.6"/>
        <circle cx="42" cy="32" r="2" fill="#78350f"/>
        {/* 投杆 */}
        <line x1="10" y1="20" x2="40" y2="2" stroke="#78350f" strokeWidth="3" strokeLinecap="round"/>
        {/* 支点 */}
        <polygon points="20,20 24,10 28,20" fill="#92400e" stroke="#1c1917" strokeWidth="0.4"/>
        {/* 投石兜 */}
        <ellipse cx="40" cy="2" rx="4" ry="3" fill="#451a03" stroke="#1c1917" strokeWidth="0.4"/>
        {/* 弹丸 */}
        <circle cx="40" cy="2" r="2" fill="#57534e" stroke="#292524" strokeWidth="0.3"/>
        {/* 拉绳 */}
        <path d="M10 20 Q2 28 4 36" stroke="#78350f" strokeWidth="1" fill="none"/>
      </g>
      {/* 地上工具：锯、斧 */}
      <rect x="76" y="94" width="14" height="2" fill="#a8a29e" stroke="#44403c" strokeWidth="0.3" transform="rotate(-10 83 95)"/>
      <rect x="88" y="90" width="3" height="10" fill="#78350f" stroke="#451a03" strokeWidth="0.3" transform="rotate(-10 89 95)"/>
      {/* 铜锭堆 */}
      <rect x="14" y="92" width="10" height="5" fill="#ca8a04" stroke="#854d0e" strokeWidth="0.4" rx="1"/>
      <rect x="16" y="87" width="6" height="5" fill="#eab308" stroke="#854d0e" strokeWidth="0.4" rx="1"/>
    </svg>
  );
}

// 建筑立绘注册表
export const BUILDING_ART: Partial<Record<BuildingType, (p: ArtProps) => ReactElement>> = {
  mainBuilding: MainBuildingArt,
  warehouse: WarehouseArt,
  granary: GranaryArt,
  cranny: CrannyArt,
  rallyPoint: RallyPointArt,
  barracks: BarracksArt,
  embassy: EmbassyArt,
  market: MarketArt,
  smithy: SmithyArt,
  academy: AcademyArt,
  stable: StableArt,
  workshop: WorkshopArt,
  wall: WallArt,
};

import { memo, useMemo } from 'react';
import { SPEED_MULTIPLIER } from '../game/initialState';
import { computeCapacity, computeProduction, useGame } from '../store/gameStore';

// 上古四资源：木材、陶土、铜矿、粟米
const RES_META = [
  { key: 'wood' as const, name: '木材', color: 'text-amber-700',  bar: 'bg-amber-500',  icon: '🪵' },
  { key: 'clay' as const, name: '陶土', color: 'text-yellow-700', bar: 'bg-yellow-500', icon: '🏺' },
  { key: 'iron' as const, name: '铜矿', color: 'text-orange-700', bar: 'bg-orange-500', icon: '🔶' },
  { key: 'crop' as const, name: '粟米', color: 'text-lime-700',   bar: 'bg-lime-500',   icon: '🌾' },
];

function ResourceBarInner() {
  // 精确取数：只订阅渲染所需字段，避免 village 其他部分变化时无谓重渲染
  const resources = useGame((s) => s.village.resources);
  const jade = useGame((s) => s.village.jade);
  const village = useGame((s) => s.village);

  // useMemo 缓存派生计算，只在 village 引用变化时重算
  const production = useMemo(() => computeProduction(village), [village]);
  const capacity = useMemo(() => computeCapacity(village), [village]);

  return (
    <div className="bg-bg-secondary border-b border-border px-3 py-2 shadow-sm sticky top-0 z-30">
      <div className="max-w-5xl mx-auto flex items-center gap-2 flex-wrap">
        {RES_META.map((m) => {
          const val = Math.floor(resources[m.key]);
          const prod = production[m.key];
          const cap = capacity[m.key];
          const ratio = cap > 0 ? val / cap : 0;
          const warn = ratio > 0.9;
          return (
            <div key={m.key} className="flex-1 min-w-[100px] bg-bg-card rounded-lg px-2 py-1.5 border border-border">
              <div className="flex items-center gap-1.5">
                <span className="text-base">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between">
                    <span className={`text-sm font-semibold ${m.color} truncate`}>
                      {val.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-text-muted">/ {cap.toLocaleString()}</span>
                  </div>
                  {/* 容量进度条 */}
                  <div className="w-full bg-bg-primary rounded-full h-1 mt-0.5 overflow-hidden">
                    <div
                      className={`${m.bar} h-full transition-all duration-300 ${warn ? 'anim-pulse' : ''}`}
                      style={{ width: `${Math.min(100, ratio * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <span className="text-[10px] text-text-muted">+{prod}/h</span>
                    {warn && <span className="text-[10px] text-red-400">满</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {/* 纹玉（高级货币，反P2W：仅游戏行为获得） */}
        <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
          <span className="text-base">💎</span>
          <span className="text-sm font-bold text-emerald-700">{jade}</span>
        </div>
        <div className="text-xs text-text-muted px-2 hidden sm:block">
          {SPEED_MULTIPLIER}x 速度
        </div>
      </div>
    </div>
  );
}

export const ResourceBar = memo(ResourceBarInner);

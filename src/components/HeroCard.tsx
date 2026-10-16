// 英雄卡片：SVG 徽章 + 稀有度 + 三维属性条
import { memo } from 'react';
import { HERO_CONFIGS, HERO_RARITY_META, HERO_TYPE_META, heroStats, type HeroId } from '../game/heroes';
import { HeroBadge } from './HeroBadge';
import type { VillageState } from '../game/types';

type Props = {
  heroId: HeroId;
  village: VillageState;
  isGeneral: boolean;
  onSetGeneral?: () => void;
};

export const HeroCard = memo(function HeroCard({ heroId, village, isGeneral, onSetGeneral }: Props) {
  const cfg = HERO_CONFIGS[heroId];
  const rarity = HERO_RARITY_META[cfg.rarity];
  const type = HERO_TYPE_META[cfg.type];
  const stats = heroStats(heroId, village.exp, isGeneral);
  const isMyTribe = cfg.tribe === village.tribe;

  return (
    <div className={`card-std p-2.5 border-2 rounded-lg ${isGeneral ? 'border-pop bg-pop/5' : 'border-border bg-bg-secondary'}`}>
      <div className="flex items-start gap-2">
        <div className="shrink-0">
          <HeroBadge heroId={heroId} size={64} glow={isGeneral} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-semibold text-sm text-text-primary truncate">{cfg.name}</span>
            <span className={`text-[10px] px-1 rounded border ${rarity.color} ${rarity.border}`}>{cfg.rarity}</span>
            {isGeneral && <span className="text-[10px] px-1 rounded bg-pop text-white">主将</span>}
            {!isMyTribe && <span className="text-[10px] px-1 rounded bg-slate-200 text-slate-600">跨部</span>}
          </div>
          <div className="text-[10px] text-text-muted">
            {cfg.title} · {type.icon} {type.name} · Lv{stats.level}
          </div>
          <div className="mt-1.5 space-y-0.5">
            <StatBar label="攻" val={stats.atkPct} color="bg-red-500" />
            <StatBar label="防" val={stats.defPct} color="bg-blue-500" />
            <StatBar label="速" val={stats.speedPct} color="bg-emerald-500" />
          </div>
        </div>
      </div>
      {/* 主将切换按钮 */}
      {onSetGeneral && (
        <div className="mt-2 text-center">
          {isMyTribe ? (
            <button
              onClick={onSetGeneral}
              disabled={isGeneral}
              className={`text-[11px] px-3 py-1 rounded border transition
                ${isGeneral
                  ? 'border-pop bg-pop text-white cursor-default'
                  : 'border-pop text-pop hover:bg-pop hover:text-white'}`}
            >
              {isGeneral ? '当前主将' : '设为主将'}
            </button>
          ) : (
            <span className="text-[10px] text-text-muted">跨部落英雄不可当主将</span>
          )}
        </div>
      )}
    </div>
  );
});

function StatBar({ label, val, color }: { label: string; val: number; color: string }) {
  const pct = Math.min(100, val * 2); // 20% → 100% bar max
  return (
    <div className="flex items-center gap-1 text-[10px]">
      <span className="text-text-muted w-6 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-bg-primary rounded overflow-hidden">
        <div className={`${color} h-full rounded transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-text-secondary w-8 text-right shrink-0">+{val.toFixed(1)}%</span>
    </div>
  );
}

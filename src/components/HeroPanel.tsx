// 英雄名册面板 —— MVP：预置 9 位英雄，可切换主将，三维进战斗
// MVP 契约：不做招募、不做纹玉消耗、不做专属被动、不做稀有度解锁槽位
// 说明文案只描述已生效的机制（经验召回提醒）
import { useState } from 'react';
import { HERO_CONFIGS, HERO_ORDER, heroStats, type HeroId } from '../game/heroes';
import { HeroCard } from './HeroCard';
import { HeroBadge } from './HeroBadge';
import { TRIBE_CONFIGS, TRIBE_ORDER } from '../game/tribes';
import { heroBattleMultipliers, useGame } from '../store/gameStore';
import { resolveLevel } from '../game/level';
import type { TribeType } from '../game/types';

type Tab = TribeType;

export function HeroPanel({ onClose }: { onClose: () => void }) {
  const village = useGame((s) => s.village);
  const setGeneral = useGame((s) => s.setGeneral);
  const [tab, setTab] = useState<Tab>('yan');

  const hm = heroBattleMultipliers(village);
  const generalHero = village.heroes.find((h) => h.isGeneral);
  const generalCfg = generalHero ? HERO_CONFIGS[generalHero.id] : null;
  const generalStats = generalHero ? heroStats(generalHero.id, village.exp, true) : null;
  const playerLevel = resolveLevel(village.exp).level;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-bg-card border-t sm:border border-border sm:rounded-2xl rounded-t-2xl w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto anim-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部 */}
        <div className="sticky top-0 bg-bg-card border-b border-border px-4 py-3 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-text-primary">🗿 英雄名册</h2>
              <p className="text-xs text-text-muted">
                玩家等级 Lv{playerLevel} · 英雄随玩家 exp 自动升级
              </p>
            </div>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl px-1">×</button>
          </div>

          {/* 当前主将总加成概览 */}
          <div className="mt-2 p-2.5 rounded-lg bg-bg-secondary border border-border">
            <div className="flex items-center gap-2.5">
              {generalHero && generalCfg && generalStats ? (
                <>
                  <HeroBadge heroId={generalHero.id} size={48} glow />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-text-primary truncate">
                      当前主将：{generalCfg.name}（Lv{generalStats.level}）
                    </div>
                    <div className="text-[11px] text-text-muted">
                      三维加成 · 攻 +{((hm.atk - 1) * 100).toFixed(1)}%
                      · 防 +{((hm.def - 1) * 100).toFixed(1)}%
                      · 速 +{((hm.speed - 1) * 100).toFixed(1)}%
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-text-muted">尚未选定主将</div>
              )}
            </div>
            <div className="text-[10px] text-text-muted mt-1.5">
              💡 主将三维全额生效；同部落非主将三维按 50% 生效；跨部落英雄只能当副将
            </div>
          </div>
        </div>

        {/* 部落 Tab */}
        <div className="p-3">
          <div className="flex gap-2 mb-3">
            {TRIBE_ORDER.map((t) => {
              const c = TRIBE_CONFIGS[t];
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition text-center
                    ${tab === t ? 'bg-pop text-white border-pop' : 'bg-bg-secondary text-text-secondary border-border'}`}
                >
                  <span>{c.emoji}</span> {c.name}
                  {village.tribe === t && <span className="ml-1 text-[9px] text-amber-500">●</span>}
                </button>
              );
            })}
          </div>

          {/* 当前部落下的英雄列表 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {HERO_ORDER
              .filter((id) => HERO_CONFIGS[id].tribe === tab)
              .map((id: HeroId) => {
                const heroState = village.heroes.find((h) => h.id === id);
                if (!heroState) return null;
                return (
                  <HeroCard
                    key={id}
                    heroId={id}
                    village={village}
                    isGeneral={heroState.isGeneral}
                    onSetGeneral={() => setGeneral(id)}
                  />
                );
              })}
          </div>

          <p className="text-[10px] text-text-muted text-center mt-3 pt-2 border-t border-border">
            MVP 版本：9 位英雄全部预置 · 三维进战斗模拟 · 主将限定同部落
          </p>
        </div>
      </div>
    </div>
  );
}

export default HeroPanel;

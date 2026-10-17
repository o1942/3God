import type { BuildingType } from '../game/types';
import { BUILDING_CONFIGS } from '../game/config';
import { UNIT_ORDER, getUnitDisplay } from '../game/units';
import { SPEED_MULTIPLIER } from '../game/initialState';
import { computeBuildSpeed, useGame } from '../store/gameStore';
import { BUILDING_ART } from '../game/buildingArt';

const BUILDING_ORDER: BuildingType[] = [
  'mainBuilding', 'warehouse', 'granary', 'cranny', 'rallyPoint',
  'embassy', 'market', 'barracks', 'academy', 'smithy', 'stable', 'workshop', 'wall', 'bunker',
];

export function BuildingPanel({ onClose }: { onClose: () => void }) {
  const village = useGame((s) => s.village);
  const enqueueBuildingUpgrade = useGame((s) => s.enqueueBuildingUpgrade);
  const transferBunker = useGame((s) => s.transferBunker);
  const buildSpeed = computeBuildSpeed(village);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-bg-card border-t sm:border border-border sm:rounded-2xl rounded-t-2xl w-full sm:max-w-2xl max-h-[80vh] overflow-y-auto anim-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-bg-card border-b border-border px-4 py-3 flex justify-between items-center z-10">
          <div>
            <h2 className="text-lg font-bold text-text-primary">🏗️ 建筑列表</h2>
            <p className="text-xs text-text-muted">建造速度 {buildSpeed.toFixed(2)}x</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl px-2">×</button>
        </div>
        <div className="p-3 space-y-2">
          {BUILDING_ORDER.map((type) => {
            const cfg = BUILDING_CONFIGS[type];
            const curLv = village.buildings[type] || 0;
            const isMax = curLv >= cfg.maxLevel;
            const nextLv = curLv + 1;
            const nextData = isMax ? null : cfg.levels[nextLv - 1];
            const prereqsMet = cfg.prerequisites.every((p) => (village.buildings[p.building] || 0) >= p.level);
            const missing = cfg.prerequisites
              .filter((p) => (village.buildings[p.building] || 0) < p.level)
              .map((p) => `${BUILDING_CONFIGS[p.building].name} Lv${p.level}`);

            // 封禅台等级上限：其他建筑不能超过封禅台等级
            const mainLv = village.buildings.mainBuilding || 0;
            const cappedByMain = type !== 'mainBuilding' && mainLv > 0 && curLv >= mainLv;

            const inQueue = village.buildQueue.some((t) => t.target.kind === 'building' && t.target.building === type);
            const canAfford = nextData
              ? village.resources.wood >= nextData.cost.wood &&
                village.resources.clay >= nextData.cost.clay &&
                village.resources.iron >= nextData.cost.iron &&
                village.resources.crop >= nextData.cost.crop
              : false;

            return (
              <div
                key={type}
                className={`card-std p-3 flex items-start gap-3 ${(!prereqsMet || isMax) ? 'opacity-70' : ''}`}
              >
                {(() => {
                  const ArtComp = BUILDING_ART[type];
                  return ArtComp ? (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/15 to-amber-700/15 border border-amber-400/20 flex items-center justify-center flex-shrink-0">
                      <ArtComp className="w-9 h-9" />
                    </div>
                  ) : (
                    <div className="text-3xl flex-shrink-0">{cfg.emoji}</div>
                  );
                })()}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-text-primary">{cfg.name}</h3>
                    <span className="text-xs bg-bg-primary text-text-secondary px-1.5 py-0.5 rounded">
                      Lv{curLv}{!isMax ? `/${cfg.maxLevel}` : ''}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{cfg.description}</p>

                  {!prereqsMet && (
                    <div className="text-xs text-red-400 mt-1">⚠ 需要：{missing.join('、')}</div>
                  )}

                  {prereqsMet && cappedByMain && !isMax && (
                    <div className="text-xs text-amber-500 mt-1">⚠ 等级不能超过封禅台 Lv{mainLv}，请先升级封禅台</div>
                  )}

                  {prereqsMet && nextData && !cappedByMain && (
                    <div className="flex flex-wrap gap-2 mt-1.5 text-xs">
                      <Res label="木" cost={nextData.cost.wood} have={village.resources.wood} />
                      <Res label="陶土" cost={nextData.cost.clay} have={village.resources.clay} />
                      <Res label="铜" cost={nextData.cost.iron} have={village.resources.iron} />
                      <Res label="粟" cost={nextData.cost.crop} have={village.resources.crop} />
                      <span className="text-text-muted">⏱{Math.ceil((nextData.buildTime * SPEED_MULTIPLIER) / buildSpeed)}s</span>
                    </div>
                  )}

                  {/* 藏兵洞专属：容量 + 转入/转出控制 */}
                  {type === 'bunker' && curLv > 0 && (() => {
                    const cap = cfg.levels[curLv - 1]?.effect.capacity || 0;
                    const totalInside = UNIT_ORDER.reduce((s, u) => s + (village.bunkerUnits?.[u] || 0), 0);
                    const used = totalInside;
                    return (
                      <div className="mt-2 pt-2 border-t border-border/60 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-text-secondary font-medium">📦 藏兵容量</span>
                          <span className={used >= cap ? 'text-red-400' : 'text-emerald-400'}>
                            {used}/{cap}
                          </span>
                        </div>
                        {UNIT_ORDER.map((u) => {
                          const outside = village.units[u] || 0;
                          const inside = village.bunkerUnits?.[u] || 0;
                          const display = getUnitDisplay(village.tribe, u);
                          return (
                            <div key={u} className="flex items-center gap-2 text-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-text-muted/60" />
                              <span className="text-text-primary w-20 truncate">
                                {display.emoji} {display.name}
                              </span>
                              <span className="text-text-muted flex-shrink-0">
                                外{outside}/内<span className="text-emerald-400">{inside}</span>
                              </span>
                              <div className="flex gap-1 ml-auto flex-shrink-0">
                                <button
                                  disabled={inside === 0}
                                  onClick={() => transferBunker(u, -1)}
                                  className="px-2 py-0.5 text-[10px] rounded bg-bg-secondary border border-border text-text-secondary hover:text-text-primary disabled:opacity-30"
                                  title="转出 1 个"
                                >−</button>
                                <button
                                  disabled={inside === 0}
                                  onClick={() => transferBunker(u, -inside)}
                                  className="px-1.5 py-0.5 text-[10px] rounded bg-bg-secondary border border-border text-text-secondary hover:text-text-primary disabled:opacity-30"
                                  title="全部转出"
                                >全出</button>
                                <button
                                  disabled={outside === 0 || used >= cap}
                                  onClick={() => transferBunker(u, 1)}
                                  className="px-2 py-0.5 text-[10px] rounded bg-stone-700 border border-stone-500 text-stone-100 hover:bg-stone-600 disabled:opacity-30"
                                  title="转入 1 个"
                                >＋</button>
                                <button
                                  disabled={outside === 0 || used >= cap}
                                  onClick={() => {
                                    const room = Math.max(0, cap - used);
                                    const move = Math.min(outside, room);
                                    if (move > 0) transferBunker(u, move);
                                  }}
                                  className="px-1.5 py-0.5 text-[10px] rounded bg-stone-700 border border-stone-500 text-stone-100 hover:bg-stone-600 disabled:opacity-30"
                                  title="尽量转入"
                                >尽转</button>
                              </div>
                            </div>
                          );
                        })}
                        <p className="text-[10px] text-amber-400/80 mt-1 leading-relaxed">
                          ⚠ 藏兵洞内士兵不参与村内防御战。妖兽 / 敌军来犯时毫发无损。
                          地堡容量 = 等级 × 10。
                        </p>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex-shrink-0">
                  {isMax ? (
                    <span className="text-xs text-text-muted">已满级</span>
                  ) : cappedByMain ? (
                    <span className="text-xs text-amber-500">需封禅台</span>
                  ) : (
                    <button
                      disabled={!prereqsMet || !canAfford || inQueue}
                      onClick={() => {
                        enqueueBuildingUpgrade(type);
                      }}
                      className="btn-primary py-1.5 px-3 text-sm"
                    >
                      {inQueue ? '排队中' : !prereqsMet ? '前置' : !canAfford ? '不足' : curLv === 0 ? '建造' : '升级'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Res({ label, cost, have }: { label: string; cost: number; have: number }) {
  const ok = have >= cost;
  return (
    <span className={ok ? 'text-emerald-400' : 'text-red-400'}>
      {label}{cost.toLocaleString()}
    </span>
  );
}

export default BuildingPanel;

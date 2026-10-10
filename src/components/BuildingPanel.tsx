import type { BuildingType } from '../game/types';
import { BUILDING_CONFIGS } from '../game/config';
import { SPEED_MULTIPLIER } from '../game/initialState';
import { computeBuildSpeed, useGame } from '../store/gameStore';
import { BUILDING_ART } from '../game/buildingArt';

const BUILDING_ORDER: BuildingType[] = [
  'mainBuilding', 'warehouse', 'granary', 'cranny', 'rallyPoint',
  'embassy', 'market', 'barracks', 'academy', 'smithy', 'stable', 'workshop', 'wall',
];

export function BuildingPanel({ onClose }: { onClose: () => void }) {
  const village = useGame((s) => s.village);
  const enqueueBuildingUpgrade = useGame((s) => s.enqueueBuildingUpgrade);
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

import { useEffect, useMemo, useState } from 'react';
import type { TribeType, UnitType } from '../game/types';
import { BUILDING_CONFIGS } from '../game/config';
import { UNIT_CONFIGS, UNIT_ORDER, getUnitDisplay, getUnitStats, computeUpkeep, UNIT_COUNTERS, getCounteredBy, COUNTER_BONUS } from '../game/units';
import { SPEED_MULTIPLIER } from '../game/initialState';
import { effectiveTrainTime, useGame } from '../store/gameStore';

// 军帐面板：展示 4 种兵种，可选择兵种与数量训练
export function BarracksPanel({ onClose }: { onClose: () => void }) {
  const village = useGame((s) => s.village);
  const enqueueTraining = useGame((s) => s.enqueueTraining);

  const barracksLv = village.buildings.barracks || 0;
  const trainQueue = village.trainQueue || [];
  const cancelTrainTask = useGame((s) => s.cancelTrainTask);
  const [selectedUnit, setSelectedUnit] = useState<UnitType>('warrior');
  const [trainCount, setTrainCount] = useState(5);
  // 每秒触发重渲染，更新训练进度条
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const cfg = UNIT_CONFIGS[selectedUnit];
  const unitDisplay = getUnitDisplay(village.tribe, selectedUnit);
  const effStats = getUnitStats(village.tribe, selectedUnit);
  const perUnitSec = Math.max(1, Math.round(effectiveTrainTime(village, cfg.trainTimeSec) * SPEED_MULTIPLIER));

  // 前置是否满足
  const prereqMet = useMemo(() => {
    if (!cfg.prerequisites) return true;
    return cfg.prerequisites.every((p) => (village.buildings[p.building as keyof typeof village.buildings] || 0) >= p.level);
  }, [cfg.prerequisites, village.buildings]);

  const totalCost = {
    wood: cfg.cost.wood * trainCount,
    clay: cfg.cost.clay * trainCount,
    iron: cfg.cost.iron * trainCount,
    crop: cfg.cost.crop * trainCount,
  };
  const canAfford =
    village.resources.wood >= totalCost.wood &&
    village.resources.clay >= totalCost.clay &&
    village.resources.iron >= totalCost.iron &&
    village.resources.crop >= totalCost.crop;

  const upkeep = computeUpkeep(village.units);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-bg-card border-t sm:border border-border sm:rounded-2xl rounded-t-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto anim-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="sticky top-0 bg-bg-card border-b border-border px-4 py-3 flex justify-between items-center z-10">
          <div>
            <h2 className="text-lg font-bold text-text-primary">🏹 军帐</h2>
            <p className="text-xs text-text-muted">军帐 Lv{barracksLv} · 总兵力 {totalArmy(village.units)}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl px-2">×</button>
        </div>

        <div className="p-3 space-y-3">
          {/* 兵种选择 */}
          <div className="grid grid-cols-2 gap-2">
            {UNIT_ORDER.map((u) => {
              const c = UNIT_CONFIGS[u];
              const disp = getUnitDisplay(village.tribe, u);
              const owned = village.units[u] || 0;
              const locked = u !== 'warrior' && !prereqMetFor(u, village.buildings);
              const active = selectedUnit === u;
              return (
                <button
                  key={u}
                  onClick={() => !locked && setSelectedUnit(u)}
                  disabled={locked}
                  className={`
                    relative text-left border-2 rounded-lg p-2 transition-all
                    ${active ? 'border-pop bg-pop/10 ring-2 ring-pop/30' : 'border-border bg-bg-secondary'}
                    ${locked ? 'cursor-not-allowed' : 'hover:border-pop hover:scale-[1.02] active:scale-95'}
                  `}
                >
                  {locked && (
                    <div className="absolute inset-0 bg-bg-card/70 backdrop-blur-[1px] rounded-md flex flex-col items-center justify-center">
                      <span className="text-lg">🔒</span>
                      <span className="text-[10px] text-text-primary font-medium mt-0.5 px-1 text-center">{prereqText(c)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl">{disp.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-text-primary truncate">{disp.name}</div>
                      <div className="text-[10px] text-text-muted">{c.role} · 现有 {owned}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="text-[11px] text-text-muted text-center -mt-1">
            💡 建造并升级 灵台 / 马场 / 铸铜坊 可解锁更多兵种
          </div>

          {/* 选中兵种详情 */}
          <div className="border border-border rounded-lg p-3 bg-bg-secondary">
            <div className="flex items-start gap-3">
              <div className="text-4xl">{unitDisplay.emoji}</div>
              <div className="flex-1">
                <h3 className="font-semibold text-text-primary">{unitDisplay.name}</h3>
                <p className="text-xs text-text-muted mt-0.5">{unitDisplay.description}</p>
                <div className="flex flex-wrap gap-1 mt-1.5 text-[11px]">
                  <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded">攻 {effStats.attack}{effStats.attack !== cfg.attack && <span className="opacity-60"> ({cfg.attack})</span>}</span>
                  <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">防 {effStats.defense}{effStats.defense !== cfg.defense && <span className="opacity-60"> ({cfg.defense})</span>}</span>
                  <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded">HP {effStats.hp}{effStats.hp !== cfg.hp && <span className="opacity-60"> ({cfg.hp})</span>}</span>
                  <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">维持 {cfg.upkeepCrop}/h</span>
                </div>
                {/* 克制关系 */}
                <div className="mt-2 pt-2 border-t border-border">
                  <CounterBadges unit={selectedUnit} tribe={village.tribe} />
                </div>
              </div>
            </div>
          </div>

          {/* 训练数量 */}
          <div>
            <label className="text-xs text-text-secondary">训练数量</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="range"
                min={1}
                max={20}
                value={trainCount}
                onChange={(e) => setTrainCount(parseInt(e.target.value))}
                className="flex-1 accent-pop"
              />
              <input
                type="number"
                min={1}
                value={trainCount}
                onChange={(e) => setTrainCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 px-2 py-1 text-sm border border-border rounded bg-bg-primary text-text-primary text-center"
              />
            </div>
          </div>

          {/* 成本与时间 */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-xs">
            <Cost label="木" cost={totalCost.wood} have={village.resources.wood} />
            <Cost label="陶土" cost={totalCost.clay} have={village.resources.clay} />
            <Cost label="铜" cost={totalCost.iron} have={village.resources.iron} />
            <Cost label="粟" cost={totalCost.crop} have={village.resources.crop} />
            <div className="bg-bg-primary border border-border rounded px-2 py-1 text-center text-text-secondary">
              ⏱ {perUnitSec}s/只
            </div>
          </div>

          <button
            disabled={!canAfford || barracksLv < 1 || !prereqMet}
            onClick={() => enqueueTraining(selectedUnit, trainCount)}
            className="btn-primary"
          >
            {barracksLv < 1 ? '需要军帐' : !prereqMet ? '前置建筑未达成' : !canAfford ? '资源不足' : `训练 ${trainCount} 名 ${unitDisplay.name}`}
          </button>

          {/* 训练队列 */}
          {trainQueue.length > 0 && (
            <div className="border border-border rounded-lg p-3 bg-bg-secondary">
              <h3 className="font-semibold text-text-primary text-sm mb-2">⏳ 训练队列</h3>
              <div className="space-y-2">
                {trainQueue.map((task) => {
                  const d = getUnitDisplay(village.tribe, task.unit);
                  const elapsed = Date.now() - task.startAt;
                  const doneNow = Math.min(task.count, Math.floor(elapsed / task.perUnitMs));
                  const progress = (doneNow / task.count) * 100;
                  const remainSec = Math.ceil((task.count - doneNow) * task.perUnitMs / 1000);
                  return (
                    <div key={task.id} className="flex items-center gap-2">
                      <span className="text-lg">{d.emoji}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-text-primary">{d.name} {doneNow}/{task.count}</span>
                          <span className="text-text-muted">{remainSec}s</span>
                        </div>
                        <div className="w-full bg-bg-primary rounded-full h-1.5">
                          <div className="bg-pop h-full rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      <button onClick={() => cancelTrainTask(task.id)} className="text-red-400 text-xs px-1">×</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 当前军队 */}
          <div className="border border-border rounded-lg p-3 bg-bg-secondary">
            <h3 className="font-semibold text-text-primary text-sm mb-2">当前军队</h3>
            <div className="space-y-1.5">
              {UNIT_ORDER.map((u) => {
                const n = village.units[u] || 0;
                if (n <= 0) return null;
                const d = getUnitDisplay(village.tribe, u);
                return (
                  <div key={u} className="flex items-center justify-between text-xs">
                    <span>{d.emoji} {d.name}</span>
                    <span className="font-semibold text-text-primary">{n}</span>
                  </div>
                );
              })}
              {totalArmy(village.units) === 0 && (
                <div className="text-xs text-text-muted">暂无兵力</div>
              )}
            </div>
            {totalArmy(village.units) > 0 && (
              <div className="text-[11px] text-text-muted mt-2 pt-2 border-t border-border">
                每小时消耗 {upkeep} 粟米维持
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function totalArmy(units: Record<string, number>): number {
  return Object.values(units).reduce((s, n) => s + (n || 0), 0);
}

function prereqMetFor(unit: UnitType, buildings: Record<string, number | undefined>): boolean {
  const c = UNIT_CONFIGS[unit];
  if (!c.prerequisites) return true;
  return c.prerequisites.every((p) => (buildings[p.building] || 0) >= p.level);
}

function prereqText(cfg: typeof UNIT_CONFIGS[UnitType]): string {
  if (!cfg.prerequisites) return '';
  return cfg.prerequisites.map((p) => `${BUILDING_CONFIGS[p.building as keyof typeof BUILDING_CONFIGS]?.name || p.building} Lv${p.level}`).join(' + ');
}

function Cost({ label, cost, have }: { label: string; cost: number; have: number }) {
  const ok = have >= cost;
  return (
    <div className={`rounded px-2 py-1 border text-center ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
      <div className="text-[10px] opacity-80">{label}</div>
      <div className="font-bold text-sm">{cost}</div>
    </div>
  );
}

// 克制关系展示：克制谁 + 被谁克制
function CounterBadges({ unit, tribe }: { unit: UnitType; tribe: TribeType }) {
  const counters = UNIT_COUNTERS[unit];
  const counteredBy = getCounteredBy(unit);
  const bonusPct = Math.round(COUNTER_BONUS * 100);
  return (
    <div className="space-y-1">
      {counters ? (
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-emerald-600 font-semibold">克制</span>
          <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded flex items-center gap-1">
            {getUnitDisplay(tribe, counters).emoji} {getUnitDisplay(tribe, counters).name}
          </span>
          <span className="text-emerald-500">+{bonusPct}% 伤害</span>
        </div>
      ) : (
        <div className="text-[11px] text-text-muted">⚖️ 无克制关系（均衡型）</div>
      )}
      {counteredBy && (
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-red-500 font-semibold">被克</span>
          <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded flex items-center gap-1">
            {getUnitDisplay(tribe, counteredBy).emoji} {getUnitDisplay(tribe, counteredBy).name}
          </span>
          <span className="text-red-400">-{bonusPct}% 承伤</span>
        </div>
      )}
    </div>
  );
}

export default BarracksPanel;

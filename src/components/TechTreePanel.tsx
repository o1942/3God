import { useEffect, useState } from 'react';
import { TECH_CATEGORY_INFO, TECH_CONFIGS, TECH_ORDER, type TechCategory } from '../game/tech';
import { useGame } from '../store/gameStore';

// 科技树面板（在灵台打开）
export function TechTreePanel({ onClose }: { onClose: () => void }) {
  const village = useGame((s) => s.village);
  const startResearch = useGame((s) => s.startResearch);
  const cancelResearch = useGame((s) => s.cancelResearch);

  const [tab, setTab] = useState<TechCategory>('agriculture');
  // 每秒刷新研发进度
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const academyLv = village.buildings.academy || 0;
  const researchTask = village.researchQueue[0];
  const now = Date.now();

  const items = TECH_ORDER.filter((id) => TECH_CONFIGS[id].category === tab);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-bg-card border-t sm:border border-border sm:rounded-2xl rounded-t-2xl w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto anim-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-bg-card border-b border-border px-4 py-3 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-text-primary">🔬 科技树</h2>
              <p className="text-xs text-text-muted">灵台 Lv{academyLv} · 研发提供永久加成</p>
            </div>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl px-2">×</button>
          </div>
          {/* 分类切换 */}
          <div className="flex gap-1 mt-3">
            {(Object.keys(TECH_CATEGORY_INFO) as TechCategory[]).map((c) => {
              const info = TECH_CATEGORY_INFO[c];
              return (
                <button
                  key={c}
                  onClick={() => setTab(c)}
                  className={`flex-1 py-1.5 text-sm rounded-lg transition
                    ${tab === c ? 'bg-pop text-white' : 'bg-bg-secondary text-text-muted hover:bg-border'}`}
                >
                  {info.emoji} {info.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 当前研发任务 */}
        {researchTask && (() => {
          const cfg = TECH_CONFIGS[researchTask.tech];
          const elapsed = now - researchTask.startAt;
          const progress = Math.min(100, (elapsed / researchTask.duration) * 100);
          const remainSec = Math.max(0, Math.ceil((researchTask.duration - elapsed) / 1000));
          return (
            <div className="mx-4 mt-3 border-2 border-pop rounded-lg p-3 bg-pop/5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-text-primary">
                  研发中：{cfg.emoji} {cfg.name} Lv{researchTask.level}
                </span>
                <span className="text-xs text-text-muted">{remainSec}s</span>
              </div>
              <div className="w-full h-2 bg-bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-pop rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <button
                onClick={() => cancelResearch()}
                className="mt-2 text-[11px] text-red-500 hover:text-red-700"
              >
                取消研发（不退款）
              </button>
            </div>
          );
        })()}

        <div className="p-4 space-y-3">
          {items.map((id) => {
            const cfg = TECH_CONFIGS[id];
            const curLv = village.techLevels[id] || 0;
            const nextLv = curLv + 1;
            const maxed = curLv >= cfg.maxLevel;
            const academyReq = cfg.academyReq(nextLv);
            const academyOk = academyLv >= academyReq;
            const cost = maxed ? null : cfg.cost(nextLv);
            const canAfford = cost
              ? village.resources.wood >= cost.wood && village.resources.clay >= cost.clay &&
                village.resources.iron >= cost.iron && village.resources.crop >= cost.crop
              : false;
            const researching = researchTask?.tech === id;
            const queueBusy = village.researchQueue.length > 0 && !researching;
            const canResearch = !maxed && academyOk && canAfford && !queueBusy;

            return (
              <div
                key={id}
                className={`border rounded-lg p-3 transition
                  ${researching ? 'border-pop bg-pop/5' : 'border-border bg-bg-secondary'}
                  ${maxed ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl shrink-0">{cfg.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-text-primary text-sm">
                        {cfg.name}
                        <span className="ml-2 text-xs text-text-muted">Lv {curLv}/{cfg.maxLevel}</span>
                      </h3>
                      {maxed && <span className="text-xs text-emerald-600 font-semibold">已满级</span>}
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5">{cfg.desc}</p>
                    <p className="text-[11px] text-text-secondary mt-1">
                      每级效果：<span className="text-pop">{cfg.effectPerLevel}</span>
                    </p>

                    {!maxed && (
                      <div className="mt-2">
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-secondary mb-2">
                          <span>下一级：Lv{nextLv}</span>
                          <span>需灵台 Lv{academyReq} {academyOk ? '✅' : '❌'}</span>
                          {cost && cost.wood > 0 && <span>🪵{cost.wood}</span>}
                          {cost && cost.clay > 0 && <span>🏺{cost.clay}</span>}
                          {cost && cost.iron > 0 && <span>🔶{cost.iron}</span>}
                          {cost && cost.crop > 0 && <span>🌾{cost.crop}</span>}
                          <span>⏱️{cfg.duration(nextLv)}s</span>
                        </div>
                        <button
                          onClick={() => startResearch(id)}
                          disabled={!canResearch}
                          className={`w-full py-1.5 text-xs rounded font-semibold transition
                            ${canResearch
                              ? 'bg-pop text-white hover:bg-pop-hover'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        >
                          {researching ? '研发中...'
                            : queueBusy ? '灵台繁忙'
                            : maxed ? '已满级'
                            : !academyOk ? `需灵台 Lv${academyReq}`
                            : !canAfford ? '资源不足'
                            : `研发 Lv${nextLv}`}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default TechTreePanel;

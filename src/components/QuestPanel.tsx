import { QUESTS } from '../game/quests';
import { DAILY_BONUS_TIERS, DAILY_TASKS, dailyProgressOf } from '../game/dailyTasks';
import { resolveLevel } from '../game/level';
import { useGame } from '../store/gameStore';

export function QuestPanel({ onClose }: { onClose: () => void }) {
  const completed = useGame((s) => s.completedQuests);
  const daily = useGame((s) => s.village.daily);
  const exp = useGame((s) => s.village.exp);
  const lv = resolveLevel(exp || 0);

  const totalQuests = QUESTS.length;
  const doneCount = completed.length;
  const allDone = doneCount === totalQuests;

  const dailyDoneCount = daily?.claimed?.length || 0;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-bg-card border border-border w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[80vh] overflow-y-auto anim-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-bg-card border-b border-border px-4 py-3 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-text-primary">📜 洪荒征途</h2>
            <p className="text-xs text-text-muted mt-0.5">
              主线 {doneCount}/{totalQuests} · 每日 {dailyDoneCount}/{DAILY_TASKS.length}
            </p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl px-2">×</button>
        </div>

        {/* 等级与经验 */}
        <div className="px-3 pt-3">
          <div className="border border-border rounded-lg p-3 bg-bg-secondary">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold text-text-primary">🎖️ 等级 Lv{lv.level}</span>
              <span className="text-xs text-text-muted tabular-nums">
                {lv.isMax ? '已达满级 Lv60' : `${lv.expIntoLevel} / ${lv.expForNext} 经验`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-bg-card border border-border overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${lv.isMax ? 'bg-emerald-500' : 'bg-pop'}`}
                style={{ width: `${lv.isMax ? 100 : Math.min(100, Math.round((lv.expIntoLevel / lv.expForNext) * 100))}%` }}
              />
            </div>
            <p className="text-[11px] text-text-muted mt-1.5">
              升级资源田 / 建筑、训练士兵、研发、战斗胜利、完成任务均可得经验，满级 60 级。
            </p>
          </div>
        </div>

        {/* 每日任务 */}
        <div className="px-3 pt-3">
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <h3 className="text-sm font-bold text-text-primary">🌅 每日任务</h3>
            <span className="text-[11px] text-text-muted">每日 0 点重置</span>
          </div>
          <div className="space-y-2">
            {DAILY_TASKS.map((t) => {
              const isDone = !!daily?.claimed?.includes(t.id);
              const got = dailyProgressOf(daily, t.metric);
              const shown = Math.min(got, t.target);
              const pct = Math.min(100, Math.round((got / t.target) * 100));
              return (
                <div
                  key={t.id}
                  className={`border rounded-lg p-3 ${
                    isDone ? 'bg-emerald-900/20 border-emerald-700/40' : 'bg-bg-secondary border-border'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className={`text-sm font-semibold ${isDone ? 'text-emerald-300' : 'text-text-primary'}`}>
                        {isDone ? '✓ ' : ''}{t.title}
                      </div>
                      <div className="text-xs text-text-secondary mt-0.5">{t.desc}</div>
                    </div>
                    <span className={`shrink-0 text-xs font-bold ${isDone ? 'text-emerald-400' : 'text-amber-400'}`}>
                      +{t.xp} 经验
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-bg-card overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isDone ? 'bg-emerald-500' : 'bg-pop'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-text-muted tabular-nums shrink-0">
                      {isDone ? '已完成' : `${shown}/${t.target}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 额外加奖 */}
          <div className="mt-2 border border-amber-700/40 bg-amber-900/15 rounded-lg p-3">
            <div className="text-xs font-semibold text-amber-300 mb-1.5">🎁 额外加奖</div>
            <div className="space-y-1">
              {DAILY_BONUS_TIERS.map((tier) => {
                const got = dailyDoneCount >= tier.need;
                return (
                  <div key={tier.need} className="flex items-center justify-between text-xs">
                    <span className={got ? 'text-emerald-300' : 'text-text-secondary'}>
                      {got ? '✓ ' : ''}{tier.label}
                    </span>
                    <span className={`font-bold ${got ? 'text-emerald-400' : 'text-amber-400'}`}>+{tier.xp} 经验</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 主线任务 */}
        <div className="px-3 pt-4">
          <h3 className="text-sm font-bold text-text-primary mb-1.5 px-0.5">📜 主线任务</h3>
          <div className="space-y-2">
            {allDone && (
              <div className="bg-emerald-900/40 border border-emerald-600 rounded-lg p-3 text-center text-sm text-emerald-300 mb-2">
                🎉 全部任务完成！你已经验证了首日引导的可行性
              </div>
            )}

            {QUESTS.map((q, idx) => {
              const isDone = completed.includes(q.id);
              return (
                <div
                  key={q.id}
                  className={`
                    border rounded-lg p-3 flex items-start gap-3
                    ${isDone ? 'bg-emerald-900/20 border-emerald-700/40' : 'bg-bg-secondary border-border'}
                  `}
                >
                  <div className={`
                    flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                    ${isDone ? 'bg-emerald-600 text-white' : 'bg-bg-card text-text-muted border border-border'}
                  `}>
                    {isDone ? '✓' : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold ${isDone ? 'text-emerald-300 line-through' : 'text-text-primary'}`}>
                      {q.title}
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">{q.description}</p>
                    <p className="text-xs text-amber-400 mt-1">奖励：{q.rewardText} · +200 经验</p>
                  </div>
                  {isDone && <span className="text-emerald-400 text-xl">✓</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-3 pb-4 pt-3">
          <p className="text-xs text-text-muted text-center">
            💡 主线任务驱动首日目标；每日任务每天给你新的短期目标与额外经验
          </p>
        </div>
      </div>
    </div>
  );
}

export default QuestPanel;

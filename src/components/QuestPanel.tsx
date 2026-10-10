import { QUESTS } from '../game/quests';
import { useGame } from '../store/gameStore';

export function QuestPanel({ onClose }: { onClose: () => void }) {
  const completed = useGame((s) => s.completedQuests);

  const totalQuests = QUESTS.length;
  const doneCount = completed.length;
  const allDone = doneCount === totalQuests;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-bg-card border border-border w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[80vh] overflow-y-auto anim-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-bg-card border-b border-border px-4 py-3 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-text-primary">📜 洪荒征途</h2>
            <p className="text-xs text-text-muted mt-0.5">完成 {doneCount}/{totalQuests}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl px-2">×</button>
        </div>

        <div className="p-3 space-y-2">
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
                  <p className="text-xs text-amber-400 mt-1">奖励：{q.rewardText}</p>
                </div>
                {isDone && <span className="text-emerald-400 text-xl">✓</span>}
              </div>
            );
          })}
        </div>

        <div className="px-3 pb-4">
          <p className="text-xs text-text-muted text-center">
            💡 任务奖励验证 D1 留存假设：让玩家前 2 小时持续有目标感
          </p>
        </div>
      </div>
    </div>
  );
}

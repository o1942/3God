import type { BuildTask } from '../game/types';
import { BUILDING_CONFIGS, FIELD_CONFIGS } from '../game/config';
import { ACCEL_COST_JADE, DAILY_ACCEL_LIMIT } from '../game/cosmetics';
import { useGame } from '../store/gameStore';

export function BuildQueue() {
  const village = useGame((s) => s.village);
  const queue = village.buildQueue;
  const cancelTask = useGame((s) => s.cancelTask);
  const accelerateTaskByRatio = useGame((s) => s.accelerateTaskByRatio);

  if (queue.length === 0) return null;

  const accelLeft = DAILY_ACCEL_LIMIT - village.accelUsedToday;

  return (
    <div className="fixed top-20 right-3 card-std p-3 w-64 z-40 anim-slide-up max-w-[calc(100vw-24px)]" style={{ backdropFilter: 'blur(8px)' }}>
      <div className="text-xs font-semibold tracking-wide text-text-muted mb-2 uppercase flex justify-between items-center">
        <span>建造队列</span>
        <span className="text-pop normal-case">⚡ 今日加速 {accelLeft}/{DAILY_ACCEL_LIMIT}</span>
      </div>
      {queue.map((task) => (
        <QueueItem
          key={task.id}
          task={task}
          onCancel={() => cancelTask(task.id)}
          onAccelerate={() => accelerateTaskByRatio(task.id, 0.3)}
        />
      ))}
      <div className="text-[10px] text-text-muted mt-2 pt-2 border-t border-border/60">
        💡 加速消耗 {ACCEL_COST_JADE}💎，每日上限 {DAILY_ACCEL_LIMIT} 次（反P2W）
      </div>
    </div>
  );
}

function QueueItem({ task, onCancel, onAccelerate }: { task: BuildTask; onCancel: () => void; onAccelerate: () => void }) {
  const name = getTaskName(task);
  const total = task.duration;
  const elapsed = Math.min(total, Date.now() - task.startAt);
  const progress = (elapsed / total) * 100;
  const remainingSec = Math.max(0, Math.ceil((total - elapsed) / 1000));

  return (
    <div className="py-2 border-b border-border last:border-0">
      <div className="flex justify-between items-center text-sm mb-1">
        <span className="font-medium truncate text-text-primary">{name}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs text-text-muted">{formatTime(remainingSec)}</span>
          <button onClick={onCancel} className="text-red-400 hover:text-red-300 text-xs px-1">×</button>
        </div>
      </div>
      <div className="w-full bg-bg-primary rounded-full h-1.5 overflow-hidden">
        <div className="bg-pop h-full transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex justify-between items-center mt-1.5">
        <div className="text-[10px] text-text-muted">Lv{task.fromLevel} → Lv{task.toLevel}</div>
        <button
          onClick={onAccelerate}
          disabled={remainingSec <= 0}
          className="text-[10px] px-2 py-0.5 bg-pop/20 text-pop rounded hover:bg-pop/30 disabled:opacity-30 transition"
        >
          ⚡ -30%
        </button>
      </div>
    </div>
  );
}

function getTaskName(task: BuildTask): string {
  if (task.target.kind === 'field') {
    const cfg = FIELD_CONFIGS[task.target.fieldType];
    return `${cfg.emoji} ${cfg.name} #${task.target.index + 1}`;
  }
  const cfg = BUILDING_CONFIGS[task.target.building];
  return `${cfg.emoji} ${cfg.name}`;
}

function formatTime(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

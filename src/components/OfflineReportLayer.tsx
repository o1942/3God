import { useEffect } from 'react';
import { useGame } from '../store/gameStore';
import { playSound } from '../game/sound';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}时${m}分`;
}

export function OfflineReportLayer() {
  const report = useGame((s) => s.offlineReport);
  const dismiss = useGame((s) => s.dismissOfflineReport);

  // 弹窗时播放通知音 + 震动
  useEffect(() => {
    if (report) {
      playSound('notify');
    }
  }, [report]);

  if (!report) return null;

  const r = report.gatheredResources;
  const totalRes = Math.floor(r.wood + r.clay + r.iron + r.crop);
  const hasGathered = totalRes > 0;

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 anim-battle-bg">
      <div className="bg-bg-card border-2 border-pop rounded-2xl p-5 max-w-md w-full anim-battle-card shadow-[0_0_30px_rgba(201,136,42,0.4)]">
        <h2 className="text-2xl font-bold text-center mb-2 text-pop anim-battle-title">
          🌙 欢迎回来！
        </h2>
        <p className="text-text-secondary text-center text-xs mb-4">
          您已离线 <span className="font-bold text-pop">{formatDuration(report.offlineSeconds)}</span>
        </p>

        {/* 资源累积 */}
        <div className="border-t border-border pt-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-muted text-xs">📊 期间资源产出</span>
            {hasGathered && (
              <span className="text-pop text-xs font-bold">合计 +{totalRes.toLocaleString()}</span>
            )}
          </div>
          {hasGathered ? (
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: '木', val: r.wood, color: 'text-amber-800', bg: 'bg-amber-50 border-amber-200' },
                { label: '陶土', val: r.clay, color: 'text-yellow-800', bg: 'bg-yellow-50 border-yellow-200' },
                { label: '铜', val: r.iron, color: 'text-orange-800', bg: 'bg-orange-50 border-orange-200' },
                { label: '粟', val: r.crop, color: 'text-lime-800', bg: 'bg-lime-50 border-lime-200' },
              ].map((item, i) => (
                <div key={i} className={`${item.bg} border rounded p-1.5 anim-slide-up`} style={{ animationDelay: `${i * 60}ms` }}>
                  <div className={`text-xs ${item.color}`}>{item.label}</div>
                  <div className={`font-bold ${item.color}`}>+{Math.floor(item.val)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-xs text-text-muted">资源已满，无法继续累积</div>
          )}
        </div>

        {/* 巡逻队事件 */}
        {report.patrolEvent && (
          <div className="border-t border-border pt-3 mb-3 anim-fade-in">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="text-sm font-semibold text-emerald-800 mb-1">
                🛡️ 巡守队击退妖兽
              </div>
              <div className="text-xs text-emerald-700">
                击退 {report.patrolEvent.raidersRepelled} 只妖兽，抢救 {report.patrolEvent.cropSaved} 粟米
              </div>
            </div>
          </div>
        )}

        <button
          onClick={dismiss}
          className="w-full py-2.5 bg-pop hover:bg-pop-hover rounded-lg font-semibold text-white anim-pop-btn"
        >
          收下收益
        </button>
      </div>
    </div>
  );
}

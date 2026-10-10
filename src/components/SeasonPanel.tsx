import { SEASON_MILESTONES } from '../game/season';
import { useGame } from '../store/gameStore';

function formatRemaining(ms: number): string {
  if (ms <= 0) return '已结束';
  const days = Math.floor(ms / (24 * 3600 * 1000));
  const hours = Math.floor((ms % (24 * 3600 * 1000)) / (3600 * 1000));
  const mins = Math.floor((ms % (3600 * 1000)) / (60 * 1000));
  if (days > 0) return `${days}天 ${hours}时`;
  if (hours > 0) return `${hours}时 ${mins}分`;
  return `${mins}分`;
}

export function SeasonPanel({ onClose }: { onClose: () => void }) {
  const village = useGame((s) => s.village);
  const claimMilestone = useGame((s) => s.claimSeasonMilestone);
  const season = village.season;

  const endsIn = season.endsAt - Date.now();
  const nextMilestone = SEASON_MILESTONES.find(
    (m) => season.points >= m.points && !season.claimedMilestones.includes(m.points)
  );
  const upcomingMilestone = SEASON_MILESTONES.find(
    (m) => season.points < m.points
  );
  const progress = upcomingMilestone
    ? Math.min(100, (season.points / upcomingMilestone.points) * 100)
    : 100;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-bg-card border-t sm:border border-border sm:rounded-2xl rounded-t-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto anim-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-bg-card border-b border-border px-4 py-3 flex justify-between items-center z-10">
          <div>
            <h2 className="text-lg font-bold text-text-primary">🏆 赛季</h2>
            <p className="text-xs text-text-muted">第 {season.number} 赛季 · 剩余 {formatRemaining(endsIn)}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl px-2">×</button>
        </div>

        <div className="p-3 space-y-3">
          {/* 当前积分 + 进度 */}
          <div className="border border-border rounded-lg p-3 bg-bg-secondary">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-sm text-text-secondary">当前积分</span>
              <span className="text-2xl font-bold text-pop">{season.points}</span>
            </div>
            {upcomingMilestone ? (
              <>
                <div className="text-xs text-text-muted mb-1">
                  下一档：{upcomingMilestone.title}（{upcomingMilestone.points} 积分）
                </div>
                <div className="w-full bg-bg-primary rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-pop h-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-[10px] text-text-muted mt-1 text-right">
                  还差 {upcomingMilestone.points - season.points} 积分
                </div>
              </>
            ) : (
              <div className="text-xs text-emerald-600 font-semibold text-center mt-1">
                🎉 已达成所有里程碑！
              </div>
            )}
          </div>

          {/* 立即领取按钮 */}
          {nextMilestone && (
            <button
              onClick={() => claimMilestone(nextMilestone.points)}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold anim-pop-btn"
            >
              🎁 立即领取：{nextMilestone.title}（+{nextMilestone.reward.wood} 全资源）
            </button>
          )}

          {/* 里程碑列表 */}
          <div>
            <h3 className="font-semibold text-text-primary text-sm mb-2">赛季里程碑</h3>
            <div className="space-y-2">
              {SEASON_MILESTONES.map((m) => {
                const claimed = season.claimedMilestones.includes(m.points);
                const unlocked = season.points >= m.points;
                return (
                  <div
                    key={m.points}
                    className={`
                      border rounded-lg p-3 flex items-center gap-3
                      ${claimed ? 'bg-emerald-50 border-emerald-300' :
                        unlocked ? 'bg-amber-50 border-amber-300' :
                        'bg-bg-secondary border-border opacity-70'}
                    `}
                  >
                    <div className="text-2xl">
                      {claimed ? '✅' : unlocked ? '🎁' : '🔒'}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-text-primary text-sm">{m.title}</div>
                      <div className="text-xs text-text-muted">{m.points} 积分</div>
                      <div className="text-xs text-amber-700">
                        +{m.reward.wood}木 / +{m.reward.clay}陶土 / +{m.reward.iron}铜 / +{m.reward.crop}粟
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 积分规则 */}
          <div className="border border-border rounded-lg p-3 bg-bg-secondary">
            <h3 className="font-semibold text-text-primary text-sm mb-2">积分获取方式</h3>
            <ul className="text-xs text-text-secondary space-y-1">
              <li>• 升级资源田 <span className="text-pop font-semibold">+5</span> 积分/级</li>
              <li>• 升级建筑 <span className="text-pop font-semibold">+10</span> 积分/级</li>
              <li>• 训练士兵 <span className="text-pop font-semibold">+2</span> 积分/只</li>
              <li>• 战斗胜利 <span className="text-pop font-semibold">+30</span> 积分/次</li>
              <li>• 完成任务 <span className="text-pop font-semibold">+50</span> 积分/个</li>
            </ul>
          </div>

          <p className="text-xs text-text-muted text-center">
            赛季结束时积分将重置，但部落保留
          </p>
        </div>
      </div>
    </div>
  );
}

export default SeasonPanel;

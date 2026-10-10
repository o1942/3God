import { useEffect, useState } from 'react';
import { SEASON_MILESTONES } from '../game/season';
import { useGame } from '../store/gameStore';
import { playSound } from '../game/sound';

export function SeasonEndOverlay() {
  const report = useGame((s) => s.seasonEndReport);
  const dismiss = useGame((s) => s.dismissSeasonEnd);
  const seasonPoints = useGame((s) => s.village.season.points);
  const [phase, setPhase] = useState<'summary' | 'rewards' | 'done'>('summary');

  useEffect(() => {
    if (report && phase === 'summary') {
      playSound('quest_complete');
    }
  }, [report, phase]);

  if (!report) return null;

  // 检查上赛季达到的里程碑
  const achievedMilestones = SEASON_MILESTONES.filter(m => report.oldPoints >= m.points);
  const totalJade = achievedMilestones.reduce((sum, m) => sum + m.jade, 0);

  const handleNext = () => {
    if (phase === 'summary') {
      setPhase('rewards');
      playSound('coin');
    } else {
      dismiss();
      setPhase('summary');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-4 anim-battle-bg">
      <div className="card-std border-2 border-pop rounded-2xl p-6 max-w-md w-full anim-battle-card" style={{ boxShadow: '0 0 40px rgba(201,136,42,0.5)' }}>

        {phase === 'summary' && (
          <>
            {/* 赛季结算标题 */}
            <div className="text-center mb-5">
              <div className="text-4xl mb-2">🏆</div>
              <h2 className="text-2xl font-bold text-pop mb-1 anim-battle-title">
                第 {report.oldSeason} 赛季结算
              </h2>
              <p className="text-text-secondary text-sm">洪荒争锋，尘埃落定</p>
            </div>

            {/* 积分展示 */}
            <div className="text-center mb-5">
              <div className="text-text-muted text-xs mb-1">本赛季最终积分</div>
              <div className="text-4xl font-bold text-pop">{report.oldPoints.toLocaleString()}</div>
            </div>

            {/* 达成的里程碑 */}
            <div className="border-t border-border pt-3 mb-4">
              <div className="text-text-muted text-xs text-center mb-2">达成里程碑</div>
              {achievedMilestones.length > 0 ? (
                <div className="space-y-1.5">
                  {achievedMilestones.map((m, i) => (
                    <div
                      key={m.points}
                      className="flex items-center justify-between bg-bg-secondary rounded-lg px-3 py-1.5 anim-slide-up"
                      style={{ animationDelay: `${i * 100}ms` }}
                    >
                      <span className="text-sm font-semibold text-text-primary">{m.title}</span>
                      <span className="text-xs text-emerald-700">💎 {m.jade} 纹玉</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-xs text-text-muted">本赛季未达成里程碑，继续努力！</p>
              )}
            </div>

            {totalJade > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center mb-4 anim-fade-in">
                <span className="text-sm text-emerald-800 font-bold">💎 纹玉奖励合计 {totalJade}</span>
              </div>
            )}

            <button
              onClick={handleNext}
              className="w-full py-2.5 bg-pop hover:bg-pop-hover rounded-lg font-semibold text-white anim-pop-btn"
            >
              进入新赛季
            </button>
          </>
        )}

        {phase === 'rewards' && (
          <>
            <div className="text-center mb-5">
              <div className="text-4xl mb-2">🎉</div>
              <h2 className="text-2xl font-bold text-pop mb-1">
                第 {report.newSeason} 赛季开启
              </h2>
              <p className="text-text-secondary text-sm">新的征程已经开始</p>
            </div>

            <div className="bg-bg-secondary rounded-lg p-4 text-center mb-4">
              <div className="text-text-muted text-xs mb-1">新赛季起始积分</div>
              <div className="text-3xl font-bold text-pop">{seasonPoints}</div>
              <div className="text-text-muted text-[10px] mt-1">积分已重置，村庄和建筑保留</div>
            </div>

            <div className="text-center text-xs text-text-muted mb-4 leading-relaxed">
              💡 每升一级资源田 +5 分<br />
              每升一级建筑 +10 分<br />
              每次战斗胜利 +30 分<br />
              积分达标可领取丰厚奖励
            </div>

            <button
              onClick={handleNext}
              className="w-full py-2.5 bg-pop hover:bg-pop-hover rounded-lg font-semibold text-white anim-pop-btn"
            >
              开启新征程
            </button>
          </>
        )}

      </div>
    </div>
  );
}

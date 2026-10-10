import { FORMATIONS, UNIT_ORDER, getUnitDisplay } from '../game/units';
import { TRIBE_CONFIGS } from '../game/tribes';
import { useGame } from '../store/gameStore';

export function BattleReportLayer() {
  const reports = useGame((s) => s.battleReports);
  const dismiss = useGame((s) => s.dismissBattleReport);
  const tribe = useGame((s) => s.village.tribe);

  // 只显示最新的 1 个
  const latest = reports[reports.length - 1];
  if (!latest) return null;

  const id = `${latest.campId}-${latest.at}`;
  const survived = latest.attackerLost === 0;

  const handleClose = () => {
    dismiss(id);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 anim-battle-bg">
      <div
        className={`
          bg-bg-card border-2 rounded-2xl p-5 max-w-md w-full anim-battle-card
          ${latest.win ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)]' : 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]'}
        `}
      >
        {/* 标题 */}
        <h2 className={`text-2xl font-bold text-center mb-3 anim-battle-title ${latest.win ? 'text-emerald-600' : 'text-red-600'}`}>
          {latest.win ? '🏹 大捷！' : '🏹 败北'}
        </h2>
        <div className="text-text-secondary text-center text-xs mb-1">
          战场：{latest.campName} · 阵型：{FORMATIONS[latest.formation].emoji} {FORMATIONS[latest.formation].name}
        </div>

        {/* 双方对比 */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
            <div className="text-xs text-blue-700">我方部落</div>
            <div className="text-lg font-bold text-blue-800">{survived ? '0' : `-${latest.attackerLost}`}</div>
            <div className="text-[10px] text-blue-600">总损失</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
            <div className="text-xs text-red-700">妖兽</div>
            <div className="text-lg font-bold text-red-800">-{latest.defenderLost}</div>
            <div className="text-[10px] text-red-600">妖兽损失</div>
          </div>
        </div>

        {/* 分兵种损失 */}
        {latest.attackerLost > 0 && (
          <div className="border border-border rounded-lg p-2 mb-3 bg-bg-secondary">
            <div className="text-[11px] text-text-muted mb-1">分兵种损失</div>
            <div className="flex flex-wrap gap-2">
              {UNIT_ORDER.map((u) => {
                const lost = latest.attackerLostByUnit[u] || 0;
                if (lost <= 0) return null;
                const d = getUnitDisplay(tribe, u);
                return (
                  <span key={u} className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded">
                    {d.emoji} {d.name} -{lost}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* 战利品 */}
        {latest.win && (
          <div className="border-t border-border pt-3 mb-3">
            <div className="text-text-muted text-center text-xs mb-2">🎁 战利品</div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-amber-50 border border-amber-200 rounded p-1.5">
                <div className="text-xs text-amber-700">木</div>
                <div className="font-bold text-amber-800">+{latest.reward.wood}</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-1.5">
                <div className="text-xs text-yellow-700">陶土</div>
                <div className="font-bold text-yellow-800">+{latest.reward.clay}</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded p-1.5">
                <div className="text-xs text-orange-700">铜</div>
                <div className="font-bold text-orange-800">+{latest.reward.iron}</div>
              </div>
              <div className="bg-lime-50 border border-lime-200 rounded p-1.5">
                <div className="text-xs text-lime-700">粟</div>
                <div className="font-bold text-lime-800">+{latest.reward.crop}</div>
              </div>
            </div>
          </div>
        )}

        {!latest.win && (
          <div className="text-center text-xs text-text-muted border-t border-border pt-3 mb-3">
            部落战士全军覆没，建议训练更多兵力再战
          </div>
        )}

        <button
          onClick={handleClose}
          className="w-full py-2.5 bg-pop hover:bg-pop-hover rounded-lg font-semibold text-white anim-pop-btn"
        >
          确认
        </button>
      </div>
    </div>
  );
}

// PVP 战报浮层：玩家攻击 NPC 村庄的结果
export function PvpReportLayer() {
  const reports = useGame((s) => s.pvpReports);
  const dismiss = useGame((s) => s.dismissPvpReport);
  const tribe = useGame((s) => s.village.tribe);

  const latest = reports[reports.length - 1];
  if (!latest) return null;

  const targetTribe = TRIBE_CONFIGS[latest.targetTribe];

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 anim-battle-bg">
      <div
        className={`
          bg-bg-card border-2 rounded-2xl p-5 max-w-md w-full anim-battle-card
          ${latest.win ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)]' : 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]'}
        `}
      >
        <h2 className={`text-2xl font-bold text-center mb-3 anim-battle-title ${latest.win ? 'text-emerald-600' : 'text-red-600'}`}>
          {latest.win ? '⚔️ 攻破敌营！' : '⚔️ 攻城失败'}
        </h2>
        <div className="text-text-secondary text-center text-xs mb-3">
          目标：{targetTribe.emoji} {latest.targetName}（{targetTribe.name}）· 阵型：{FORMATIONS[latest.formation].emoji} {FORMATIONS[latest.formation].name}
        </div>

        {/* 双方对比 */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
            <div className="text-xs text-blue-700">我方</div>
            <div className="text-lg font-bold text-blue-800">-{latest.attackerLost}</div>
            <div className="text-[10px] text-blue-600">兵力损失</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
            <div className="text-xs text-red-700">守军</div>
            <div className="text-lg font-bold text-red-800">-{latest.defenderLost}</div>
            <div className="text-[10px] text-red-600">守军损失</div>
          </div>
        </div>

        {/* 分兵种损失 */}
        {latest.attackerLost > 0 && (
          <div className="border border-border rounded-lg p-2 mb-3 bg-bg-secondary">
            <div className="text-[11px] text-text-muted mb-1">我方分兵种损失</div>
            <div className="flex flex-wrap gap-2">
              {UNIT_ORDER.map((u) => {
                const lost = latest.attackerLostByUnit[u] || 0;
                if (lost <= 0) return null;
                const d = getUnitDisplay(tribe, u);
                return (
                  <span key={u} className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded">
                    {d.emoji} {d.name} -{lost}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* 掠夺资源 */}
        {latest.win && (
          <div className="border-t border-border pt-3 mb-3">
            <div className="text-text-muted text-center text-xs mb-2">💰 掠夺资源</div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-amber-50 border border-amber-200 rounded p-1.5">
                <div className="text-xs text-amber-700">木</div>
                <div className="font-bold text-amber-800">+{latest.plundered.wood}</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-1.5">
                <div className="text-xs text-yellow-700">陶土</div>
                <div className="font-bold text-yellow-800">+{latest.plundered.clay}</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded p-1.5">
                <div className="text-xs text-orange-700">铜</div>
                <div className="font-bold text-orange-800">+{latest.plundered.iron}</div>
              </div>
              <div className="bg-lime-50 border border-lime-200 rounded p-1.5">
                <div className="text-xs text-lime-700">粟</div>
                <div className="font-bold text-lime-800">+{latest.plundered.crop}</div>
              </div>
            </div>
            <p className="text-[10px] text-text-muted text-center mt-2">⚠️ 战胜后敌方可能发起反击</p>
          </div>
        )}

        {!latest.win && (
          <div className="text-center text-xs text-text-muted border-t border-border pt-3 mb-3">
            出征部队全军覆没，建议侦查守军后调整阵型与兵种克制再战
          </div>
        )}

        <button
          onClick={() => dismiss(latest.id)}
          className="w-full py-2.5 bg-pop hover:bg-pop-hover rounded-lg font-semibold text-white anim-pop-btn"
        >
          确认
        </button>
      </div>
    </div>
  );
}

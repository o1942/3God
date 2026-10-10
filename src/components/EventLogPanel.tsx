import { useEffect } from 'react';
import { getRaiderConfig } from '../game/units';
import { TRIBE_CONFIGS } from '../game/tribes';
import { useGame } from '../store/gameStore';
import { isShielded } from '../game/shield';

// 事件日志面板：汇总展示玩家所有战斗与事件记录
export function EventLogPanel({ onClose }: { onClose: () => void }) {
  const village = useGame((s) => s.village);
  const battleReports = useGame((s) => s.battleReports);
  const pvpReports = useGame((s) => s.pvpReports);
  const offlineReport = useGame((s) => s.offlineReport);
  const dismissBattleReport = useGame((s) => s.dismissBattleReport);
  const dismissPvpReport = useGame((s) => s.dismissPvpReport);
  const markAllIncomingSeen = useGame((s) => s.markAllIncomingSeen);

  // 打开日志即视为已读，清除角标
  useEffect(() => {
    markAllIncomingSeen();
  }, [markAllIncomingSeen]);

  // 汇总所有事件，按时间倒序
  type EventItem = {
    time: number;
    icon: string;
    title: string;
    detail: string;
    result: 'win' | 'lose' | 'info';
    id: string;
    onDismiss?: () => void;
  };

  const events: EventItem[] = [];

  // 妖兽防御战报
  if (village.lastDefenseReport) {
    const r = village.lastDefenseReport;
    const rc = getRaiderConfig(r.raiderType);
    events.push({
      time: r.time,
      icon: rc.emoji,
      title: `${r.won ? '抵御' : '失守'} · ${rc.name}入侵`,
      detail: `妖兽 ${r.raiderCount} 只 · ${r.won ? '防御成功' : `被掠 ${r.resourcesStolen.wood + r.resourcesStolen.clay + r.resourcesStolen.iron + r.resourcesStolen.crop} 资源`}`,
      result: r.won ? 'win' : 'lose',
      id: `defense-${r.time}`,
    });
  }

  // PVP 防御战报（被 NPC 袭击）
  if (village.lastPvpDefenseReport) {
    const r = village.lastPvpDefenseReport;
    const t = TRIBE_CONFIGS[r.attackerTribe];
    events.push({
      time: r.time,
      icon: t.emoji,
      title: `${r.won ? '击退' : '被破'} · ${r.attackerName}来袭`,
      detail: `敌损 ${r.attackerLost} · 我损 ${r.troopsLost}${!r.won ? ` · 被掠 ${r.resourcesStolen.wood + r.resourcesStolen.clay + r.resourcesStolen.iron + r.resourcesStolen.crop}` : ''}`,
      result: r.won ? 'win' : 'lose',
      id: `pvpdef-${r.time}`,
    });
  }

  // 跨玩家来袭战报（真实玩家进攻本村）
  for (const a of village.incomingAttacks || []) {
    const t = TRIBE_CONFIGS[a.attackerTribe] || TRIBE_CONFIGS.huang;
    const total = a.plundered.wood + a.plundered.clay + a.plundered.iron + a.plundered.crop;
    events.push({
      time: a.time,
      icon: t.emoji,
      title: `${a.won ? '被攻破' : '成功抵御'} · ${a.attackerName}来袭`,
      detail: `我损 ${a.troopsLost}${a.won ? ` · 被掠 ${total}` : ' · 守军击退敌军'}`,
      result: a.won ? 'lose' : 'win',
      id: a.id,
    });
  }

  // 出征战报（据点）
  for (const r of battleReports) {
    events.push({
      time: r.at,
      icon: '🏹',
      title: `${r.win ? '攻克' : '败退'} · ${r.campName}`,
      detail: `损失 ${r.attackerLost} · 敌损 ${r.defenderLost}${r.win ? ` · 获 ${r.reward.wood + r.reward.clay + r.reward.iron + r.reward.crop}` : ''}`,
      result: r.win ? 'win' : 'lose',
      id: `${r.campId}-${r.at}`,
      onDismiss: () => dismissBattleReport(`${r.campId}-${r.at}`),
    });
  }

  // PVP 攻击战报
  for (const r of pvpReports) {
    const t = TRIBE_CONFIGS[r.targetTribe];
    events.push({
      time: r.at,
      icon: t.emoji,
      title: `${r.win ? '攻破' : '攻城失败'} · ${r.targetName}`,
      detail: `我损 ${r.attackerLost} · 敌损 ${r.defenderLost}${r.win ? ` · 掠 ${r.plundered.wood + r.plundered.clay + r.plundered.iron + r.plundered.crop}` : ''}`,
      result: r.win ? 'win' : 'lose',
      id: r.id,
      onDismiss: () => dismissPvpReport(r.id),
    });
  }

  // 离线收益
  if (offlineReport) {
    const g = offlineReport.gatheredResources;
    events.push({
      time: offlineReport.at,
      icon: '🌙',
      title: '离线收益',
      detail: `离线 ${Math.round(offlineReport.offlineSeconds / 60)} 分钟 · 收获 ${g.wood + g.clay + g.iron + g.crop}`,
      result: 'info',
      id: 'offline',
    });
  }

  // 行军中任务
  for (const m of village.marchQueue) {
    const remain = Math.max(0, Math.ceil((m.arriveAt - Date.now()) / 1000));
    const kindLabel = m.kind === 'attack' ? '出征' : m.kind === 'garrison' ? '驻守' : m.kind === 'pvpAttack' ? '攻伐' : m.kind === 'realAttack' ? '讨伐玩家' : '敌袭';
    events.push({
      time: m.startAt,
      icon: m.kind === 'pvpRaid' ? '⚠️' : '🚶',
      title: `${kindLabel} · ${m.campName}`,
      detail: `行军中 · 剩余 ${remain}s`,
      result: 'info',
      id: m.id,
    });
  }

  // 按时间倒序
  events.sort((a, b) => b.time - a.time);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const resultStyle: Record<string, string> = {
    win: 'border-l-emerald-500',
    lose: 'border-l-red-500',
    info: 'border-l-sky-500',
  };
  const resultIcon: Record<string, string> = {
    win: '✅',
    lose: '❌',
    info: 'ℹ️',
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-bg-card border-t sm:border border-border sm:rounded-2xl rounded-t-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto anim-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-bg-card border-b border-border px-4 py-3 flex justify-between items-center z-10">
          <div>
            <h2 className="text-lg font-bold text-text-primary">📜 事件日志</h2>
            <p className="text-xs text-text-muted">共 {events.length} 条记录</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl px-2">×</button>
        </div>

        <div className="p-3 space-y-2">
          {events.length === 0 && (
            <div className="text-center py-12 text-text-muted text-sm">暂无事件记录</div>
          )}
          {events.map((e) => (
            <div
              key={e.id}
              className={`border-l-4 ${resultStyle[e.result]} border border-border rounded-lg p-3 bg-bg-secondary flex items-start gap-3`}
            >
              <div className="text-2xl shrink-0">{e.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-text-primary text-sm truncate">{e.title}</span>
                  <span className="text-[10px] text-text-muted shrink-0">{formatTime(e.time)}</span>
                </div>
                <div className="text-xs text-text-secondary mt-0.5">{e.detail}</div>
              </div>
              <div className="text-xs shrink-0">{resultIcon[e.result]}</div>
              {e.onDismiss && (
                <button
                  onClick={e.onDismiss}
                  className="text-text-muted hover:text-red-500 text-xs shrink-0"
                  title="删除"
                >
                  🗑
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 护盾状态 */}
        <div className="border-t border-border p-3">
          <div className="text-xs text-text-muted text-center">
            {isShielded(village) ? '🛡️ 护盾保护中' : '⚠️ 无护盾，可能被妖兽或玩家进攻'}
          </div>
        </div>
      </div>
    </div>
  );
}

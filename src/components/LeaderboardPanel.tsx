import { useMemo, useState } from 'react';
import type { FormationType, TribeType, UnitType } from '../game/types';
import { FORMATIONS, FORMATION_ORDER, UNIT_ORDER, getUnitDisplay, predictPvPBattle } from '../game/units';
import { BUILDING_CONFIGS } from '../game/config';
import { TRIBE_CONFIGS } from '../game/tribes';
import { getScoutCostMultiplier } from '../game/tech';
import { computePower, tribeAttackMultiplier, useGame } from '../store/gameStore';

type SortKey = 'power' | 'points';

// 全服排行榜：展示真实玩家（战力/赛季积分），点选可出征
export function LeaderboardPanel({ onClose }: { onClose: () => void }) {
  const village = useGame((s) => s.village);
  const leaderboard = useGame((s) => s.leaderboard);
  const loading = useGame((s) => s.isLeaderboardLoading);
  const refresh = useGame((s) => s.refreshLeaderboard);
  const attackRealPlayer = useGame((s) => s.attackRealPlayer);

  const [sortKey, setSortKey] = useState<SortKey>('power');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deployed, setDeployed] = useState<Partial<Record<UnitType, number>>>({});
  const [formation, setFormation] = useState<FormationType>('wings');
  const [scouted, setScouted] = useState<Set<string>>(new Set());

  const rallyLv = village.buildings.rallyPoint || 0;
  const deployLimit = rallyLv > 0 ? BUILDING_CONFIGS.rallyPoint.levels[rallyLv - 1].effect.deployLimit || 0 : 0;
  const totalDeployed = UNIT_ORDER.reduce((s, u) => s + (deployed[u] || 0), 0);
  const overLimit = totalDeployed > deployLimit;

  const rows = useMemo(() => {
    return leaderboard
      .map((e) => ({
        ...e,
        power: computePower(e.units as Partial<Record<UnitType, number>>, e.wallLevel, e.buildingSum),
      }))
      .sort((a, b) => (sortKey === 'power' ? b.power - a.power : b.points - a.points));
  }, [leaderboard, sortKey]);

  const myIndex = rows.findIndex((r) => r.playerName === village.playerName);
  const myRow = myIndex >= 0 ? rows[myIndex] : null;

  const atkMult = FORMATIONS[formation].atkMod * tribeAttackMultiplier(village);

  const resetDeploy = () => setDeployed({});

  const scoutCost = Math.round(80 * getScoutCostMultiplier(village.techLevels));
  const handleScout = (name: string) => {
    if (village.resources.iron < scoutCost) {
      return;
    }
    useGame.setState((s) => ({
      village: { ...s.village, resources: { ...s.village.resources, iron: s.village.resources.iron - scoutCost } }
    }));
    setScouted((prev) => new Set(prev).add(name));
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-bg-card border-t sm:border border-border sm:rounded-2xl rounded-t-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto anim-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-bg-card border-b border-border px-4 py-3 flex justify-between items-center z-10">
          <div>
            <h2 className="text-lg font-bold text-text-primary">🌐 全服排行</h2>
            <p className="text-xs text-text-muted">
              {rows.length} 位玩家 · {myRow ? `我的排名 #${myIndex + 1}` : '尚未上榜'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => refresh()}
              className="text-sm px-2 py-1 rounded border border-border text-text-secondary hover:border-pop"
            >
              {loading ? '刷新中…' : '🔄 刷新'}
            </button>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl px-1">×</button>
          </div>
        </div>

        <div className="p-3 space-y-3">
          {/* 排序切换 */}
          <div className="flex gap-2">
            {(['power', 'points'] as SortKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setSortKey(k)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition
                  ${sortKey === k ? 'bg-pop text-white border-pop' : 'bg-bg-secondary text-text-secondary border-border'}`}
              >
                {k === 'power' ? '⚔️ 实力榜' : '🏆 赛季榜'}
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="text-center text-sm text-text-muted py-8">
              {loading ? '加载中…' : '暂无其他玩家 · 快去邀请同伴吧'}
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((r, i) => {
                const isMe = r.playerName === village.playerName;
                const shielded = r.shieldUntil > Date.now();
                const open = expanded === r.playerName;
                const t = TRIBE_CONFIGS[(r.tribe as TribeType)] || TRIBE_CONFIGS.huang;
                const pred = open && totalDeployed > 0
                  ? predictPvPBattle(deployed, village.tribe, r.units as Partial<Record<UnitType, number>>, (r.tribe as TribeType), r.wallLevel, atkMult, FORMATIONS[formation].defMod)
                  : null;
                return (
                  <div
                    key={r.playerName}
                    className={`border rounded-lg ${isMe ? 'border-pop bg-pop/5' : 'border-border bg-bg-secondary'}`}
                  >
                    <div className="flex items-center gap-2 p-2.5">
                      <div className={`w-7 text-center font-bold text-sm ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-700' : 'text-text-muted'}`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-text-primary truncate">
                            {t.emoji} {r.playerName}
                          </span>
                          {isMe && <span className="text-[10px] px-1 rounded bg-pop text-white">我</span>}
                          {shielded && <span className="text-[10px] px-1 rounded bg-emerald-100 text-emerald-700">🛡️ 保护中</span>}
                        </div>
                        <div className="text-[11px] text-text-muted">
                          战力 {r.power} · 积分 {r.points} · 城墙 Lv{r.wallLevel}
                          {scouted.has(r.playerName) && !isMe && (
                            <span className="ml-1">· {' '}
                              {UNIT_ORDER.map((u) => {
                                const cnt = (r.units as any)?.[u] || 0;
                                if (cnt === 0) return null;
                                return `${getUnitDisplay(village.tribe, u).emoji}${cnt}`;
                              }).filter(Boolean).join(' ')}
                            </span>
                          )}
                        </div>
                      </div>
                      {!isMe && (
                        <div className="flex items-center gap-1 shrink-0">
                          {!scouted.has(r.playerName) && (
                            <button
                              onClick={() => handleScout(r.playerName)}
                              disabled={village.resources.iron < scoutCost}
                              className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50 disabled:opacity-40"
                              title={`消耗 ${scoutCost} 铜矿侦查兵种详情`}
                            >
                              🔍
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (open) { setExpanded(null); }
                              else { setExpanded(r.playerName); resetDeploy(); }
                            }}
                            className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 shrink-0"
                          >
                            {open ? '收起' : '出征'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 出征面板 */}
                    {open && !isMe && (
                      <div className="border-t border-border p-3 space-y-2.5">
                        {shielded ? (
                          <div className="text-xs text-emerald-700 bg-emerald-50 rounded p-2">
                            🛡️ 该玩家处于保护期，暂时无法进攻
                          </div>
                        ) : (
                          <>
                            <div className="text-[11px] text-text-muted">
                              守军约 {UNIT_ORDER.reduce((s, u) => s + ((r.units as any)?.[u] || 0), 0)} 人 · 可出征 {deployLimit} 人
                            </div>
                            {deployLimit <= 0 && (
                              <div className="text-xs text-amber-700 bg-amber-50 rounded p-2">
                                需先建造点将台才能出征
                              </div>
                            )}
                            {/* 选兵 */}
                            <div className="grid grid-cols-2 gap-2">
                              {UNIT_ORDER.map((u) => {
                                const disp = getUnitDisplay(village.tribe, u);
                                const have = village.units[u] || 0;
                                return (
                                  <div key={u} className="border border-border rounded p-2 bg-bg-card">
                                    <div className="text-[11px] text-text-secondary mb-1">
                                      {disp.emoji} {disp.name}（有 {have}）
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min={0}
                                        max={have}
                                        value={deployed[u] || 0}
                                        onChange={(e) => {
                                          const n = Math.max(0, Math.min(have, parseInt(e.target.value) || 0));
                                          setDeployed((d) => ({ ...d, [u]: n }));
                                        }}
                                        className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-xs text-text-primary"
                                      />
                                      <button
                                        onClick={() => setDeployed((d) => ({ ...d, [u]: have }))}
                                        className="text-[10px] px-1.5 py-0.5 rounded border border-border text-text-muted shrink-0"
                                      >
                                        全
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {/* 阵型 */}
                            <div>
                              <div className="text-[11px] text-text-muted mb-1">阵型</div>
                              <div className="grid grid-cols-4 gap-1.5">
                                {FORMATION_ORDER.map((f) => (
                                  <button
                                    key={f}
                                    onClick={() => setFormation(f)}
                                    className={`py-1 rounded text-[11px] border transition
                                      ${formation === f ? 'bg-pop text-white border-pop' : 'bg-bg-card text-text-secondary border-border'}`}
                                  >
                                    {FORMATIONS[f].name}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {/* 预估 */}
                            {pred && (
                              <div className={`text-xs rounded p-2 ${pred.winChance >= 0.5 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                预估胜率 {Math.round(pred.winChance * 100)}% · 我方 {Math.round(pred.atkPower)} / 敌方 {Math.round(pred.defPower)}
                              </div>
                            )}
                            {overLimit && (
                              <div className="text-xs text-red-600">出征兵力超过点将台上限（{deployLimit}）</div>
                            )}
                            <button
                              disabled={totalDeployed <= 0 || overLimit || deployLimit <= 0}
                              onClick={() => {
                                const ok = attackRealPlayer(r.playerName, deployed, formation);
                                if (ok) { setExpanded(null); resetDeploy(); }
                              }}
                              className="w-full py-2.5 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                              ⚔️ 出征 {r.playerName}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-text-muted text-center pt-1">
            出征部队会在途中暴露，抵达后自动结算 · 目标处于护盾保护期时攻击会被拦截
          </p>
        </div>
      </div>
    </div>
  );
}

export default LeaderboardPanel;
import { useEffect, useState } from 'react';
import type { FormationType, TribeType, UnitType } from '../game/types';
import { CAMP_TEMPLATES, FORMATIONS, FORMATION_ORDER, UNIT_ORDER, calcMarchTime, getRaiderConfig, getUnitDisplay, predictBattle, predictPvPBattle } from '../game/units';
import { BUILDING_CONFIGS } from '../game/config';
import { tribeAttackMultiplier, useGame } from '../store/gameStore';
import { isShielded, shieldRemainingMs } from '../game/shield';
import { NPC_REVIVE_MS } from '../game/pvp';
import { TRIBE_CONFIGS } from '../game/tribes';

// 地图面板：据点列表 + 选兵出征 + 阵型 + 行军/驻守/侦查
export function MapPanel({ onClose }: { onClose: () => void }) {
  const village = useGame((s) => s.village);
  const attackCamp = useGame((s) => s.attackCamp);
  const garrisonCamp = useGame((s) => s.garrisonCamp);
  const recallGarrison = useGame((s) => s.recallGarrison);
  const scoutCamp = useGame((s) => s.scoutCamp);
  const attackPlayer = useGame((s) => s.attackPlayer);
  const scoutPlayer = useGame((s) => s.scoutPlayer);

  const [selectedCampId, setSelectedCampId] = useState<string | null>(null);
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [deployed, setDeployed] = useState<Partial<Record<UnitType, number>>>({});
  const [formation, setFormation] = useState<FormationType>('wings');
  // 每秒触发重渲染，更新行军进度条
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const camps = Object.values(village.camps);
  const npcs = village.players ? Object.values(village.players) : [];
  const selectedCamp = selectedCampId ? village.camps[selectedCampId] : null;
  const selectedNpc = selectedNpcId && village.players ? village.players[selectedNpcId] : null;
  const marchQueue = village.marchQueue;

  const atkMult = FORMATIONS[formation].atkMod * tribeAttackMultiplier(village);
  const defMult = FORMATIONS[formation].defMod;

  const totalDeployed = UNIT_ORDER.reduce((s, u) => s + (deployed[u] || 0), 0);
  const rallyLv = village.buildings.rallyPoint || 0;
  const deployLimit = rallyLv > 0 ? BUILDING_CONFIGS.rallyPoint.levels[rallyLv - 1].effect.deployLimit || 0 : 0;
  const overLimit = totalDeployed > deployLimit;
  const canAttack = selectedCamp && !selectedCamp.occupied && totalDeployed > 0 && !overLimit &&
    ((selectedCamp.kind === 'worldBoss' || selectedCamp.kind === 'realm') ? (selectedCamp.bossActive && selectedCamp.raiders > 0) : selectedCamp.raiders > 0);
  const canGarrison = selectedCamp?.occupied && totalDeployed > 0 && !overLimit;

  const selectedPred = selectedCamp && !selectedCamp.occupied && totalDeployed > 0
    ? predictBattle(deployed, village.tribe, selectedCamp.raiders, selectedCamp.raiderType, atkMult, defMult)
    : null;

  // PVP：NPC 被击败废墟判定
  const isNpcDefeated = selectedNpc && selectedNpc.defeatedAt && Date.now() - selectedNpc.defeatedAt < NPC_REVIVE_MS;
  const canAttackNpc = selectedNpc && !isNpcDefeated && totalDeployed > 0 && !overLimit;
  const npcPred = selectedNpc && !isNpcDefeated && totalDeployed > 0
    ? predictPvPBattle(deployed, village.tribe, selectedNpc.units, selectedNpc.tribe, selectedNpc.wallLevel, atkMult, defMult)
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-bg-card border-t sm:border border-border sm:rounded-2xl rounded-t-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto anim-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-bg-card border-b border-border px-4 py-3 flex justify-between items-center z-10">
          <div>
            <h2 className="text-lg font-bold text-text-primary">🗺️ 洪荒地图</h2>
            <p className="text-xs text-text-muted">据点 {camps.length} · 敌方 {npcs.length} · 行军 {marchQueue.length}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl px-2">×</button>
        </div>

        <div className="p-3 space-y-3">
          {/* 行军队列 */}
          {marchQueue.length > 0 && (
            <div className="border border-border rounded-lg p-3 bg-amber-50">
              <h3 className="font-semibold text-amber-900 text-sm mb-2">🚶 行军队列</h3>
              <div className="space-y-2">
                {marchQueue.map((m) => {
                  const remain = Math.max(0, Math.ceil((m.arriveAt - Date.now()) / 1000));
                  const total = Math.max(1, Math.round((m.arriveAt - m.startAt) / 1000));
                  const elapsed = total - remain;
                  const progress = (elapsed / total) * 100;
                  const kindLabel = m.kind === 'attack' ? '🏹 出征' : m.kind === 'garrison' ? '🏴 驻守' : m.kind === 'recall' ? '↩️ 撤回' : m.kind === 'pvpAttack' ? '⚔️ 攻伐' : m.kind === 'realAttack' ? '⚔️ 讨伐玩家' : '⚠️ 敌袭';
                  return (
                    <div key={m.id}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-text-primary">{kindLabel} {m.campName}</span>
                        <span className="text-text-muted">{remain}s</span>
                      </div>
                      <div className="w-full bg-bg-primary rounded-full h-1.5">
                        <div className="bg-pop h-full rounded-full transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 简化地图 */}
          <div className="relative bg-gradient-to-br from-amber-50 to-emerald-50 border border-border rounded-lg p-3 mb-1 h-52 overflow-hidden">
            <div className="absolute left-[20%] bottom-[20%] -translate-x-1/2 -translate-y-1/2 bg-bg-card border-2 border-pop rounded-lg px-2 py-1 text-xs">
              <div className="text-base text-center">⛰️</div>
              <div className="text-text-primary font-semibold">我方部落</div>
            </div>
            {/* 妖兽据点 */}
            {camps.map((c) => {
              const isSelected = selectedCampId === c.id;
              const cleared = c.raiders === 0;
              const rc = getRaiderConfig(c.raiderType);
              // 世界Boss/秘境：未激活时不显示
              if ((c.kind === 'worldBoss' || c.kind === 'realm') && !c.bossActive) return null;
              const emoji = c.kind === 'worldBoss' ? '🐉' : c.kind === 'realm' ? '🌌' : c.kind === 'resource' ? '💎' : c.occupied ? '🏴' : cleared ? '🏳️' : rc.emoji;
              const borderClass = c.kind === 'worldBoss' ? 'border-red-600 animate-pulse' : c.kind === 'realm' ? 'border-purple-500 animate-pulse' : c.kind === 'resource' ? 'border-amber-500' : 'border-border';
              return (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCampId(c.id); setSelectedNpcId(null); setDeployed({}); }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 border-2 rounded px-1.5 py-0.5 text-xs transition
                    ${isSelected ? 'border-red-500 ring-2 ring-red-300' : borderClass} ${c.occupied ? 'ring-2 ring-emerald-400' : ''}`}
                  style={{ left: `${c.position.x}%`, top: `${c.position.y}%` }}
                >
                  <div className="text-base">{emoji}</div>
                  <div className="text-text-primary font-semibold whitespace-nowrap">{c.name}</div>
                  {c.kind === 'worldBoss' && c.bossActive && c.bossMaxHp && (
                    <div className="w-16 bg-red-200 rounded-full h-1 mt-0.5">
                      <div className="bg-red-600 h-full rounded-full" style={{ width: `${Math.max(0, ((c.bossHp||0) / c.bossMaxHp) * 100)}%` }} />
                    </div>
                  )}
                </button>
              );
            })}
            {/* NPC 敌方部落 */}
            {npcs.map((n) => {
              const isSelected = selectedNpcId === n.id;
              const defeated = n.defeatedAt && Date.now() - n.defeatedAt < NPC_REVIVE_MS;
              const t = TRIBE_CONFIGS[n.tribe];
              return (
                <button
                  key={n.id}
                  onClick={() => { setSelectedNpcId(n.id); setSelectedCampId(null); setDeployed({}); }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 border-2 rounded px-1.5 py-0.5 text-xs transition
                    ${isSelected ? 'border-red-500 ring-2 ring-red-300' : 'border-border'}`}
                  style={{ left: `${n.position.x}%`, top: `${n.position.y}%` }}
                >
                  <div className="text-base">{defeated ? '🏚️' : t.emoji}</div>
                  <div className="text-text-primary font-semibold whitespace-nowrap">{n.name}</div>
                </button>
              );
            })}
          </div>

          {/* 选中据点详情 */}
          {selectedCamp && (() => {
            const rc = getRaiderConfig(selectedCamp.raiderType);
            const tpl = CAMP_TEMPLATES.find((t) => t.name === selectedCamp.name);
            const isBoss = selectedCamp.kind === 'worldBoss' || selectedCamp.kind === 'realm';
            const isResource = selectedCamp.kind === 'resource';
            const campEmoji = isBoss ? '🐉' : isResource ? '💎' : selectedCamp.occupied ? '🏴' : rc.emoji;
            return (
              <div className="space-y-3">
                {/* 据点信息 */}
                <div className="border border-border rounded-lg p-3 bg-bg-secondary">
                  <div className="flex items-start gap-3">
                    <div className="text-4xl">{campEmoji}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-text-primary">{selectedCamp.name}</h3>
                        {isBoss && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 animate-pulse">世界Boss</span>}
                        {isResource && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">资源矿点</span>}
                        <span className={`text-xs px-1.5 py-0.5 rounded
                          ${selectedCamp.difficulty === 'small' ? 'bg-green-100 text-green-700' : selectedCamp.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {selectedCamp.difficulty === 'small' ? '低' : selectedCamp.difficulty === 'medium' ? '中' : '高'}
                        </span>
                        {selectedCamp.occupied && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">已占领</span>}
                        {selectedCamp.scouted && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">已侦查</span>}
                      </div>
                      {/* 世界Boss 血条 */}
                      {isBoss && selectedCamp.bossActive && selectedCamp.bossMaxHp ? (
                        <div className="mt-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-red-600 font-semibold">妖兽 HP {selectedCamp.bossHp}/{selectedCamp.bossMaxHp}</span>
                            <span className="text-text-muted">{((selectedCamp.bossHp||0) / selectedCamp.bossMaxHp * 100).toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-red-200 rounded-full h-2 mt-0.5">
                            <div className="bg-red-600 h-full rounded-full transition-all" style={{ width: `${Math.max(0, ((selectedCamp.bossHp||0) / selectedCamp.bossMaxHp) * 100)}%` }} />
                          </div>
                          <p className="text-xs text-text-muted mt-1">{rc.emoji} {rc.name} ×{selectedCamp.raiders}</p>
                          <p className="text-[10px] text-amber-700 mt-0.5">⚠️ 可多次出征，按伤害比例获得奖励</p>
                        </div>
                      ) : isBoss && !selectedCamp.bossActive ? (
                        <p className="text-xs text-text-muted mt-1">
                          {selectedCamp.bossRespawnAt ? `⏳ 下次刷新：${Math.ceil((selectedCamp.bossRespawnAt - Date.now()) / 60000)} 分钟后` : '未激活'}
                        </p>
                      ) : selectedCamp.occupied ? (
                        <p className="text-xs text-emerald-700 mt-1">✅ 已占领，驻守兵力产出资源
                          {isResource && selectedCamp.resourceType && `（${{wood:'木',clay:'陶土',iron:'铜',crop:'粟'}[selectedCamp.resourceType]} 专属+120/h）`}
                        </p>
                      ) : selectedCamp.raiders <= 0 ? (
                        <p className="text-xs text-text-muted mt-1">据点已清空，妖兽将在 60s 后卷土重来</p>
                      ) : (
                        <p className="text-xs text-text-muted mt-1">
                          {rc.emoji} {rc.name} ×{selectedCamp.raiders}
                          {selectedCamp.scouted && `（攻${rc.attack}/防${rc.defense}/HP${rc.hp}）`}
                        </p>
                      )}
                      {selectedCamp.scouted && !isBoss && (
                        <p className="text-[10px] text-text-muted mt-0.5 italic">{rc.lore}</p>
                      )}
                      {/* 侦查按钮 */}
                      {!selectedCamp.scouted && !selectedCamp.occupied && selectedCamp.raiders > 0 && !isBoss && (
                        <button
                          onClick={() => scoutCamp(selectedCamp.id)}
                          disabled={village.resources.iron < 50}
                          className="btn-secondary mt-2 text-xs"
                        >
                          🔍 侦查（花费 50 铜）
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 占领状态：驻守管理 */}
                {selectedCamp.occupied && (
                  <div className="border border-border rounded-lg p-3 bg-emerald-50">
                    <h3 className="font-semibold text-emerald-900 text-sm mb-2">🏴 驻守管理</h3>
                    {tpl && (
                      <div className="text-[11px] text-emerald-700 mb-2">
                        每小时产出：🪵{tpl.garrisonYield.wood} 🏺{tpl.garrisonYield.clay} 🔶{tpl.garrisonYield.iron} 🌾{tpl.garrisonYield.crop}
                      </div>
                    )}
                    {selectedCamp.garrison && Object.values(selectedCamp.garrison).some((n) => (n || 0) > 0) ? (
                      <div className="space-y-1 mb-2">
                        {UNIT_ORDER.map((u) => {
                          const n = selectedCamp.garrison?.[u] || 0;
                          if (n <= 0) return null;
                          const d = getUnitDisplay(village.tribe, u);
                          return (
                            <div key={u} className="flex justify-between text-xs">
                              <span>{d.emoji} {d.name}</span>
                              <span className="font-semibold">{n}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-emerald-700/70 mb-2">暂无驻守兵力</div>
                    )}
                    <button
                      onClick={() => recallGarrison(selectedCamp.id)}
                      className="w-full text-xs py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                    >
                      ↩️ 撤回全部驻守兵力
                    </button>
                  </div>
                )}

                {/* 护盾提示（仅 PvP 未实装时显示状态） */}
                {!selectedCamp.occupied && isShielded(village) && (
                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-2 mb-2 text-[10px] text-sky-700">
                    🛡️ 护盾生效中（剩余 {Math.ceil(shieldRemainingMs(village) / 60000)} 分钟）· 出征妖兽据点不影响护盾
                  </div>
                )}

                {/* 选兵 */}
                {!selectedCamp.occupied && (
                  <div className="border border-border rounded-lg p-3 bg-bg-secondary">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-text-primary text-sm">
                        {selectedCamp.raiders > 0 ? '🎯 选择出征兵力' : '据点已清空'}
                      </h3>
                      {rallyLv > 0 && selectedCamp.raiders > 0 && (
                        <span className={`text-[10px] ${overLimit ? 'text-red-600 font-semibold' : 'text-text-muted'}`}>
                          {totalDeployed}/{deployLimit}
                        </span>
                      )}
                    </div>
                    {overLimit && (
                      <div className="text-[10px] text-red-600 mb-2">超出出兵上限，请减少兵力</div>
                    )}
                    <div className="space-y-2">
                      {UNIT_ORDER.map((u) => {
                        const owned = village.units[u] || 0;
                        if (owned <= 0) return null;
                        const d = getUnitDisplay(village.tribe, u);
                        const val = deployed[u] || 0;
                        return (
                          <div key={u} className="flex items-center gap-2">
                            <span className="text-lg w-6">{d.emoji}</span>
                            <span className="text-xs text-text-secondary w-16 truncate">{d.name}</span>
                            <input
                              type="range"
                              min={0}
                              max={owned}
                              value={val}
                              onChange={(e) => setDeployed((p) => ({ ...p, [u]: parseInt(e.target.value) }))}
                              className="flex-1 accent-pop"
                            />
                            <span className="text-xs font-semibold w-16 text-right">{val}/{owned}</span>
                          </div>
                        );
                      })}
                      {UNIT_ORDER.every((u) => (village.units[u] || 0) <= 0) && (
                        <div className="text-xs text-text-muted text-center py-2">暂无兵力，先去军帐训练</div>
                      )}
                    </div>
                  </div>
                )}

                {/* 阵型选择（仅出征时显示） */}
                {!selectedCamp.occupied && selectedCamp.raiders > 0 && (
                  <div className="border border-border rounded-lg p-3 bg-bg-secondary">
                    <h3 className="font-semibold text-text-primary text-sm mb-2">🪖 选择阵型</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {FORMATION_ORDER.map((f) => {
                        const cfg = FORMATIONS[f];
                        const active = formation === f;
                        return (
                          <button
                            key={f}
                            onClick={() => setFormation(f)}
                            className={`text-left border-2 rounded-lg p-2 transition-all
                              ${active ? 'border-pop bg-pop/5' : 'border-border bg-bg-primary hover:border-pop'}`}
                          >
                            <div className="flex items-center gap-1">
                              <span className="text-lg">{cfg.emoji}</span>
                              <span className="text-sm font-semibold text-text-primary">{cfg.name}</span>
                            </div>
                            <div className="text-[10px] text-text-muted mt-0.5">{cfg.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                    {/* 兵种克制循环图 */}
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="text-[11px] text-text-muted mb-1.5">⚔️ 兵种克制（克制时 +50% 伤害）</div>
                      <div className="flex items-center justify-center gap-1 text-xs">
                        <CounterNode unit="warrior" tribe={village.tribe} />
                        <span className="text-emerald-500 font-bold">→</span>
                        <CounterNode unit="cavalry" tribe={village.tribe} />
                        <span className="text-emerald-500 font-bold">→</span>
                        <CounterNode unit="archer" tribe={village.tribe} />
                        <span className="text-emerald-500 font-bold">→</span>
                        <span className="text-emerald-500 font-bold">↺</span>
                      </div>
                      <div className="text-[10px] text-text-muted text-center mt-1">🛡️ 重甲无克制，均衡型兵种</div>
                    </div>
                  </div>
                )}

                {/* 战力预估 */}
                {selectedPred && (
                  <div className="border border-border rounded-lg p-3 bg-amber-50">
                    <h3 className="font-semibold text-amber-900 text-sm mb-1">⚔ 战力预估</h3>
                    <p className="text-xs text-amber-800">
                      总攻击 {Math.round(selectedPred.atkPower)} vs 妖兽防御 {Math.round(selectedPred.defPower)}
                    </p>
                    <p className="text-xs mt-0.5">
                      胜率：
                      <span className={selectedPred.winChance > 0.5 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                        {Math.round(selectedPred.winChance * 100)}%
                      </span>
                      <span className="text-text-muted ml-2">行军 {calcMarchTime(selectedCamp.position)}s</span>
                    </p>
                  </div>
                )}

                {/* 出征 / 驻守按钮 */}
                {!selectedCamp.occupied && (
                  (selectedCamp.kind === 'worldBoss' || selectedCamp.kind === 'realm')
                    ? selectedCamp.bossActive && selectedCamp.raiders > 0
                    : selectedCamp.raiders > 0
                ) && (
                  <button
                    disabled={!canAttack}
                    onClick={() => {
                      attackCamp(selectedCamp.id, deployed, formation);
                      setDeployed({});
                    }}
                    className="btn-primary"
                  >
                    {totalDeployed === 0 ? '请选择出征兵力' : overLimit ? `超出出兵上限（${deployLimit}）` : `🏹 出征 ${totalDeployed} 名 · ${FORMATIONS[formation].name}（${calcMarchTime(selectedCamp.position)}s）`}
                  </button>
                )}
                {selectedCamp.occupied && (
                  <button
                    disabled={!canGarrison}
                    onClick={() => {
                      garrisonCamp(selectedCamp.id, deployed);
                      setDeployed({});
                    }}
                    className="btn-secondary w-full py-2.5"
                  >
                    {totalDeployed === 0 ? '选择兵力后驻守' : `🏴 增派驻守 ${totalDeployed} 名`}
                  </button>
                )}
              </div>
            );
          })()}

          {/* 选中 NPC 敌方部落详情 */}
          {selectedNpc && (() => {
            const t = TRIBE_CONFIGS[selectedNpc.tribe];
            const totalNpcUnits = UNIT_ORDER.reduce((s, u) => s + (selectedNpc.units[u] || 0), 0);
            return (
              <div className="space-y-3">
                {/* NPC 信息 */}
                <div className="border border-border rounded-lg p-3 bg-bg-secondary">
                  <div className="flex items-start gap-3">
                    <div className="text-4xl">{isNpcDefeated ? '🏚️' : t.emoji}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-text-primary">{selectedNpc.name}</h3>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">敌方</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{t.name}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">🧱 城墙 Lv{selectedNpc.wallLevel}</span>
                        {isNpcDefeated && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">废墟</span>}
                      </div>
                      {isNpcDefeated ? (
                        <p className="text-xs text-text-muted mt-1">村庄已被摧毁，{Math.ceil((NPC_REVIVE_MS - (Date.now() - (selectedNpc.defeatedAt || 0))) / 60000)} 分钟后重建</p>
                      ) : selectedNpc.scouted ? (
                        <p className="text-xs text-text-muted mt-1">
                          守军 {totalNpcUnits} 名 · 可掠夺资源 🪵{Math.floor(selectedNpc.resources.wood)} 🏺{Math.floor(selectedNpc.resources.clay)} 🔶{Math.floor(selectedNpc.resources.iron)} 🌾{Math.floor(selectedNpc.resources.crop)}
                        </p>
                      ) : (
                        <p className="text-xs text-text-muted mt-1">未侦查，守军与资源未知</p>
                      )}
                      {/* 侦查按钮 */}
                      {!selectedNpc.scouted && !isNpcDefeated && (
                        <button
                          onClick={() => scoutPlayer(selectedNpc.id)}
                          disabled={village.resources.iron < 80}
                          className="btn-secondary mt-2 text-xs"
                        >
                          🔍 侦查（花费 80 铜）
                        </button>
                      )}
                      {/* 护盾提示 */}
                      {isShielded(village) && (
                        <div className="bg-sky-50 border border-sky-200 rounded p-2 mt-2 text-[10px] text-sky-700">
                          🛡️ 护盾生效中（剩余 {Math.ceil(shieldRemainingMs(village) / 60000)} 分钟）· 攻击敌方部落不影响护盾
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 选兵 + 阵型（未废墟时） */}
                {!isNpcDefeated && (
                  <>
                    <div className="border border-border rounded-lg p-3 bg-bg-secondary">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-text-primary text-sm">🎯 选择出征兵力</h3>
                        {rallyLv > 0 && (
                          <span className={`text-[10px] ${overLimit ? 'text-red-600 font-semibold' : 'text-text-muted'}`}>
                            {totalDeployed}/{deployLimit}
                          </span>
                        )}
                      </div>
                      {overLimit && (
                        <div className="text-[10px] text-red-600 mb-2">超出出兵上限，请减少兵力</div>
                      )}
                      <div className="space-y-2">
                        {UNIT_ORDER.map((u) => {
                          const owned = village.units[u] || 0;
                          if (owned <= 0) return null;
                          const d = getUnitDisplay(village.tribe, u);
                          const val = deployed[u] || 0;
                          return (
                            <div key={u} className="flex items-center gap-2">
                              <span className="text-lg w-6">{d.emoji}</span>
                              <span className="text-xs text-text-secondary w-16 truncate">{d.name}</span>
                              <input
                                type="range" min={0} max={owned} value={val}
                                onChange={(e) => setDeployed((p) => ({ ...p, [u]: parseInt(e.target.value) }))}
                                className="flex-1 accent-pop"
                              />
                              <span className="text-xs font-semibold w-16 text-right">{val}/{owned}</span>
                            </div>
                          );
                        })}
                        {UNIT_ORDER.every((u) => (village.units[u] || 0) <= 0) && (
                          <div className="text-xs text-text-muted text-center py-2">暂无兵力，先去军帐训练</div>
                        )}
                      </div>
                    </div>

                    {/* 阵型 */}
                    <div className="border border-border rounded-lg p-3 bg-bg-secondary">
                      <h3 className="font-semibold text-text-primary text-sm mb-2">🪖 选择阵型</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {FORMATION_ORDER.map((f) => {
                          const cfg = FORMATIONS[f];
                          const active = formation === f;
                          return (
                            <button key={f} onClick={() => setFormation(f)}
                              className={`text-left border-2 rounded-lg p-2 transition-all ${active ? 'border-pop bg-pop/5' : 'border-border bg-bg-primary hover:border-pop'}`}>
                              <div className="flex items-center gap-1">
                                <span className="text-lg">{cfg.emoji}</span>
                                <span className="text-sm font-semibold text-text-primary">{cfg.name}</span>
                              </div>
                              <div className="text-[10px] text-text-muted mt-0.5">{cfg.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* PVP 战力预估 */}
                    {npcPred && (
                      <div className="border border-border rounded-lg p-3 bg-amber-50">
                        <h3 className="font-semibold text-amber-900 text-sm mb-1">⚔ 战力预估</h3>
                        <p className="text-xs text-amber-800">
                          总攻击 {Math.round(npcPred.atkPower)} vs 守军防御 {Math.round(npcPred.defPower)}
                        </p>
                        <p className="text-xs mt-0.5">
                          胜率：
                          <span className={npcPred.winChance > 0.5 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                            {Math.round(npcPred.winChance * 100)}%
                          </span>
                          <span className="text-text-muted ml-2">行军 {calcMarchTime(selectedNpc.position)}s</span>
                        </p>
                      </div>
                    )}

                    {/* 出征按钮 */}
                    <button
                      disabled={!canAttackNpc}
                      onClick={() => {
                        attackPlayer(selectedNpc.id, deployed, formation);
                        setDeployed({});
                      }}
                      className="btn-primary"
                    >
                      {totalDeployed === 0 ? '请选择出征兵力' : overLimit ? `超出出兵上限（${deployLimit}）` : `⚔️ 出征 ${selectedNpc.name} · ${FORMATIONS[formation].name}（${calcMarchTime(selectedNpc.position)}s）`}
                    </button>
                  </>
                )}
              </div>
            );
          })()}

          {/* 据点列表 */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-text-secondary px-1">全部据点</h3>
            {camps.map((c) => {
              const cleared = c.raiders === 0;
              const rc = getRaiderConfig(c.raiderType);
              const tpl = CAMP_TEMPLATES.find((t) => t.name === c.name);
              const isBoss = c.kind === 'worldBoss' || c.kind === 'realm';
              const isResource = c.kind === 'resource';
              // 世界Boss/秘境：未激活跳过
              if (isBoss && !c.bossActive) return null;
              const emoji = isBoss ? '🐉' : isResource ? '💎' : c.occupied ? '🏴' : cleared ? '🏳️' : rc.emoji;
              const pred = !isBoss && totalArmy(village.units) > 0 && !c.occupied && !cleared
                ? predictBattle(village.units, village.tribe, c.raiders, c.raiderType, atkMult, defMult)
                : null;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCampId(c.id)}
                  className={`w-full text-left border rounded-lg p-3
                    ${selectedCampId === c.id ? 'border-pop bg-pop/5' : isBoss ? 'border-red-300 bg-red-50' : isResource ? 'border-amber-300 bg-amber-50' : 'border-border bg-bg-secondary'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{emoji}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-text-primary">{c.name}</h3>
                        {isBoss && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">Boss</span>}
                        {isResource && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">矿点</span>}
                        <span className={`text-xs px-1.5 py-0.5 rounded
                          ${c.difficulty === 'small' ? 'bg-green-100 text-green-700' : c.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {c.difficulty === 'small' ? '低' : c.difficulty === 'medium' ? '中' : '高'}
                        </span>
                        {c.occupied && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">已占领</span>}
                      </div>
                      {isBoss && c.bossActive && c.bossMaxHp ? (
                        <>
                          <p className="text-xs text-red-600 mt-0.5">
                            HP {c.bossHp}/{c.bossMaxHp} · {rc.name} ×{c.raiders}
                          </p>
                          <div className="w-full bg-red-200 rounded-full h-1.5 mt-1">
                            <div className="bg-red-600 h-full rounded-full" style={{ width: `${Math.max(0, ((c.bossHp||0) / c.bossMaxHp) * 100)}%` }} />
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-text-muted mt-0.5">
                          {c.occupied ? `已占领 · ${rc.name}` : cleared ? '已清空' : `${rc.name} ×${c.raiders}`}
                        </p>
                      )}
                      <p className="text-xs text-amber-700 mt-1">
                        🎁 {c.reward.wood}木/{c.reward.clay}陶土/{c.reward.iron}铜/{c.reward.crop}粟
                      </p>
                      {c.occupied && tpl && (
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          🏴 驻守产出：{tpl.garrisonYield.wood}木/{tpl.garrisonYield.clay}陶土/{tpl.garrisonYield.iron}铜/{tpl.garrisonYield.crop}粟 /h
                        </p>
                      )}
                      {c.occupied && isResource && (
                        <p className="text-[11px] text-amber-700 mt-0.5">
                          💎 专属产出：{c.resourceType && {wood:'木+120/h',clay:'陶土+120/h',iron:'铜+120/h',crop:'粟+120/h'}[c.resourceType]}
                        </p>
                      )}
                      {pred && (
                        <p className="text-xs text-text-muted mt-0.5">
                          全军出击胜率：<span className="font-semibold">{Math.round(pred.winChance * 100)}%</span>
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 敌方部落列表 */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-text-secondary px-1">敌方部落</h3>
            {npcs.map((n) => {
              const defeated = n.defeatedAt && Date.now() - n.defeatedAt < NPC_REVIVE_MS;
              const t = TRIBE_CONFIGS[n.tribe];
              const totalNpc = UNIT_ORDER.reduce((s, u) => s + (n.units[u] || 0), 0);
              const pred = totalArmy(village.units) > 0 && !defeated
                ? predictPvPBattle(village.units, village.tribe, n.units, n.tribe, n.wallLevel, atkMult, defMult)
                : null;
              return (
                <button
                  key={n.id}
                  onClick={() => { setSelectedNpcId(n.id); setSelectedCampId(null); setDeployed({}); }}
                  className={`w-full text-left border rounded-lg p-3
                    ${selectedNpcId === n.id ? 'border-pop bg-pop/5' : 'border-border bg-bg-secondary'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{defeated ? '🏚️' : t.emoji}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-text-primary">{n.name}</h3>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">敌方</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">🧱 Lv{n.wallLevel}</span>
                        {defeated && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">废墟</span>}
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">
                        {t.name} · {defeated ? '重建中' : `守军 ${totalNpc}`}
                        {n.scouted && !defeated ? ` · 🪵${Math.floor(n.resources.wood)} 🏺${Math.floor(n.resources.clay)} 🔶${Math.floor(n.resources.iron)} 🌾${Math.floor(n.resources.crop)}` : ''}
                      </p>
                      {pred && !defeated && (
                        <p className="text-xs text-text-muted mt-0.5">
                          全军出击胜率：<span className="font-semibold">{Math.round(pred.winChance * 100)}%</span>
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function totalArmy(units: Record<string, number>): number {
  return Object.values(units).reduce((s, n) => s + (n || 0), 0);
}

// 克制循环图的兵种节点
function CounterNode({ unit, tribe }: { unit: UnitType; tribe: TribeType }) {
  const d = getUnitDisplay(tribe, unit);
  return (
    <span className="inline-flex items-center gap-0.5 bg-bg-primary border border-border rounded px-1.5 py-0.5">
      <span>{d.emoji}</span>
      <span className="text-text-primary">{d.name}</span>
    </span>
  );
}

export default MapPanel;

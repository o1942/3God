import type { ReactNode } from 'react';
import { UNIT_CONFIGS, UNIT_ORDER, COUNTER_BONUS } from '../game/units';
import { SEASON_POINT_RULES, SEASON_LENGTH_MS } from '../game/season';
import { ACTIVE_SHIELD_OPTIONS } from '../game/shield';
import { ACCEL_COST_JADE, DAILY_ACCEL_LIMIT, ACCEL_RATIO } from '../game/cosmetics';
import { useGame } from '../store/gameStore';

// 战力权重（与 store/gameStore.ts 的 computePower 保持一致）
const WALL_POWER_PER_LV = 120;
const BUILDING_POWER_PER_LV = 40;

// 赛季长度（天）
const SEASON_DAYS = Math.round(SEASON_LENGTH_MS / (24 * 3600 * 1000));

export function SettingsPanel({
  onClose,
  onReset,
  onLogout,
}: {
  onClose: () => void;
  onReset: () => void;
  onLogout: () => void;
}) {
  const playerName = useGame((s) => s.village.playerName);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-bg-card border-t sm:border border-border sm:rounded-2xl rounded-t-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto anim-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="sticky top-0 bg-bg-card border-b border-border px-4 py-3 flex justify-between items-center z-10">
          <div>
            <h2 className="text-lg font-bold text-text-primary">⚙️ 设置</h2>
            <p className="text-xs text-text-muted">玩家：{playerName || '—'} · 数据说明与账号操作</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl px-2">×</button>
        </div>

        <div className="p-3 space-y-3">

          {/* 战力 */}
          <Section title="⚔️ 战力（实力值）" desc="用于排行榜排序；战力高不等于必胜，实战还看攻击/防御/克制/阵型。">
            <Formula>战力 = Σ 兵力 ×（兵种攻击 + 防御） + 城墙等级 × {WALL_POWER_PER_LV} + 建筑等级和 × {BUILDING_POWER_PER_LV}</Formula>
            <table className="w-full text-xs mt-2">
              <thead>
                <tr className="text-text-muted">
                  <th className="text-left font-normal pb-1">兵种</th>
                  <th className="text-right font-normal pb-1">攻击</th>
                  <th className="text-right font-normal pb-1">防御</th>
                  <th className="text-right font-normal pb-1">战力/兵</th>
                </tr>
              </thead>
              <tbody>
                {UNIT_ORDER.map((u) => {
                  const c = UNIT_CONFIGS[u];
                  return (
                    <tr key={u} className="border-t border-border/60">
                      <td className="py-1 text-text-secondary">{c.emoji} {c.name}</td>
                      <td className="py-1 text-right text-text-secondary">{c.attack}</td>
                      <td className="py-1 text-right text-text-secondary">{c.defense}</td>
                      <td className="py-1 text-right font-bold text-pop">{c.attack + c.defense}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-[11px] text-text-muted mt-2 leading-relaxed">
              · 城墙：每级 +{WALL_POWER_PER_LV} 战力
              <br />
              · 建筑等级和：封禅台 + 军帐 + 校场 + 城墙 的等级之和，每级 +{BUILDING_POWER_PER_LV} 战力
            </p>
          </Section>

          {/* 赛季积分 */}
          <Section title="🏆 赛季积分" desc={`每 ${SEASON_DAYS} 天一赛季，赛季结束积分清零并重置里程碑（村庄与建筑全部保留）。`}>
            <table className="w-full text-xs">
              <tbody>
                <PointRow label="升级资源田" value={`+${SEASON_POINT_RULES.fieldUpgrade} / 级`} />
                <PointRow label="建造 / 升级建筑" value={`+${SEASON_POINT_RULES.buildingUpgrade} / 级`} />
                <PointRow label="训练士兵" value={`+${SEASON_POINT_RULES.trainUnit} / 兵`} />
                <PointRow label="战斗胜利" value={`+${SEASON_POINT_RULES.battleWin}`} />
                <PointRow label="击败世界Boss / 秘境" value={`+${SEASON_POINT_RULES.battleWin * 3}`} />
                <PointRow label="完成主线任务" value={`+${SEASON_POINT_RULES.questComplete}`} />
                <PointRow label="研发科技" value={`+${SEASON_POINT_RULES.researchComplete}`} />
              </tbody>
            </table>
            <p className="text-[11px] text-text-muted mt-2 leading-relaxed">
              积分达标可领取里程碑奖励（含纹玉）：100 / 500 / 1000 / 2000 分各一档。
            </p>
          </Section>

          {/* 纹玉 */}
          <Section title="💎 纹玉" desc="高级货币，仅通过游戏行为获得，不可充值（反 P2W）。">
            <p className="text-xs text-text-secondary leading-relaxed">
              <b className="text-text-primary">获取</b>：完成主线任务、领取赛季里程碑。
              <br />
              <b className="text-text-primary">用途</b>：
            </p>
            <ul className="text-xs text-text-secondary mt-1 space-y-0.5 list-disc list-inside">
              <li>加速建造/训练：{ACCEL_COST_JADE} 纹玉/次，减少 {Math.round(ACCEL_RATIO * 100)}% 剩余时间，每日上限 {DAILY_ACCEL_LIMIT} 次</li>
              <li>激活护盾：{ACTIVE_SHIELD_OPTIONS.map((o) => `${o.label} ${o.jade}纹玉`).join(' / ')}</li>
              <li>购买外观（仅装饰，不影响任何数值）</li>
            </ul>
          </Section>

          {/* 资源与容量 */}
          <Section title="🌾 资源与容量" desc="四种资源：木 / 陶土 / 铜 / 粟。">
            <p className="text-xs text-text-secondary leading-relaxed">
              由资源田按小时产出；仓廪决定容量上限，达到上限后停产。
              <br />
              军队每小时消耗粟米，粟米不足会导致士兵流失。
            </p>
          </Section>

          {/* 护盾 */}
          <Section title="🛡️ 护盾" desc="护盾生效期间无法被其他玩家攻击。">
            <p className="text-xs text-text-secondary leading-relaxed">
              新手享 {Math.round(7)} 天保护期；之后可用纹玉激活主动护盾
              （{ACTIVE_SHIELD_OPTIONS.map((o) => o.label).join(' / ')}），
              激活后有 24 小时冷却。
            </p>
          </Section>

          {/* 兵种克制 */}
          <Section title="🔱 兵种克制" desc={`克制方造成 +${Math.round(COUNTER_BONUS * 100)}% 伤害。`}>
            <p className="text-xs text-text-secondary leading-relaxed">
              部落战士 → 铁骑 → 神射手 → 部落战士（循环克制）
              <br />
              重装甲士不参与克制，是攻守均衡的壁垒。
            </p>
          </Section>

          {/* 账号操作 */}
          <Section title="🔧 账号操作">
            <div className="flex gap-2 mt-1">
              <button
                onClick={onReset}
                className="flex-1 text-sm py-2 rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors"
              >
                重置存档
              </button>
              <button
                onClick={onLogout}
                className="flex-1 text-sm py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-secondary transition-colors"
              >
                切换账号（登出）
              </button>
            </div>
            <p className="text-[11px] text-text-muted mt-2">重置会清空当前进度并重新选择部落；登出后可用玩家名重新进入。</p>
          </Section>

        </div>
      </div>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="border border-border rounded-lg p-3 bg-bg-secondary">
      <h3 className="text-sm font-bold text-text-primary">{title}</h3>
      {desc && <p className="text-[11px] text-text-muted mt-0.5 mb-2 leading-relaxed">{desc}</p>}
      {!desc && <div className="mb-2" />}
      {children}
    </div>
  );
}

function Formula({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] text-text-secondary bg-bg-card border border-border/60 rounded px-2 py-1.5 font-mono leading-relaxed break-all">
      {children}
    </div>
  );
}

function PointRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-t border-border/60 first:border-t-0">
      <td className="py-1 text-text-secondary">{label}</td>
      <td className="py-1 text-right font-bold text-pop">{value}</td>
    </tr>
  );
}

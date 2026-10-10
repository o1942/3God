import { useState } from 'react';
import type { BuildingType, ResourceType } from '../game/types';
import { BUILDING_CONFIGS } from '../game/config';
import { SPEED_MULTIPLIER } from '../game/initialState';
import { UNIT_CONFIGS, UNIT_ORDER, computeUpkeep, getUnitDisplay, getUnitStats } from '../game/units';
import { computeBuildSpeed, computeVillageDefense, getMarketMaxTrade, getMarketTaxRate, getSmithyAttackBonus, getWallDefense, useGame } from '../store/gameStore';
import { RAIDER_CONFIGS } from '../game/units';
import { TechTreePanel } from './TechTreePanel';
import { BUILDING_ART } from '../game/buildingArt';

// 建筑详情面板
// 每个建筑有：
// 1. 升级功能（通用）
// 2. 特色功能（按建筑类型）

type Props = {
  building: BuildingType;
  onClose: () => void;
};

export function BuildingDetailPanel({ building, onClose }: Props) {
  const village = useGame((s) => s.village);
  const enqueueBuildingUpgrade = useGame((s) => s.enqueueBuildingUpgrade);
  const [tab, setTab] = useState<'action' | 'upgrade'>('action');

  const config = BUILDING_CONFIGS[building];
  const curLv = village.buildings[building] || 0;
  const nextLv = curLv + 1;
  const upgrade = nextLv <= config.maxLevel ? config.levels[nextLv - 1] : null;
  const isInQueue = village.buildQueue.some(
    (t) => t.target.kind === 'building' && t.target.building === building,
  );
  const canAfford = upgrade
    ? village.resources.wood >= upgrade.cost.wood &&
      village.resources.clay >= upgrade.cost.clay &&
      village.resources.iron >= upgrade.cost.iron &&
      village.resources.crop >= upgrade.cost.crop
    : false;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-bg-card border-t sm:border border-border sm:rounded-2xl rounded-t-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto anim-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="sticky top-0 bg-bg-card border-b border-border px-4 py-3 flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            {(() => {
              const ArtComp = BUILDING_ART[building];
              return ArtComp ? (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-400/30 flex items-center justify-center flex-shrink-0">
                  <ArtComp className="w-10 h-10" />
                </div>
              ) : (
                <span className="text-2xl">{config.emoji}</span>
              );
            })()}
            <div>
              <h2 className="text-lg font-bold text-text-primary">{config.name}</h2>
              <p className="text-xs text-text-muted">Lv {curLv}{upgrade && ` → Lv ${nextLv}`}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost text-2xl px-2">×</button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-border bg-bg-secondary">
          <TabBtn active={tab === 'action'} onClick={() => setTab('action')} label="⚡ 功能" />
          <TabBtn active={tab === 'upgrade'} onClick={() => setTab('upgrade')} label="⬆ 升级" />
        </div>

        <div className="p-3">
          {tab === 'action' ? (
            <BuildingAction building={building} onClose={onClose} />
          ) : (
            <div>
              {config.description && (
                <p className="text-xs text-text-secondary mb-3 px-1">{config.description}</p>
              )}
              {upgrade ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm mb-3">
                    <Cost label="木" icon="🪵" cost={upgrade.cost.wood} have={village.resources.wood} />
                    <Cost label="陶土" icon="🏺" cost={upgrade.cost.clay} have={village.resources.clay} />
                    <Cost label="铜" icon="🔶" cost={upgrade.cost.iron} have={village.resources.iron} />
                    <Cost label="粟" icon="🌾" cost={upgrade.cost.crop} have={village.resources.crop} />
                    <div className="bg-bg-secondary border border-border rounded px-2 py-1 text-text-secondary text-center">
                      ⏱ {Math.ceil((upgrade.buildTime * SPEED_MULTIPLIER) / computeBuildSpeed(village))}s
                    </div>
                  </div>
                  <button
                    disabled={!canAfford || isInQueue}
                    onClick={() => {
                      enqueueBuildingUpgrade(building);
                      onClose();
                    }}
                    className="btn-primary py-3"
                  >
                    {isInQueue ? '已在升级队列中' : !canAfford ? '资源不足' : '升级'}
                  </button>
                </>
              ) : (
                <div className="text-center py-8 text-text-muted">已达最高等级</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 text-sm font-semibold transition-all relative
        ${active ? 'text-pop' : 'text-text-muted hover:text-text-secondary'}`}
    >
      {label}
      {active && <span className="absolute bottom-0 inset-x-0 h-0.5 bg-pop anim-fade-in" />}
    </button>
  );
}

// 各建筑特色功能
function BuildingAction({ building, onClose }: { building: BuildingType; onClose: () => void }) {
  switch (building) {
    case 'mainBuilding':
      return <MainBuildingAction onClose={onClose} />;
    case 'warehouse':
      return <WarehouseAction />;
    case 'granary':
      return <GranaryAction />;
    case 'rallyPoint':
      return <RallyPointAction onClose={onClose} />;
    case 'barracks':
      return <BarracksAction onClose={onClose} />;
    case 'market':
      return <MarketAction />;
    case 'embassy':
      return <EmbassyAction />;
    case 'smithy':
      return <SmithyAction />;
    case 'academy':
      return <AcademyAction />;
    case 'stable':
      return <StableAction />;
    case 'workshop':
      return <WorkshopAction />;
    case 'wall':
      return <WallAction />;
    default:
      return <div className="text-center py-8 text-text-muted">功能开发中...</div>;
  }
}

// ============== 各建筑特色功能 ==============

function MainBuildingAction({ onClose: _onClose }: { onClose: () => void }) {
  const village = useGame((s) => s.village);
  const speed = computeBuildSpeed(village);
  const lv = village.buildings.mainBuilding || 0;
  const nextSpeed = Math.min(0.5, 0.1 + lv * 0.05);

  return (
    <div className="space-y-3">
      <div className="border border-border rounded-lg p-3 bg-bg-secondary">
        <h3 className="font-semibold text-text-primary text-sm mb-2">⚡ 建造速度加成</h3>
        <div className="text-xs text-text-secondary space-y-1">
          <div>当前等级：Lv{lv}</div>
          <div>建造速度：<span className="text-pop font-bold">{(speed * 100).toFixed(0)}%</span></div>
          <div>升级后：{(nextSpeed * 100).toFixed(0)}%</div>
          <div className="text-text-muted text-[10px] mt-1">等级越高，所有建造/升级耗时越短</div>
        </div>
      </div>
      <div className="text-xs text-text-muted text-center">提示：封禅台是部落的核心，优先升级</div>
    </div>
  );
}

function WarehouseAction() {
  const village = useGame((s) => s.village);
  const lv = village.buildings.warehouse || 0;
  // 仓库基础容量 + 每级 +800
  const cap = 2400 + lv * 800;

  return (
    <div className="space-y-3">
      <div className="border border-border rounded-lg p-3 bg-bg-secondary">
        <h3 className="font-semibold text-text-primary text-sm mb-2">📦 资源容量（木/陶土/铜）</h3>
        <div className="text-xs space-y-2">
          <ResourceBar name="木材" cur={village.resources.wood} cap={cap} color="bg-amber-500" />
          <ResourceBar name="陶土" cur={village.resources.clay} cap={cap} color="bg-yellow-500" />
          <ResourceBar name="铜矿" cur={village.resources.iron} cap={cap} color="bg-orange-400" />
        </div>
        <div className="text-[10px] text-text-muted mt-2">当前上限：{cap} · 升级可增加容量</div>
      </div>
      <div className="text-xs text-text-muted text-center">提示：资源达到上限后无法继续累积</div>
    </div>
  );
}

function GranaryAction() {
  const village = useGame((s) => s.village);
  const lv = village.buildings.granary || 0;
  const cap = 2400 + lv * 800;

  return (
    <div className="space-y-3">
      <div className="border border-border rounded-lg p-3 bg-bg-secondary">
        <h3 className="font-semibold text-text-primary text-sm mb-2">🌾 粟米容量</h3>
        <div className="text-xs space-y-2">
          <ResourceBar name="粟米" cur={village.resources.crop} cap={cap} color="bg-lime-500" />
        </div>
        <div className="text-[10px] text-text-muted mt-2">当前上限：{cap} · 升级可增加容量</div>
      </div>
      <div className="text-xs text-text-muted text-center">提示：军队会消耗粮食，确保粮仓充足</div>
    </div>
  );
}

function RallyPointAction({ onClose }: { onClose: () => void }) {
  const village = useGame((s) => s.village);
  const lv = village.buildings.rallyPoint || 0;
  const totalUnits = UNIT_ORDER.reduce((s, u) => s + (village.units[u] || 0), 0);
  const upkeep = computeUpkeep(village.units);
  const deployLimit = lv > 0 ? BUILDING_CONFIGS.rallyPoint.levels[lv - 1].effect.deployLimit || 0 : 0;
  const nextDeployLimit = lv > 0 && lv < BUILDING_CONFIGS.rallyPoint.maxLevel
    ? BUILDING_CONFIGS.rallyPoint.levels[lv].effect.deployLimit || 0
    : deployLimit;

  return (
    <div className="space-y-3">
      <div className="border border-border rounded-lg p-3 bg-bg-secondary">
        <h3 className="font-semibold text-text-primary text-sm mb-2">🚩 点将台</h3>
        <div className="text-xs text-text-secondary space-y-1">
          <div>当前等级：Lv{lv}</div>
          {lv === 0 ? (
            <div className="text-red-600">未建造，无法出征</div>
          ) : (
            <>
              <div>单次出兵上限：<span className="font-semibold text-text-primary">{deployLimit}</span> 兵力</div>
              {lv < BUILDING_CONFIGS.rallyPoint.maxLevel && (
                <div className="text-text-muted">下一级 Lv{lv + 1}：{nextDeployLimit} 兵力</div>
              )}
              {lv >= BUILDING_CONFIGS.rallyPoint.maxLevel && (
                <div className="text-amber-600">已达最高等级</div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="border border-border rounded-lg p-3 bg-bg-secondary">
        <h3 className="font-semibold text-text-primary text-sm mb-2">🏹 军队总览</h3>
        <div className="space-y-1.5">
          {UNIT_ORDER.map((u) => {
            const n = village.units[u] || 0;
            if (n <= 0) return null;
            const d = getUnitDisplay(village.tribe, u);
            return (
              <div key={u} className="flex items-center justify-between text-xs">
                <span>{d.emoji} {d.name}</span>
                <span className="font-semibold text-text-primary">{n}</span>
              </div>
            );
          })}
          {totalUnits === 0 && <div className="text-xs text-text-muted">暂无兵力</div>}
        </div>
        {totalUnits > 0 && (
          <div className="text-[10px] text-text-muted mt-2 pt-2 border-t border-border">
            总兵力 {totalUnits} · 每小时消耗 {upkeep} 粟米
          </div>
        )}
      </div>

      <button
        onClick={onClose}
        className="w-full py-2.5 bg-pop hover:bg-pop-hover rounded-lg font-semibold text-white text-sm"
      >
        前往地图出征 →
      </button>
    </div>
  );
}

function BarracksAction({ onClose: _onClose }: { onClose: () => void }) {
  const village = useGame((s) => s.village);
  return (
    <div className="space-y-3">
      <div className="border border-border rounded-lg p-3 bg-bg-secondary">
        <h3 className="font-semibold text-text-primary text-sm mb-2">🏹 军帐</h3>
        <p className="text-xs text-text-secondary">在此训练各兵种，出征讨伐妖兽</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {UNIT_ORDER.map((u) => {
          const cfg = UNIT_CONFIGS[u];
          const d = getUnitDisplay(village.tribe, u);
          const s = getUnitStats(village.tribe, u);
          return (
            <div key={u} className="border border-border rounded-lg p-2 bg-amber-50">
              <div className="flex items-center gap-1.5">
                <span className="text-xl">{d.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-text-primary truncate">{d.name}</div>
                  <div className="text-[9px] text-text-muted">{cfg.role}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-1 text-[9px]">
                <span className="bg-red-50 text-red-700 px-1 rounded">攻{s.attack}</span>
                <span className="bg-blue-50 text-blue-700 px-1 rounded">防{s.defense}</span>
                <span className="bg-green-50 text-green-700 px-1 rounded">HP{s.hp}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-xs text-text-muted text-center">点击底部"🏹 军帐"按钮开始训练</div>
    </div>
  );
}

const RESOURCE_META: Record<ResourceType, { label: string; emoji: string }> = {
  wood: { label: '木材', emoji: '🪵' },
  clay: { label: '陶土', emoji: '🏺' },
  iron: { label: '铜矿', emoji: '🔶' },
  crop: { label: '粟米', emoji: '🌾' },
};

function MarketAction() {
  const village = useGame((s) => s.village);
  const tradeResources = useGame((s) => s.tradeResources);
  const lv = village.buildings.market || 0;
  const taxRate = getMarketTaxRate(village);
  const maxTrade = getMarketMaxTrade(village);

  const [from, setFrom] = useState<ResourceType>('wood');
  const [to, setTo] = useState<ResourceType>('clay');
  const [amount, setAmount] = useState(100);

  if (lv === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-4 text-center">
        <div className="text-3xl mb-2">🪙</div>
        <p className="text-xs text-text-muted">升级集市后开启资源交易</p>
      </div>
    );
  }

  const actualReceive = Math.floor(amount * (1 - taxRate));
  const have = Math.floor(village.resources[from]);
  const canTrade = from !== to && have >= amount && amount <= maxTrade;

  const quickAmounts = [
    { label: '25%', val: Math.floor(have * 0.25) },
    { label: '50%', val: Math.floor(have * 0.5) },
    { label: '最大', val: Math.min(have, maxTrade) },
  ];

  const doExchange = () => {
    if (tradeResources(from, to, amount)) {
      // 交易成功后重置数量为较小值，避免连续误操作
      setAmount(Math.min(amount, maxTrade));
    }
  };

  return (
    <div className="space-y-3">
      <div className="border border-border rounded-lg p-3 bg-bg-secondary">
        <h3 className="font-semibold text-text-primary text-sm mb-2">🪙 集市交易</h3>
        <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary mb-3">
          <div>集市等级：Lv{lv}</div>
          <div>税率：<span className="text-red-600 font-semibold">{(taxRate * 100).toFixed(0)}%</span></div>
          <div>单笔上限：<span className="text-text-primary font-semibold">{maxTrade}</span></div>
          <div>商人数量：{lv}</div>
        </div>

        <div className="space-y-2">
          {/* 从 / 到 选择 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-text-muted">支付</label>
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value as ResourceType)}
                className="w-full px-2 py-1.5 text-sm border border-border rounded bg-bg-primary text-text-primary"
              >
                {(Object.keys(RESOURCE_META) as ResourceType[]).map((r) => (
                  <option key={r} value={r}>{RESOURCE_META[r].emoji} {RESOURCE_META[r].label}（{Math.floor(village.resources[r])}）</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted">获得</label>
              <select
                value={to}
                onChange={(e) => setTo(e.target.value as ResourceType)}
                className="w-full px-2 py-1.5 text-sm border border-border rounded bg-bg-primary text-text-primary"
              >
                {(Object.keys(RESOURCE_META) as ResourceType[]).map((r) => (
                  <option key={r} value={r}>{RESOURCE_META[r].emoji} {RESOURCE_META[r].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 数量输入 */}
          <div>
            <label className="text-xs text-text-muted">交易数量（上限 {maxTrade}）</label>
            <input
              type="number"
              value={amount}
              min={1}
              max={maxTrade}
              onChange={(e) => setAmount(Math.max(1, Math.min(maxTrade, parseInt(e.target.value) || 1)))}
              className="w-full px-2 py-1.5 text-sm border border-border rounded bg-bg-primary text-text-primary"
            />
          </div>

          {/* 快捷按钮 */}
          <div className="flex gap-2">
            {quickAmounts.map((q) => (
              <button
                key={q.label}
                onClick={() => setAmount(Math.max(1, q.val))}
                className="flex-1 py-1 text-xs bg-bg-primary border border-border rounded text-text-secondary hover:bg-border"
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* 预览 */}
          <div className="text-xs bg-amber-50 border border-amber-200 rounded p-2.5 flex justify-between items-center">
            <span className="text-text-secondary">
              支付 <b>{amount}</b> {RESOURCE_META[from].emoji}
            </span>
            <span className="text-text-muted">→</span>
            <span className="text-text-secondary">
              实得 <b className="text-emerald-600">{actualReceive}</b> {RESOURCE_META[to].emoji}
            </span>
            <span className="text-red-500 text-[10px]">税 {amount - actualReceive}</span>
          </div>

          <button
            disabled={!canTrade}
            onClick={doExchange}
            className="btn-primary py-2 text-sm"
          >
            {from === to ? '请选择不同资源'
              : have < amount ? '资源不足'
              : amount > maxTrade ? `超过单笔上限 ${maxTrade}`
              : '确认交易'}
          </button>
        </div>
      </div>

      <p className="text-[10px] text-text-muted text-center">升级集市可降低税率、提升单笔上限</p>
    </div>
  );
}

function EmbassyAction() {
  const village = useGame((s) => s.village);
  const lv = village.buildings.embassy || 0;

  return (
    <div className="space-y-3">
      <div className="border border-border rounded-lg p-3 bg-bg-secondary">
        <h3 className="font-semibold text-text-primary text-sm mb-2">🤲 会盟台</h3>
        <div className="text-xs text-text-secondary space-y-1">
          <div>当前等级：Lv{lv}</div>
          <div>可加入/创建部落联盟（开发中）</div>
        </div>
      </div>
      <div className="border border-dashed border-border rounded-lg p-4 text-center">
        <div className="text-3xl mb-2">🤲</div>
        <p className="text-xs text-text-muted">联盟系统开发中</p>
        <p className="text-[10px] text-text-muted mt-1">将来可加入联盟、共享资源、会盟出征</p>
      </div>
    </div>
  );
}

function SmithyAction() {
  const village = useGame((s) => s.village);
  const lv = village.buildings.smithy || 0;
  const bonus = getSmithyAttackBonus(village);

  return (
    <div className="space-y-3">
      <div className="border border-border rounded-lg p-3 bg-bg-secondary">
        <h3 className="font-semibold text-text-primary text-sm mb-2">🔨 铸铜坊</h3>
        <div className="text-xs text-text-secondary space-y-1">
          <div>当前等级：Lv{lv}</div>
          <div>全兵种攻击加成：<span className="text-red-600 font-semibold">+{((bonus - 1) * 100).toFixed(0)}%</span></div>
          <div className="text-text-muted">每升 1 级，所有兵种攻击力 +3%</div>
        </div>
      </div>
      <div className="border border-border rounded-lg p-3 bg-bg-secondary">
        <h4 className="font-semibold text-text-primary text-xs mb-2">加成说明</h4>
        <ul className="text-[11px] text-text-secondary space-y-1 list-disc list-inside">
          <li>攻击加成对所有兵种生效（战士/弓兵/骑兵/重甲）</li>
          <li>与部落加成（蚩尤 +25%）、强兵术科技叠加</li>
          <li>升级铸铜坊是提升军队战力的核心途径之一</li>
        </ul>
      </div>
    </div>
  );
}

function AcademyAction() {
  const village = useGame((s) => s.village);
  const lv = village.buildings.academy || 0;
  const [showTech, setShowTech] = useState(false);
  const researching = village.researchQueue.length > 0;

  return (
    <div className="space-y-3">
      <div className="border border-border rounded-lg p-3 bg-bg-secondary">
        <h3 className="font-semibold text-text-primary text-sm mb-2">📚 灵台</h3>
        <div className="text-xs text-text-secondary space-y-1">
          <div>当前等级：Lv{lv}</div>
          <div>研习秘术，研发科技永久加成部落</div>
        </div>
      </div>

      {lv > 0 && (
        <button
          onClick={() => setShowTech(true)}
          className="w-full py-3 bg-pop text-white rounded-lg font-semibold hover:bg-pop-hover transition flex items-center justify-center gap-2"
        >
          🔬 打开科技树
          {researching && <span className="text-[10px] bg-white/25 px-2 py-0.5 rounded">研发中</span>}
        </button>
      )}

      {lv === 0 && (
        <div className="border border-dashed border-border rounded-lg p-4 text-center">
          <div className="text-3xl mb-2">🔬</div>
          <p className="text-xs text-text-muted">升级灵台后开启科技研发</p>
        </div>
      )}

      {showTech && <TechTreePanel onClose={() => setShowTech(false)} />}
    </div>
  );
}

function StableAction() {
  return (
    <div className="space-y-3">
      <div className="border border-dashed border-border rounded-lg p-4 text-center">
        <div className="text-3xl mb-2">🐎</div>
        <p className="text-xs text-text-muted">骑兵训练开发中</p>
      </div>
    </div>
  );
}

function WorkshopAction() {
  return (
    <div className="space-y-3">
      <div className="border border-dashed border-border rounded-lg p-4 text-center">
        <div className="text-3xl mb-2">🧰</div>
        <p className="text-xs text-text-muted">攻城武器开发中</p>
      </div>
    </div>
  );
}

function WallAction() {
  const village = useGame((s) => s.village);
  const lv = village.buildings.wall || 0;
  const wall = getWallDefense(village);
  const defense = computeVillageDefense(village);
  const now = Date.now();
  const remainMs = Math.max(0, village.nextInvasionAt - now);
  const remainMin = Math.floor(remainMs / 60000);
  const remainSec = Math.floor((remainMs % 60000) / 1000);
  const report = village.lastDefenseReport;

  return (
    <div className="space-y-3">
      <div className="border border-border rounded-lg p-3 bg-bg-secondary">
        <h3 className="font-semibold text-text-primary text-sm mb-2">🧱 城墙防御</h3>
        <div className="text-xs text-text-secondary space-y-1">
          <div>当前等级：Lv{lv}</div>
          <div>城墙防御值：<span className="text-pop font-semibold">{wall.defense}</span></div>
          <div>守军防御加成：<span className="text-emerald-600 font-semibold">+{(wall.defenseBonus * 100).toFixed(0)}%</span></div>
        </div>
      </div>

      {/* 村庄总防御战力 */}
      <div className="border border-border rounded-lg p-3 bg-bg-secondary">
        <h3 className="font-semibold text-text-primary text-sm mb-2">🛡️ 村庄防御战力</h3>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="text-text-muted">总兵力</div>
            <div className="font-semibold text-text-primary">{defense.army.count}</div>
          </div>
          <div>
            <div className="text-text-muted">总攻击</div>
            <div className="font-semibold text-red-500">{Math.round(defense.army.attack)}</div>
          </div>
          <div>
            <div className="text-text-muted">总防御</div>
            <div className="font-semibold text-blue-500">{Math.round(defense.army.defense)}</div>
          </div>
        </div>
      </div>

      {/* 入侵倒计时 */}
      <div className={`border rounded-lg p-3 ${remainMs < 60000 ? 'border-red-400 bg-red-50' : 'border-border bg-bg-secondary'}`}>
        <h3 className="font-semibold text-text-primary text-sm mb-1">👹 妖兽入侵</h3>
        <div className="text-xs text-text-secondary">
          {remainMs > 0 ? (
            <span>下次入侵：<span className="font-mono font-semibold">{remainMin}分{remainSec}秒</span></span>
          ) : (
            <span className="text-red-600 font-semibold">入侵即将来临！</span>
          )}
        </div>
        <p className="text-[10px] text-text-muted mt-1">每 5 分钟一波妖兽袭击村庄，自动防御</p>
      </div>

      {/* 最近防御战报 */}
      {report && (
        <div className={`border rounded-lg p-3 ${report.won ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
          <h3 className="font-semibold text-text-primary text-sm mb-1">
            {report.won ? '✅ 防御胜利' : '❌ 防御失败'}
          </h3>
          <div className="text-xs text-text-secondary space-y-0.5">
            <div>来袭：{RAIDER_CONFIGS[report.raiderType].emoji} {RAIDER_CONFIGS[report.raiderType].name} ×{report.raiderCount}</div>
            {!report.won && report.resourcesStolen && (
              <div className="text-red-600">
                被掠夺：
                {report.resourcesStolen.wood > 0 && ` 🪵${report.resourcesStolen.wood}`}
                {report.resourcesStolen.clay > 0 && ` 🏺${report.resourcesStolen.clay}`}
                {report.resourcesStolen.iron > 0 && ` 🔶${report.resourcesStolen.iron}`}
                {report.resourcesStolen.crop > 0 && ` 🌾${report.resourcesStolen.crop}`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============== 通用子组件 ==============

function Cost({ label, icon, cost, have }: { label: string; icon: string; cost: number; have: number }) {
  const ok = have >= cost;
  return (
    <div className={`
      rounded px-2 py-1 border text-center
      ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}
    `}>
      <div className="text-[10px] opacity-80">{icon} {label}</div>
      <div className="font-bold text-sm">{cost.toLocaleString()}</div>
      {!ok && <div className="text-[10px]">差 {Math.ceil(cost - have)}</div>}
    </div>
  );
}

function ResourceBar({ name, cur, cap, color }: { name: string; cur: number; cap: number; color: string }) {
  const pct = Math.min(100, (cur / cap) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-text-secondary">{name}</span>
        <span className="text-text-primary font-semibold">{Math.floor(cur)} / {cap}</span>
      </div>
      <div className="w-full bg-bg-primary rounded-full h-2 overflow-hidden">
        <div className={`${color} h-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default BuildingDetailPanel;

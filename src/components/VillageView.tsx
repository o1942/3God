import { memo, useMemo, useState } from 'react';
import type { FieldType } from '../game/types';
import { FIELD_CONFIGS } from '../game/config';
import { SPEED_MULTIPLIER } from '../game/initialState';
import { computeBuildSpeed, useGame } from '../store/gameStore';

const Field_ORDER: FieldType[] = ['woodcutter', 'clayPit', 'ironMine', 'cropland'];

const FIELD_THEME: Record<FieldType, { bg: string; border: string; hoverBg: string; ring: string; progress: string }> = {
  woodcutter: { bg: 'bg-amber-100', border: 'border-amber-300', hoverBg: 'hover:bg-amber-200', ring: 'ring-amber-500', progress: 'bg-amber-500' },
  clayPit:    { bg: 'bg-yellow-100', border: 'border-yellow-300', hoverBg: 'hover:bg-yellow-200', ring: 'ring-yellow-500', progress: 'bg-yellow-500' },
  ironMine:   { bg: 'bg-gray-100', border: 'border-gray-300', hoverBg: 'hover:bg-gray-200', ring: 'ring-gray-400', progress: 'bg-gray-400' },
  cropland:   { bg: 'bg-lime-100', border: 'border-lime-300', hoverBg: 'hover:bg-lime-200', ring: 'ring-lime-500', progress: 'bg-lime-500' },
};

export function VillageView() {
  const village = useGame((s) => s.village);
  const enqueueFieldUpgrade = useGame((s) => s.enqueueFieldUpgrade);
  const [selected, setSelected] = useState<{ type: FieldType; index: number } | null>(null);

  // 按类型分组（useMemo 缓存，fields 不变时不重算）
  const fieldsByType = useMemo(() => Field_ORDER.map((t) => ({
    type: t,
    fields: village.fields[t].map((lv, i) => ({ level: lv, index: i })),
  })), [village.fields]);

  // 总产量（useMemo 缓存）
  const totalProduction = useMemo(() => {
    const prod = { wood: 0, clay: 0, iron: 0, crop: 0 };
    for (const t of Field_ORDER) {
      village.fields[t].forEach((lv) => {
        if (lv > 0) {
          const p = FIELD_CONFIGS[t].levels[lv - 1].production;
          if (t === 'woodcutter') prod.wood += p;
          else if (t === 'clayPit') prod.clay += p;
          else if (t === 'ironMine') prod.iron += p;
          else if (t === 'cropland') prod.crop += p;
        }
      });
    }
    return prod;
  }, [village.fields]);

  // selected 状态由各卡片内部自行计算升级信息

  return (
    <div className="bg-bg-primary p-3 min-h-full pb-24">
      {/* 资源总览 */}
      <div className="max-w-2xl mx-auto mb-3">
        <div className="card-std p-3">
          <div className="text-xs text-text-muted mb-2">📊 资源田产量总览</div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div>
              <div className="text-amber-700">🪵 木/h</div>
              <div className="font-bold text-amber-800">+{totalProduction.wood}</div>
            </div>
            <div>
              <div className="text-yellow-700">🏺 陶土/h</div>
              <div className="font-bold text-yellow-800">+{totalProduction.clay}</div>
            </div>
            <div>
              <div className="text-orange-700">🔶 铜/h</div>
              <div className="font-bold text-orange-800">+{totalProduction.iron}</div>
            </div>
            <div>
              <div className="text-lime-700">🌾 粟/h</div>
              <div className="font-bold text-lime-800">+{totalProduction.crop}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 按类型分组展示 */}
      <div className="max-w-2xl mx-auto space-y-3">
        {fieldsByType.map((group) => {
          const cfg = FIELD_CONFIGS[group.type];
          const theme = FIELD_THEME[group.type];
          return (
            <div key={group.type}>
              <h3 className="text-sm font-semibold tracking-wide text-text-secondary mb-2 px-1 flex items-center gap-1">
                <span>{cfg.emoji}</span>
                <span>{cfg.name}</span>
                <span className="text-text-muted text-xs">({group.fields.length} 块)</span>
              </h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {group.fields.map((f) => {
                  const isSel = selected?.type === group.type && selected?.index === f.index;
                  const isUpgrading = village.buildQueue.some(
                    (t) => t.target.kind === 'field' && t.target.fieldType === group.type && t.target.index === f.index,
                  );
                  const task = village.buildQueue.find(
                    (t) => t.target.kind === 'field' && t.target.fieldType === group.type && t.target.index === f.index,
                  );
                  const progress = task ? Math.min(100, ((Date.now() - task.startAt) / task.duration) * 100) : 0;
                  const fNextLv = f.level + 1;
                  const fUpgrade = fNextLv <= 20 ? cfg.levels[fNextLv - 1] : null;
                  const fCanAfford = fUpgrade
                    ? village.resources.wood >= fUpgrade.cost.wood &&
                      village.resources.clay >= fUpgrade.cost.clay &&
                      village.resources.iron >= fUpgrade.cost.iron &&
                      village.resources.crop >= fUpgrade.cost.crop
                    : false;
                  const fInQueue = village.buildQueue.some(
                    (t) => t.target.kind === 'field' && t.target.fieldType === group.type && t.target.index === f.index,
                  );
                  const fBuildSec = fUpgrade ? Math.ceil((fUpgrade.buildTime * SPEED_MULTIPLIER) / computeBuildSpeed(village)) : 0;
                  const fNextProd = fUpgrade ? fUpgrade.production : 0;
                  const fCurProd = f.level > 0 ? cfg.levels[f.level - 1].production : 0;

                  return (
                    <div key={`${group.type}-${f.index}`} className="flex flex-col gap-1">
                      {/* 资源田卡片 */}
                      <button
                        onClick={() => setSelected(isSel ? null : { type: group.type, index: f.index })}
                        className={`
                          aspect-square rounded-lg flex flex-col items-center justify-center relative overflow-hidden
                          ${theme.bg} ${theme.border} ${theme.hoverBg} border-2
                          text-text-primary card-interactive
                          ${isSel ? `ring-2 ${theme.ring} ring-offset-1 ring-offset-bg-primary` : ''}
                          ${f.level === 0 ? 'opacity-60' : ''}
                        `}
                      >
                        <span className="text-xl sm:text-2xl">{cfg.emoji}</span>
                        <span className="text-xs font-bold mt-0.5">Lv{f.level}</span>
                        {f.level > 0 && (
                          <span className="text-[9px] sm:text-[10px] opacity-70">+{fCurProd}/h</span>
                        )}
                        {isUpgrading && (
                          <div className="absolute bottom-0 inset-x-0 h-1 bg-bg-primary/50">
                            <div className={`${theme.progress} h-full transition-all duration-300`} style={{ width: `${progress}%` }} />
                          </div>
                        )}
                        {isUpgrading && (
                          <div className="absolute top-0.5 right-0.5 text-[9px] bg-black/40 rounded-full w-4 h-4 flex items-center justify-center text-white">
                            ⏳
                          </div>
                        )}
                      </button>

                      {/* 内联展开：费用 + 升级按钮 */}
                      {isSel && fUpgrade && (
                        <div className="rounded-lg border-2 border-pop bg-bg-card p-1.5 space-y-1 anim-slide-up">
                          {/* 等级变化 */}
                          <div className="text-[10px] text-text-muted text-center">
                            Lv{f.level} <span className="text-emerald-600 font-semibold">→ Lv{fNextLv}</span>
                            <span className="text-emerald-600"> (+{fNextProd - fCurProd}/h)</span>
                          </div>
                          {/* 费用 */}
                          <div className="grid grid-cols-4 gap-0.5 text-center">
                            <CostMini icon="🪵" cost={fUpgrade.cost.wood} have={village.resources.wood} />
                            <CostMini icon="🏺" cost={fUpgrade.cost.clay} have={village.resources.clay} />
                            <CostMini icon="🔶" cost={fUpgrade.cost.iron} have={village.resources.iron} />
                            <CostMini icon="🌾" cost={fUpgrade.cost.crop} have={village.resources.crop} />
                          </div>
                          {/* 时间 */}
                          <div className="text-[10px] text-text-muted text-center">⏱ {fBuildSec}s</div>
                          {/* 升级按钮 */}
                          <button
                            disabled={!fCanAfford || fInQueue}
                            onClick={() => {
                              enqueueFieldUpgrade(group.type, f.index);
                              setSelected(null);
                            }}
                            className={`
                              w-full py-1.5 rounded text-xs font-semibold transition
                              ${fInQueue ? 'bg-bg-secondary text-text-muted' : fCanAfford ? 'bg-pop text-white hover:bg-pop-hover' : 'bg-red-50 text-red-600'}
                            `}
                          >
                            {fInQueue ? '排队中' : fCanAfford ? '升级' : '资源不足'}
                          </button>
                        </div>
                      )}
                      {isSel && !fUpgrade && (
                        <div className="rounded-lg border-2 border-pop bg-bg-card p-1.5 text-center text-[10px] text-text-muted">
                          已达最高等级
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 提示文字（选中时隐藏） */}
      {!selected && (
        <div className="max-w-2xl mx-auto mt-3 text-center text-[10px] text-text-muted">
          💡 点击资源田卡片查看升级费用
        </div>
      )}
    </div>
  );
}

const CostMini = memo(function CostMini({ icon, cost, have }: { icon: string; cost: number; have: number }) {
  const ok = have >= cost;
  return (
    <div className={ok ? 'text-emerald-700' : 'text-red-600'}>
      <div className="text-[9px]">{icon}</div>
      <div className="font-bold text-[10px]">{cost}</div>
    </div>
  );
});

import { useState } from 'react';
import type { BuildingType } from '../game/types';
import { BUILDING_CONFIGS } from '../game/config';
import { computeBuildSpeed, useGame } from '../store/gameStore';
import { BuildingDetailPanel } from './BuildingDetailPanel';
import { BUILDING_ART, WallRing, VillageSceneArt } from '../game/buildingArt';

// 城镇地图：每个建筑在部落航拍图上的固定位置（百分比，基于容器中心点）
// 坐标对应图中帐篷 / 中心大厅 / 城墙的实际位置

type Slot = { top: number; left: number; size: number };

const VILLAGE_LAYOUT: Record<BuildingType, Slot> = {
  mainBuilding: { top: 45, left: 48, size: 1.4 }, // 中心大厅
  warehouse:    { top: 31, left: 40, size: 1 },   // 上方帐篷
  granary:      { top: 35, left: 33, size: 1 },   // 左上帐篷
  smithy:       { top: 43, left: 28, size: 1 },   // 左侧帐篷
  stable:       { top: 58, left: 26, size: 1 },   // 左下帐篷
  cranny:       { top: 63, left: 32, size: 1 },   // 左下近门
  rallyPoint:   { top: 26, left: 60, size: 1 },   // 右上帐篷
  market:       { top: 34, left: 66, size: 1 },   // 右上帐篷
  workshop:     { top: 42, left: 74, size: 1 },   // 右侧帐篷
  embassy:      { top: 52, left: 68, size: 1 },   // 右下帐篷
  academy:      { top: 57, left: 55, size: 1 },   // 下方帐篷
  barracks:     { top: 64, left: 60, size: 1 },   // 下方帐篷
  wall:         { top: 50, left: 50, size: 1 },   // 城墙（整圈）
};

const BUILDING_THEME: Partial<Record<BuildingType, { emoji: string; ring: string; bg: string }>> = {
  mainBuilding: { emoji: '⛰️', ring: 'ring-amber-400', bg: 'from-amber-400 to-amber-600' },
  warehouse:    { emoji: '🛖', ring: 'ring-amber-300', bg: 'from-amber-300 to-amber-500' },
  granary:      { emoji: '🌾', ring: 'ring-yellow-300', bg: 'from-yellow-300 to-yellow-500' },
  rallyPoint:   { emoji: '🚩', ring: 'ring-red-300', bg: 'from-red-400 to-red-600' },
  cranny:       { emoji: '🪨', ring: 'ring-gray-300', bg: 'from-gray-400 to-gray-600' },
  embassy:      { emoji: '🤲', ring: 'ring-blue-300', bg: 'from-blue-400 to-blue-600' },
  barracks:     { emoji: '🏹', ring: 'ring-red-300', bg: 'from-red-400 to-red-600' },
  market:       { emoji: '🪙', ring: 'ring-green-300', bg: 'from-green-400 to-green-600' },
  stable:       { emoji: '🐎', ring: 'ring-orange-300', bg: 'from-orange-400 to-orange-600' },
  workshop:     { emoji: '🧰', ring: 'ring-gray-300', bg: 'from-gray-400 to-gray-600' },
  smithy:       { emoji: '🔨', ring: 'ring-orange-300', bg: 'from-orange-400 to-orange-600' },
  academy:      { emoji: '📚', ring: 'ring-purple-300', bg: 'from-purple-400 to-purple-600' },
  wall:         { emoji: '🧱', ring: 'ring-stone-300', bg: 'from-stone-400 to-stone-600' },
};

const SLOT_BUILDINGS: BuildingType[] = [
  'mainBuilding', 'warehouse', 'granary', 'smithy',
  'stable', 'cranny', 'rallyPoint', 'market', 'workshop',
  'embassy', 'academy', 'barracks',
];

const ALL_BUILDINGS: BuildingType[] = [...SLOT_BUILDINGS, 'wall'];

export function BuildingView() {
  const village = useGame((s) => s.village);
  const [selected, setSelected] = useState<BuildingType | null>(null);

  const mainLv = village.buildings.mainBuilding || 0;
  const wallLv = village.buildings.wall || 0;
  const builtCount = ALL_BUILDINGS.filter((b) => (village.buildings[b] || 0) > 0).length;

  return (
    <div className="bg-bg-primary p-3 min-h-full pb-24">
      <div className="max-w-3xl mx-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-sm font-semibold tracking-wide text-text-secondary">
            🏘️ 部落全貌（{builtCount}/{ALL_BUILDINGS.length}）
          </h3>
          {mainLv > 0 && (
            <span className="text-[10px] text-text-muted">
              建造速度 {(computeBuildSpeed(village) * 100).toFixed(0)}%
            </span>
          )}
        </div>

        {/* 部落实景地图 */}
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-stone-400 shadow-lg bg-stone-800">
          {/* 背景图 */}
          <VillageSceneArt className="absolute inset-0 w-full h-full select-none" />
          {/* 未开发时的暗色蒙层：建筑越多越明亮 */}
          <div
            className="absolute inset-0 bg-stone-900 transition-opacity duration-700 pointer-events-none"
            style={{ opacity: Math.max(0, 0.55 - builtCount * 0.04) }}
          />

          {/* 城墙：环绕村落的 SVG 城墙环（随等级进化） */}
          <WallRing
            level={wallLv}
            className={`absolute inset-0 w-full h-full ${wallLv > 0 ? 'cursor-pointer' : 'pointer-events-none'}`}
            onClick={wallLv > 0 ? () => setSelected('wall') : undefined}
          />
          {wallLv > 0 ? (
            <button
              onClick={() => setSelected('wall')}
              className={`absolute bottom-[6%] left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-stone-800/80 border text-stone-100 text-[10px] font-bold hover:bg-stone-700 transition ${selected === 'wall' ? 'border-pop ring-2 ring-pop' : 'border-stone-300'}`}
            >
              🧱 城墙 Lv{wallLv}
            </button>
          ) : (
            <button
              onClick={() => setSelected('wall')}
              className="absolute bottom-[6%] left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/50 border border-dashed border-stone-300/70 text-stone-200 text-[10px] hover:bg-black/70 transition"
            >
              🧱 点击建造城墙
            </button>
          )}

          {/* 建筑槽位 */}
          {SLOT_BUILDINGS.map((b) => {
            const slot = VILLAGE_LAYOUT[b];
            const cfg = BUILDING_CONFIGS[b];
            const lv = village.buildings[b] || 0;
            const isBuilt = lv > 0;
            const theme = BUILDING_THEME[b] || { emoji: cfg.emoji, ring: 'ring-border', bg: 'from-gray-400 to-gray-600' };
            const isUpgrading = village.buildQueue.some(
              (t) => t.target.kind === 'building' && t.target.building === b,
            );
            const task = village.buildQueue.find(
              (t) => t.target.kind === 'building' && t.target.building === b,
            );
            const progress = task ? Math.min(100, ((Date.now() - task.startAt) / task.duration) * 100) : 0;
            const isMain = b === 'mainBuilding';
            const ArtComp = BUILDING_ART[b];
            const isSelected = selected === b;

            return (
              <button
                key={b}
                onClick={() => setSelected(b)}
                style={{
                  top: `${slot.top}%`,
                  left: `${slot.left}%`,
                  width: `calc(${slot.size} * clamp(2rem, 9vw, 3.6rem))`,
                  height: `calc(${slot.size} * clamp(2rem, 9vw, 3.6rem))`,
                }}
                className={`
                  absolute -translate-x-1/2 -translate-y-1/2 rounded-full
                  flex flex-col items-center justify-center
                  transition-all duration-300 group
                  ${isBuilt
                    ? `bg-gradient-to-br ${theme.bg} border-2 border-white/70 ring-2 ${theme.ring} shadow-[0_4px_12px_rgba(0,0,0,0.45)] hover:scale-110`
                    : 'bg-black/25 border-2 border-dashed border-white/50 hover:border-white hover:bg-black/40'
                  }
                  ${isUpgrading ? 'animate-pulse ring-4 ring-pop' : ''}
                  ${isSelected ? '!ring-4 !ring-pop scale-110 shadow-[0_0_20px_rgba(244,114,182,0.6)]' : ''}
                `}
                title={cfg.name}
              >
                {isBuilt ? (
                  <>
                    {ArtComp ? (
                      <ArtComp className={`w-[80%] h-[80%] drop-shadow ${isMain ? '' : ''}`} />
                    ) : (
                      <span className={`drop-shadow ${isMain ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-2xl'}`}>
                        {cfg.emoji}
                      </span>
                    )}
                    <span className="-mt-1 px-1 rounded-full bg-black/50 text-white text-[8px] sm:text-[9px] font-bold leading-tight">
                      {lv}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-sm sm:text-base opacity-70">➕</span>
                    <span className="text-[7px] sm:text-[8px] text-white/80 leading-none mt-0.5">
                      {cfg.name}
                    </span>
                  </>
                )}

                {/* 升级进度条 */}
                {isUpgrading && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[120%] h-1 bg-black/30 rounded-full overflow-hidden">
                    <div className="bg-pop h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* 图例 */}
        <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-dashed border-gray-400 bg-black/20" />
            可建造
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-white bg-amber-500" />
            已建造
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full bg-pop animate-pulse" />
            升级中
          </span>
        </div>

        {/* 提示 */}
        <div className="mt-2 p-2 border-2 border-dashed border-border rounded-lg text-center text-xs text-text-muted">
          点击地图上的空地建造，或点击已建造建筑查看 / 升级
        </div>
      </div>

      {/* 详情面板 */}
      {selected && (
        <BuildingDetailPanel building={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

export default BuildingView;
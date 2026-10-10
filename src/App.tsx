import { lazy, memo, Suspense, useEffect, useMemo, useState } from 'react';
import type { TribeType } from './game/types';
import { BattleReportLayer, PvpReportLayer } from './components/BattleReportLayer';
import { CosmeticApplier } from './components/CosmeticApplier';
import { BuildingView } from './components/BuildingView';
import { BuildQueue } from './components/BuildQueue';
import { LoginScreen } from './components/LoginScreen';
import { flushVillageUploadNow } from './lib/supabase';
import { OfflineReportLayer } from './components/OfflineReportLayer';
import { PlayerWorldBar } from './components/PlayerWorldBar';
import { ResourceBar } from './components/ResourceBar';
import { ToastContainer } from './components/ToastContainer';
import { VillageView } from './components/VillageView';
import { TutorialGuide } from './components/TutorialGuide';
import { SeasonEndOverlay } from './components/SeasonEndOverlay';

// 懒加载：用户点击后才加载对应面板代码，减少首屏体积
const BarracksPanel = lazy(() => import('./components/BarracksPanel').then(m => ({ default: m.BarracksPanel })));
const CosmeticShop = lazy(() => import('./components/CosmeticShop').then(m => ({ default: m.CosmeticShop })));
const BuildingPanel = lazy(() => import('./components/BuildingPanel').then(m => ({ default: m.BuildingPanel })));
const LeaderboardPanel = lazy(() => import('./components/LeaderboardPanel').then(m => ({ default: m.LeaderboardPanel })));
const MapPanel = lazy(() => import('./components/MapPanel').then(m => ({ default: m.MapPanel })));
const QuestPanel = lazy(() => import('./components/QuestPanel').then(m => ({ default: m.QuestPanel })));
const SeasonPanel = lazy(() => import('./components/SeasonPanel').then(m => ({ default: m.SeasonPanel })));
const EventLogPanel = lazy(() => import('./components/EventLogPanel').then(m => ({ default: m.EventLogPanel })));
const MarketPanel = lazy(() => import('./components/MarketPanel').then(m => ({ default: m.MarketPanel })));
const AlliancePanel = lazy(() => import('./components/AlliancePanel').then(m => ({ default: m.AlliancePanel })));
const SettingsPanel = lazy(() => import('./components/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
import { SEASON_MILESTONES } from './game/season';
import { QUESTS } from './game/quests';
import { TRIBE_CONFIGS, TRIBE_ORDER } from './game/tribes';
import { useGame, computePower } from './store/gameStore';

type Tab = 'fields' | 'buildings';

const TRIBE_SELECTED_KEY = 'travian-tribe-selected-v1';

function App() {
  const tick = useGame((s) => s.tick);
  const reset = useGame((s) => s.reset);
  const setTribe = useGame((s) => s.setTribe);
  const logout = useGame((s) => s.logout);
  const isLoggedIn = useGame((s) => s.isLoggedIn);
  const checkOffline = useGame((s) => s.checkOfflineEarnings);
  const queue = useGame((s) => s.village.buildQueue);
  const trainQueue = useGame((s) => s.village.trainQueue);
  const units = useGame((s) => s.village.units);
  const barracksLv = useGame((s) => s.village.buildings.barracks || 0);
  const completedQuests = useGame((s) => s.completedQuests);
  const seasonPoints = useGame((s) => s.village.season.points);
  const seasonClaimed = useGame((s) => s.village.season.claimedMilestones);
  const [showBuildings, setShowBuildings] = useState(false);
  const [showBarracks, setShowBarracks] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const [showSeason, setShowSeason] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showEventLog, setShowEventLog] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  const [showAlliance, setShowAlliance] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('fields');
  // 部落选择：登录后如未选部落则需选择
  const [showTribeSelect, setShowTribeSelect] = useState(false);

  // 登录后检查是否已选部落
  useEffect(() => {
    if (isLoggedIn) {
      const tribeKey = `${TRIBE_SELECTED_KEY}-${useGame.getState().village.playerName}`;
      if (!localStorage.getItem(tribeKey)) {
        setShowTribeSelect(true);
      }
    }
  }, [isLoggedIn]);

  // 启动时检测离线收益
  useEffect(() => {
    checkOffline();
  }, [checkOffline]);

  // 主循环 tick
  useEffect(() => {
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [tick]);

  // 页面可见性变化时更新 lastSeen
  useEffect(() => {
    const handler = () => {
      if (!document.hidden) {
        checkOffline();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [checkOffline]);

  // 关闭/刷新页面时立即上传存档到云端
  useEffect(() => {
    const handler = () => {
      flushVillageUploadNow();
    };
    window.addEventListener('beforeunload', handler);
    window.addEventListener('pagehide', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      window.removeEventListener('pagehide', handler);
    };
  }, []);

  const hasTask = queue.length > 0 || trainQueue.length > 0;
  const doneQuests = completedQuests.length;
  const totalQuests = QUESTS.length;
  const newQuests = totalQuests - doneQuests;

  const claimableMilestones = SEASON_MILESTONES.filter(
    (m) => seasonPoints >= m.points && !seasonClaimed.includes(m.points)
  ).length;

  // PC 端侧边栏动态数据
  const nextInvasionAt = useGame((s) => s.village.nextInvasionAt);
  const seasonEndsAt = useGame((s) => s.village.season.endsAt);
  const battleReports = useGame((s) => s.battleReports);
  const pvpReports = useGame((s) => s.pvpReports);
  const lastDefenseReport = useGame((s) => s.village.lastDefenseReport);

  // 跨玩家：真实排行榜 / 来袭战报
  const playerName = useGame((s) => s.village.playerName);
  const leaderboard = useGame((s) => s.leaderboard);
  const incomingAttacks = useGame((s) => s.village.incomingAttacks);
  const unseenIncoming = (incomingAttacks || []).filter((a) => !a.seen).length;

  // 我的真实排名（按战力）— useMemo 缓存，leaderboard 不变时不重算
  const leaderboardRanked = useMemo(() => leaderboard
    .map((e) => ({ name: e.playerName, tribe: e.tribe, points: e.points, power: computePower(e.units as any, e.wallLevel, e.buildingSum) }))
    .sort((a, b) => b.power - a.power), [leaderboard]);
  const myRankIdx = leaderboardRanked.findIndex((r) => r.name === playerName);
  const myRank = myRankIdx >= 0 ? myRankIdx + 1 : 0;
  const myPower = myRankIdx >= 0 ? leaderboardRanked[myRankIdx].power : 0;
  const topPlayers = leaderboardRanked.slice(0, 3);

  // 世界事件内容
  const invasionInSec = Math.max(0, Math.ceil((nextInvasionAt - Date.now()) / 1000));
  const seasonRemainMs = Math.max(0, seasonEndsAt - Date.now());
  const seasonDays = Math.floor(seasonRemainMs / (24 * 3600 * 1000));
  const seasonHours = Math.floor((seasonRemainMs % (24 * 3600 * 1000)) / (3600 * 1000));

  // 战报速递内容
  const totalReports = battleReports.length + pvpReports.length;
  const recentWin = [...battleReports, ...pvpReports].filter((r: any) => r.win).length;

  const totalUnits = Object.values(units).reduce((s, n) => s + (n || 0), 0);

  // 设置面板：重置存档 / 登出
  const handleReset = () => {
    if (confirm('重置存档？所有进度将丢失，需重新选择部落')) {
      localStorage.removeItem(`${TRIBE_SELECTED_KEY}-${playerName}`);
      reset();
      setShowSettings(false);
      setShowTribeSelect(true);
    }
  };
  const handleLogout = () => {
    if (confirm('确定登出？下次可从此玩家名重新进入')) {
      logout();
      setShowSettings(false);
    }
  };

  // 未登录：显示登录界面
  if (!isLoggedIn) {
    return (
      <>
        <LoginScreen />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      {/* E. PC 端侧边栏 - 可点击，显示动态内容 */}
      <div className="hidden lg:flex fixed left-0 top-16 bottom-16 w-48 flex-col gap-3 p-4">
        {/* 世界事件 */}
        <button
          onClick={() => setShowEventLog(true)}
          className="card-std p-3 text-xs text-left hover:border-pop hover:shadow-md transition-all cursor-pointer"
        >
          <div className="text-text-muted text-[10px] mb-1">📜 世界事件</div>
          <div className="text-text-secondary font-semibold">
            {invasionInSec > 0 ? `妖兽 ${invasionInSec}s 后来袭` : '妖兽正在入侵！'}
          </div>
          <div className="text-text-muted text-[10px] mt-1">
            {seasonDays > 0 ? `赛季剩 ${seasonDays}天${seasonHours}时` : `赛季剩 ${seasonHours} 时`}
            {lastDefenseReport && ` · 上次${lastDefenseReport.won ? '抵御' : '失守'}`}
          </div>
        </button>
        {/* 赛季排行 */}
        <button
          onClick={() => setShowSeason(true)}
          className="card-std p-3 text-xs text-left hover:border-pop hover:shadow-md transition-all cursor-pointer"
        >
          <div className="text-text-muted text-[10px] mb-1">🏆 赛季排行</div>
          <div className="text-text-secondary font-semibold">
            {myRank > 0 ? `全服第 ${myRank} 名` : '尚未上榜'}
          </div>
          <div className="text-text-muted text-[10px] mt-1">
            积分 {seasonPoints}{myPower > 0 && ` · 战力 ${myPower}`}
            {claimableMilestones > 0 && <span className="text-pop font-bold"> · {claimableMilestones}可领</span>}
          </div>
        </button>
        {/* 全服争霸 */}
        <button
          onClick={() => setShowLeaderboard(true)}
          className="card-std p-3 text-xs text-left hover:border-pop hover:shadow-md transition-all cursor-pointer"
        >
          <div className="text-text-muted text-[10px] mb-1">🌐 全服争霸</div>
          <div className="text-text-secondary font-semibold">
            {leaderboard.length} 位玩家 · 点击出征
          </div>
          <div className="text-text-muted text-[10px] mt-1">
            {unseenIncoming > 0 ? <span className="text-red-600 font-bold">⚔️ {unseenIncoming} 条来袭</span> : '与真实玩家争霸洪荒'}
          </div>
        </button>
      </div>
      <div className="hidden lg:flex fixed right-0 top-16 bottom-16 w-48 flex-col gap-3 p-4">
        {/* 全服强者 */}
        <button
          onClick={() => setShowLeaderboard(true)}
          className="card-std p-3 text-xs text-left hover:border-pop hover:shadow-md transition-all cursor-pointer"
        >
          <div className="text-text-muted text-[10px] mb-1">🔥 全服强者</div>
          {topPlayers.length > 0 ? (
            <div className="space-y-0.5">
              {topPlayers.map((n, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className={`truncate ${n.name === playerName ? 'text-pop font-semibold' : 'text-text-secondary'}`}>
                    {(TRIBE_CONFIGS[n.tribe as TribeType] || TRIBE_CONFIGS.huang).emoji} {n.name}
                  </span>
                  <span className="text-text-muted text-[10px] shrink-0">{n.power}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-text-muted">暂无数据</div>
          )}
          <div className="text-text-muted text-[10px] mt-1">按战力排行 · 点击出征</div>
        </button>
        {/* 战报速递 */}
        <button
          onClick={() => setShowEventLog(true)}
          className="card-std p-3 text-xs text-left hover:border-pop hover:shadow-md transition-all cursor-pointer"
        >
          <div className="text-text-muted text-[10px] mb-1">⚔️ 战报速递</div>
          {totalReports > 0 || lastDefenseReport ? (
            <>
              <div className="text-text-secondary font-semibold">
                {totalReports > 0 ? `${totalReports} 份待处理 · 胜 ${recentWin}` : '最近战报'}
              </div>
              <div className="text-text-muted text-[10px] mt-1">
                {lastDefenseReport
                  ? `上次防御${lastDefenseReport.won ? '成功' : '失败'} · ${lastDefenseReport.raiderCount} 妖兽`
                  : `出征 ${totalReports} · 胜 ${recentWin}`}
              </div>
            </>
          ) : (
            <>
              <div className="text-text-secondary">暂无战报</div>
              <div className="text-text-muted text-[10px] mt-1">出征妖兽或攻伐部落</div>
            </>
          )}
        </button>
      </div>

      <ResourceBar />
      <PlayerWorldBar />

      {/* 主版块 Tab 切换 */}
      <div className="bg-bg-card border-b border-border sticky top-0 z-20 shadow-sm">
        <div className="max-w-2xl mx-auto flex relative">
          <TabBtn
            active={activeTab === 'fields'}
            onClick={() => setActiveTab('fields')}
            icon="🌳"
            label="资源田"
          />
          <TabBtn
            active={activeTab === 'buildings'}
            onClick={() => setActiveTab('buildings')}
            icon="⛰️"
            label="建筑"
          />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto">
          {activeTab === 'fields' ? <VillageView /> : <BuildingView />}

          {hasTask && (
            <div className="px-3 py-2 anim-fade-in">
              <div className="card-std p-2 text-xs text-pop text-center">
                ⏳ 进行中：建造 {queue.length} · 训练 {trainQueue.length} · 资源持续生产中
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 底部固定导航栏 */}
      <nav className="fixed bottom-0 inset-x-0 bg-bg-secondary/95 backdrop-blur-sm border-t border-border px-2 py-1.5 flex justify-around items-center max-w-2xl mx-auto z-30 shadow-[0_-2px_8px_rgba(45,36,24,0.06)]">
        <NavBtn icon="🏗️" label="建造" onClick={() => setShowBuildings(true)} />
        <NavBtn
          icon="🏹"
          label="军帐"
          badge={totalUnits > 0 ? totalUnits : undefined}
          disabled={barracksLv < 1}
          onClick={() => barracksLv > 0 && setShowBarracks(true)}
        />
        <NavBtn icon="🗺️" label="地图" onClick={() => setShowMap(true)} />
        <NavBtn icon="🏪" label="集市" onClick={() => setShowMarket(true)} />
        <NavBtn icon="🛡️" label="联盟" onClick={() => setShowAlliance(true)} />
        <NavBtn
          icon="🌐"
          label="全服"
          badge={unseenIncoming > 0 ? unseenIncoming : undefined}
          onClick={() => setShowLeaderboard(true)}
        />
        <NavBtn
          icon="📋"
          label="事件"
          badge={(battleReports.length + pvpReports.length) > 0 ? (battleReports.length + pvpReports.length) : undefined}
          onClick={() => setShowEventLog(true)}
        />
        <NavBtn icon="📜" label="任务" badge={newQuests > 0 ? newQuests : undefined} onClick={() => setShowQuests(true)} />
        <NavBtn
          icon="🏆"
          label="赛季"
          badge={claimableMilestones > 0 ? claimableMilestones : undefined}
          onClick={() => setShowSeason(true)}
        />
        <NavBtn icon="✨" label="商城" onClick={() => setShowShop(true)} />
        <NavBtn icon="⚙️" label="设置" onClick={() => setShowSettings(true)} />
      </nav>

      {/* 新手引导 */}
      <TutorialGuide />

      {/* 赛季结算 */}
      <SeasonEndOverlay />

      {/* 浮层 */}
      <BuildQueue />
      <CosmeticApplier />
      <ToastContainer />
      <BattleReportLayer />
      <PvpReportLayer />
      <OfflineReportLayer />
      <Suspense fallback={null}>
        {showBuildings && <BuildingPanel onClose={() => setShowBuildings(false)} />}
        {showShop && <CosmeticShop onClose={() => setShowShop(false)} />}
        {showBarracks && <BarracksPanel onClose={() => setShowBarracks(false)} />}
        {showMap && <MapPanel onClose={() => setShowMap(false)} />}
        {showQuests && <QuestPanel onClose={() => setShowQuests(false)} />}
        {showSeason && <SeasonPanel onClose={() => setShowSeason(false)} />}
        {showLeaderboard && <LeaderboardPanel onClose={() => setShowLeaderboard(false)} />}
        {showEventLog && <EventLogPanel onClose={() => setShowEventLog(false)} />}
        {showMarket && <MarketPanel onClose={() => setShowMarket(false)} />}
        {showAlliance && <AlliancePanel onClose={() => setShowAlliance(false)} />}
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} onReset={handleReset} onLogout={handleLogout} />}
      </Suspense>

      {/* 部落选择浮层 */}
      {showTribeSelect && (
        <TribeSelectOverlay
          onSelect={(t) => {
            setTribe(t);
            const pn = useGame.getState().village.playerName;
            localStorage.setItem(`${TRIBE_SELECTED_KEY}-${pn}`, t);
            setShowTribeSelect(false);
          }}
        />
      )}

      <div className="h-16" />
    </div>
  );
}

// 部落选择浮层：炎帝 / 黄帝 / 蚩尤
function TribeSelectOverlay({ onSelect }: { onSelect: (t: TribeType) => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 overflow-y-auto">
      <div className="card-std border-2 border-pop rounded-2xl p-5 max-w-2xl w-full anim-battle-card" style={{ boxShadow: '0 0 40px rgba(201,136,42,0.3)' }}>
        <h2 className="text-2xl font-bold tracking-wide text-center text-pop mb-1">🏯 涿鹿风云</h2>
        <p className="text-center text-text-secondary text-sm mb-1">上古洪荒，三大部落争霸天下</p>
        <p className="text-center text-text-muted text-xs mb-4">选择你的部落，开启洪荒征程</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TRIBE_ORDER.map((id) => {
            const t = TRIBE_CONFIGS[id];
            return (
              <button
                key={id}
                onClick={() => onSelect(id)}
                className={`
                  text-left border-2 rounded-xl p-4 transition-all hover:scale-[1.03] active:scale-95
                  bg-gradient-to-br ${t.bgColor} border-border hover:border-pop
                `}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-3xl">{t.emoji}</span>
                  <div>
                    <div className="font-bold text-text-primary">{t.name}</div>
                    <div className="text-[10px] text-text-muted">{t.title}</div>
                  </div>
                </div>
                <p className="text-[11px] text-text-secondary mb-2 leading-relaxed">{t.lore}</p>
                <div className="space-y-1">
                  {t.bonuses.map((b, i) => (
                    <div key={i} className="text-[11px] text-emerald-700 font-medium">{b}</div>
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-text-muted">兵种：{t.unitEmoji} {t.unitName}</div>
              </button>
            );
          })}
        </div>

        <p className="text-center text-[11px] text-text-muted mt-4">
          提示：部落一旦选择不可更改，请慎重决定
        </p>
      </div>
    </div>
  );
}

const TabBtn = memo(function TabBtn({ active, onClick, icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 py-2.5 flex items-center justify-center gap-1.5 transition-all duration-200 relative
        ${active ? 'text-pop' : 'text-text-muted hover:text-text-secondary'}
      `}
    >
      <span className="text-base">{icon}</span>
      <span className="text-sm font-semibold tracking-wide">{label}</span>
      {active && (
        <span className="absolute bottom-0 inset-x-2 h-0.5 bg-pop rounded-full anim-tab-slide" />
      )}
    </button>
  );
});

const NavBtn = memo(function NavBtn({ icon, label, badge, disabled, onClick }: {
  icon: string;
  label: string;
  badge?: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center transition-all duration-200 relative px-2 py-1 rounded-lg
        ${disabled ? 'text-text-muted/40 cursor-not-allowed'
          : 'text-text-secondary hover:text-pop hover:bg-bg-card'}`}
    >
      <span className="text-xl transition-transform group-hover:scale-110">{icon}</span>
      <span className="text-[10px] mt-0.5">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-0 right-0.5 bg-red-500 text-white text-[9px] rounded-full min-w-[14px] h-3.5 px-1 flex items-center justify-center anim-pulse shadow-sm">
          {badge}
        </span>
      )}
    </button>
  );
});

export default App;

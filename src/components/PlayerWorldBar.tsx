import { useEffect, useState } from 'react';
import { TRIBE_CONFIGS } from '../game/tribes';
import { getCosmetic } from '../game/cosmetics';
import { useGame } from '../store/gameStore';
import { isMuted, setMuted } from '../game/sound';
import { computeUpkeep } from '../game/units';
import { isShielded, shieldRemainingMs } from '../game/shield';
import { ShieldModal } from './ShieldModal';

// 玩家+世界信息栏
// 玩家信息：玩家名（可改）、村庄名、赛季积分、当前排名（模拟）
// 世界信息：赛季剩余时间、在线玩家数（模拟）、当前世界事件

function formatRemaining(ms: number): string {
  if (ms <= 0) return '已结束';
  const days = Math.floor(ms / (24 * 3600 * 1000));
  const hours = Math.floor((ms % (24 * 3600 * 1000)) / (3600 * 1000));
  const mins = Math.floor((ms % (3600 * 1000)) / (60 * 1000));
  if (days > 0) return `${days}天${hours}时`;
  if (hours > 0) return `${hours}时${mins}分`;
  return `${mins}分`;
}

export function PlayerWorldBar() {
  const season = useGame((s) => s.village.season);
  const buildings = useGame((s) => s.village.buildings);
  const units = useGame((s) => s.village.units);
  const tribe = useGame((s) => s.village.tribe);
  const equippedCosmetics = useGame((s) => s.village.equippedCosmetics);
  const shield = useGame((s) => s.village.shield);
  const activateShield = useGame((s) => s.activateShield);
  const jade = useGame((s) => s.village.jade);
  const storePlayerName = useGame((s) => s.village.playerName);
  const [showShieldModal, setShowShieldModal] = useState(false);
  const [playerName, setPlayerName] = useState('酋长');
  const [villageName, setVillageName] = useState('部落驻地');
  const [editing, setEditing] = useState<'player' | 'village' | null>(null);
  const [tempName, setTempName] = useState('');
  const [onlinePlayers, setOnlinePlayers] = useState(128);
  const [muted, setMutedState] = useState(isMuted());

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  // 从 store 加载玩家名
  useEffect(() => {
    if (storePlayerName) setPlayerName(storePlayerName);
  }, [storePlayerName]);

  // 模拟在线玩家数浮动（每 30 秒变化 ±5）
  useEffect(() => {
    const id = setInterval(() => {
      setOnlinePlayers((prev) => Math.max(80, Math.min(300, prev + Math.floor(Math.random() * 11) - 5)));
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // 计算村庄等级（建筑总等级和）
  const villageLevel = Object.values(buildings).reduce<number>((sum, lv) => sum + (lv || 0), 0);

  // 模拟排名（积分越高排名越靠前）
  const rank = Math.max(1, 200 - Math.floor(season.points / 10));

  const handleSave = () => {
    if (editing === 'player') {
      setPlayerName(tempName || '酋长');
    } else if (editing === 'village') {
      setVillageName(tempName || '部落驻地');
    }
    setEditing(null);
  };

  const tribeCfg = TRIBE_CONFIGS[tribe];
  const totalArmy = Object.values(units).reduce((s, n) => s + (n || 0), 0);
  const upkeep = computeUpkeep(units);
  const banner = getCosmetic(equippedCosmetics?.banner);
  const frame = getCosmetic(equippedCosmetics?.frame);

  // 边框样式映射
  const frameStyle: Record<string, string> = {
    frame_default: 'border-2 border-border',
    frame_bronze: 'border-2 border-amber-700 shadow-[0_0_6px_rgba(180,83,9,0.4)]',
    frame_jade: 'border-2 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
    frame_gold: 'border-2 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]',
  };
  const frameClass = frame ? (frameStyle[frame.id] || frameStyle.frame_default) : frameStyle.frame_default;

  const endsIn = season.endsAt - Date.now();

  // 护盾状态
  const shielded = isShielded({ shield });
  const shieldMs = shieldRemainingMs({ shield });
  const shieldLabel = shield?.type === 'newbie' ? '新手保护' : shield?.type === 'active' ? '护盾' : '';

  return (
    <div className="bg-bg-secondary border-b border-border">
      <div className="max-w-2xl mx-auto px-3 py-2">
        {/* 玩家信息行 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={`w-10 h-10 rounded-full bg-pop text-white flex items-center justify-center text-lg font-bold shrink-0 ${frameClass}`}>
              {playerName.charAt(0)}
            </div>
            {/* 装备的部落旗帜 */}
            {banner && (
              <span className="text-2xl shrink-0" title={banner.name}>{banner.emoji}</span>
            )}
            <div className="min-w-0 flex-1">
              {editing === 'player' ? (
                <input
                  autoFocus
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={handleSave}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  className="w-full text-sm font-semibold bg-bg-card border border-pop rounded px-2 py-0.5 text-text-primary"
                  placeholder="玩家名"
                  maxLength={12}
                />
              ) : (
                <button
                  onClick={() => { setEditing('player'); setTempName(playerName); }}
                  className="text-sm font-semibold text-text-primary hover:text-pop truncate"
                >
                  {playerName} <span className="text-[10px] opacity-60">✏</span>
                </button>
              )}
              <div className="text-[10px] text-text-muted">
                {tribeCfg.emoji} {tribeCfg.name} · 部落 Lv{villageLevel} · 排名 #{rank}
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xs text-text-secondary">
              🏆 <span className="font-bold text-pop">{season.points}</span> 积分
            </div>
            <div className="text-[10px] text-text-muted">
              第 {season.number} 赛季
            </div>
          </div>
        </div>

        {/* 村庄名行 */}
        <div className="mt-1.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-text-muted">⛰️</span>
            {editing === 'village' ? (
              <input
                autoFocus
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="flex-1 text-xs bg-bg-card border border-pop rounded px-2 py-0.5 text-text-primary"
                placeholder="部落驻地"
                maxLength={16}
              />
            ) : (
              <button
                onClick={() => { setEditing('village'); setTempName(villageName); }}
                className="text-text-secondary hover:text-pop truncate"
              >
                {villageName} <span className="text-[10px] opacity-60">✏</span>
              </button>
            )}
            {totalArmy > 0 && (
              <span className="text-text-muted">· 🏹 {totalArmy} 兵力 · 🌾 {upkeep}/h</span>
            )}
          </div>
        </div>

        {/* 世界信息行 */}
        <div className="mt-2 pt-1.5 border-t border-amber-200 flex items-center justify-between text-[10px] text-text-muted">
          <div className="flex items-center gap-2">
            <span>🌍 在线 <span className="text-emerald-700 font-semibold">{onlinePlayers}</span></span>
            <span className="opacity-50">|</span>
            <span>⏰ 赛季剩余 <span className="text-pop font-semibold">{formatRemaining(endsIn)}</span></span>
            {/* 护盾状态 */}
            {shielded && (
              <>
                <span className="opacity-50">|</span>
                <button
                  onClick={() => setShowShieldModal(true)}
                  className="text-sky-600 font-semibold hover:text-sky-700"
                  title="护盾保护中，点击管理"
                >
                  🛡️ {shieldLabel} {formatRemaining(shieldMs)}
                </button>
              </>
            )}
            {/* 无护盾时显示激活入口 */}
            {!shielded && jade >= 10 && (
              <>
                <span className="opacity-50">|</span>
                <button
                  onClick={() => setShowShieldModal(true)}
                  className="text-text-muted hover:text-sky-600"
                  title="激活护盾"
                >
                  🛡️ 激活
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleMute}
              className="hover:text-pop transition-colors"
              title={muted ? '开启音效' : '关闭音效'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full anim-pulse" />
            <span>世界活跃</span>
          </div>
        </div>

        {/* 护盾管理弹窗 */}
        {showShieldModal && (
          <ShieldModal
            shield={shield}
            jade={jade}
            onActivate={(hours, cost) => { activateShield(hours, cost); }}
            onClose={() => setShowShieldModal(false)}
          />
        )}
      </div>
    </div>
  );
}

export default PlayerWorldBar;

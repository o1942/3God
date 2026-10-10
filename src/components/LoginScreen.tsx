import { useState, useEffect } from 'react';
import { useGame } from '../store/gameStore';
import { playSound } from '../game/sound';
import { isSupabaseConfigured } from '../lib/supabase';

// 登录界面：玩家名 + 密码，支持注册新玩家和已有玩家登录
export function LoginScreen() {
  const login = useGame((s) => s.login);
  const register = useGame((s) => s.register);
  const registeredPlayers = useGame((s) => s.registeredPlayers);
  const onlinePlayers = useGame((s) => s.onlinePlayers);
  const isLoggingIn = useGame((s) => s.isLoggingIn);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [showExisting, setShowExisting] = useState(false);

  // 上次登录的玩家名预填
  useEffect(() => {
    const last = localStorage.getItem('travian-mvp-last-player');
    if (last) setName(last);
  }, []);

  const handleSubmit = async () => {
    const n = name.trim();
    if (!n) { playSound('error'); setError('请输入玩家名'); return; }
    if (!password) { playSound('error'); setError('请输入密码'); return; }
    setError(null);
    playSound('click');
    const err = mode === 'register'
      ? await register(n, password)
      : await login(n, password);
    if (err) {
      setError(err);
      playSound('error');
    }
  };

  const handleQuickLogin = async (playerName: string) => {
    // 已知玩家快速登录：需输入密码（在线模式）
    setName(playerName);
    setMode('login');
    setShowExisting(false);
    setError('请输入密码后登录');
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-amber-900 via-stone-800 to-stone-900 z-[300] flex items-center justify-center p-4 overflow-y-auto">
      {/* 背景装饰 */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(201,136,42,0.3) 2px, transparent 3px), radial-gradient(circle at 75% 75%, rgba(201,136,42,0.2) 1px, transparent 2px)',
        backgroundSize: '40px 40px, 30px 30px',
      }} />

      <div className="relative card-std border-2 border-pop rounded-2xl p-6 max-w-sm w-full anim-battle-card" style={{ boxShadow: '0 0 40px rgba(201,136,42,0.4)' }}>
        {/* 标题 */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold tracking-wide text-pop mb-1">🏯 涿鹿风云</h1>
          <p className="text-text-secondary text-sm">上古洪荒，部落争霸</p>
          <p className="text-text-muted text-xs mt-1">
            {isSupabaseConfigured ? '云端存档，多端同步' : '输入你的名号，开启征程'}
          </p>
        </div>

        {/* 在线人数 */}
        {isSupabaseConfigured && onlinePlayers.length > 0 && (
          <div className="text-center mb-3 text-xs text-emerald-400">
            🌍 全服 {onlinePlayers.length} 位首领
          </div>
        )}

        {/* 已注册玩家快速选择 */}
        {registeredPlayers.length > 0 && showExisting && (
          <div className="mb-4 space-y-2 anim-fade-in">
            <div className="text-xs text-text-muted text-center">选择已有存档</div>
            {registeredPlayers.map((p) => (
              <button
                key={p}
                onClick={() => handleQuickLogin(p)}
                className="w-full flex items-center gap-2 p-3 rounded-lg border-2 border-border bg-bg-card hover:border-pop hover:bg-bg-secondary transition card-interactive"
              >
                <div className="w-9 h-9 rounded-full bg-pop text-white flex items-center justify-center font-bold text-sm">
                  {p.charAt(0)}
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-semibold text-text-primary">{p}</div>
                  <div className="text-[10px] text-text-muted">点击选择</div>
                </div>
                <span className="text-text-muted text-sm">›</span>
              </button>
            ))}
            <button
              onClick={() => setShowExisting(false)}
              className="w-full text-center text-xs text-text-muted hover:text-pop py-1"
            >
              ‹ 返回
            </button>
          </div>
        )}

        {/* 登录/注册表单 */}
        {!showExisting && (
          <div className="space-y-3">
            {/* 模式切换 */}
            <div className="flex gap-1 p-1 bg-bg-primary rounded-lg">
              <button
                onClick={() => { setMode('login'); setError(null); }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                  mode === 'login' ? 'bg-pop text-white' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                登录
              </button>
              <button
                onClick={() => { setMode('register'); setError(null); }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                  mode === 'register' ? 'bg-pop text-white' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                注册
              </button>
            </div>

            <div>
              <label className="text-xs text-text-muted mb-1 block">玩家名</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="w-full px-4 py-3 rounded-lg border-2 border-border bg-bg-card text-text-primary text-sm font-medium focus:border-pop focus:outline-none transition"
                placeholder="输入你的名号（最多12字）"
                maxLength={12}
              />
            </div>

            <div>
              <label className="text-xs text-text-muted mb-1 block">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="w-full px-4 py-3 rounded-lg border-2 border-border bg-bg-card text-text-primary text-sm font-medium focus:border-pop focus:outline-none transition"
                placeholder="至少 4 位"
                maxLength={32}
              />
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="text-xs text-red-400 text-center py-1 anim-fade-in">⚠ {error}</div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!name.trim() || !password || isLoggingIn}
              className={`
                w-full py-3 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2
                ${name.trim() && password && !isLoggingIn
                  ? 'bg-pop text-white hover:bg-pop-hover shadow-md'
                  : 'bg-bg-secondary text-text-muted cursor-not-allowed'
                }
              `}
            >
              {isLoggingIn ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  处理中...
                </>
              ) : mode === 'register' ? '创建角色' : '进入游戏'}
            </button>

            {registeredPlayers.length > 0 && (
              <button
                onClick={() => setShowExisting(true)}
                className="w-full text-center text-xs text-text-muted hover:text-pop py-1"
              >
                切换已有存档（{registeredPlayers.length}）
              </button>
            )}
          </div>
        )}

        {/* 底部提示 */}
        <p className="text-center text-[10px] text-text-muted mt-4">
          {isSupabaseConfigured
            ? '云端存档，多端数据同步'
            : '存档保存在本地浏览器，不同设备数据独立'}
        </p>
      </div>
    </div>
  );
}

export default LoginScreen;

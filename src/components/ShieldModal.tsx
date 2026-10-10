import { ACTIVE_SHIELD_OPTIONS, isShielded, shieldRemainingMs } from '../game/shield';
import type { ShieldState } from '../game/types';

type ShieldModalProps = {
  shield: ShieldState | null;
  jade: number;
  onActivate: (hours: number, jadeCost: number) => void;
  onClose: () => void;
};

function formatMs(ms: number): string {
  if (ms <= 0) return '已过期';
  const days = Math.floor(ms / (24 * 3600 * 1000));
  const hours = Math.floor((ms % (24 * 3600 * 1000)) / (3600 * 1000));
  const mins = Math.floor((ms % (3600 * 1000)) / (60 * 1000));
  if (days > 0) return `${days}天${hours}时`;
  if (hours > 0) return `${hours}时${mins}分`;
  return `${mins}分`;
}

export function ShieldModal({ shield, jade, onActivate, onClose }: ShieldModalProps) {
  const shielded = isShielded({ shield });
  const remainMs = shieldRemainingMs({ shield });
  const cooldownMs = shield?.cooldownUntil ? Math.max(0, shield.cooldownUntil - Date.now()) : 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-bg-card border border-border rounded-lg w-[90%] max-w-sm p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-text-primary">🛡️ 护盾管理</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-lg">✕</button>
        </div>

        {/* 当前护盾状态 */}
        <div className="bg-bg-secondary rounded-lg p-3 mb-3">
          <div className="text-xs text-text-muted mb-1">当前状态</div>
          {shielded ? (
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🛡️</span>
                <div>
                  <div className="text-sm font-semibold text-sky-500">
                    {shield?.type === 'newbie' ? '新手保护' : '主动护盾'}
                  </div>
                  <div className="text-xs text-text-secondary">
                    剩余 <span className="font-bold text-text-primary">{formatMs(remainMs)}</span>
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-text-muted mt-2">
                {shield?.type === 'newbie'
                  ? '新手保护期内，其他玩家无法攻击你。攻击玩家将破除护盾。'
                  : '护盾生效中，其他玩家无法攻击你。攻击玩家将破除护盾。'}
              </div>
            </div>
          ) : (
            <div className="text-sm text-text-muted">
              <span className="text-2xl mr-2">⚔️</span>
              无护盾保护，可被其他玩家攻击
            </div>
          )}
        </div>

        {/* 冷却中提示 */}
        {cooldownMs > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3 text-xs text-amber-700">
            ⏳ 主动护盾冷却中，还需 {formatMs(cooldownMs)}
          </div>
        )}

        {/* 主动护盾激活 */}
        {!shielded && cooldownMs <= 0 && (
          <>
            <div className="text-xs text-text-muted mb-2">消耗纹玉激活护盾（反P2W，不可购买）</div>
            <div className="space-y-2">
              {ACTIVE_SHIELD_OPTIONS.map((opt) => {
                const canAfford = jade >= opt.jade;
                return (
                  <button
                    key={opt.hours}
                    disabled={!canAfford}
                    onClick={() => { onActivate(opt.hours, opt.jade); onClose(); }}
                    className={`
                      w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all
                      ${canAfford
                        ? 'border-sky-300 bg-sky-50 hover:bg-sky-100 active:scale-95'
                        : 'border-border bg-bg-secondary opacity-50 cursor-not-allowed'}
                    `}
                  >
                    <div className="text-left">
                      <div className="text-sm font-semibold text-text-primary">🛡️ {opt.label}</div>
                      <div className="text-[10px] text-text-muted">激活后 24h 冷却</div>
                    </div>
                    <div className={`text-sm font-bold ${canAfford ? 'text-sky-600' : 'text-text-muted'}`}>
                      💎 {opt.jade}
                    </div>
                  </button>
                );
              })}
            </div>
            {jade < 10 && (
              <div className="text-[10px] text-text-muted mt-2 text-center">
                纹玉不足，通过任务/赛季获取
              </div>
            )}
          </>
        )}

        {/* 新手保护期不能激活 */}
        {shielded && shield?.type === 'newbie' && (
          <div className="text-xs text-text-muted text-center py-2">
            新手保护期内无需额外护盾
          </div>
        )}

        {/* 说明 */}
        <div className="mt-3 pt-3 border-t border-border text-[10px] text-text-muted leading-relaxed">
          <div>• 新手保护 7 天，期间不可被攻击</div>
          <div>• 主动攻击其他玩家将立即破除护盾</div>
          <div>• 护盾仅防止被攻击，不影响出征妖兽据点</div>
        </div>
      </div>
    </div>
  );
}

export default ShieldModal;

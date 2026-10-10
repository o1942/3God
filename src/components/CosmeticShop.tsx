import { useState } from 'react';
import { COSMETICS, type CosmeticCategory } from '../game/cosmetics';
import { useGame } from '../store/gameStore';

// 外观商城面板（反P2W：仅出售纯外观，不影响任何数值）
export function CosmeticShop({ onClose }: { onClose: () => void }) {
  const village = useGame((s) => s.village);
  const purchaseCosmetic = useGame((s) => s.purchaseCosmetic);
  const equipCosmetic = useGame((s) => s.equipCosmetic);

  const [tab, setTab] = useState<CosmeticCategory>('banner');

  const categories: { id: CosmeticCategory; name: string; emoji: string }[] = [
    { id: 'banner', name: '旗帜', emoji: '🚩' },
    { id: 'theme', name: '主题', emoji: '🎨' },
    { id: 'frame', name: '边框', emoji: '🖼️' },
  ];

  const items = COSMETICS.filter((c) => c.category === tab);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-bg-card border-t sm:border border-border sm:rounded-2xl rounded-t-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto anim-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-bg-card border-b border-border px-4 py-3 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-text-primary">✨ 外观商城</h2>
              <p className="text-xs text-text-muted">纯外观 · 不影响战力 · 反P2W</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-emerald-600">💎 {village.jade}</span>
              <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl px-1">×</button>
            </div>
          </div>
          {/* 分类切换 */}
          <div className="flex gap-1 mt-3">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setTab(c.id)}
                className={`flex-1 py-1.5 text-sm rounded-lg transition
                  ${tab === c.id ? 'bg-pop text-white' : 'bg-bg-secondary text-text-muted hover:bg-border'}`}
              >
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 grid grid-cols-2 gap-3">
          {items.map((item) => {
            const owned = village.cosmetics.includes(item.id);
            const equipped = village.equippedCosmetics[item.category] === item.id;
            const canAfford = village.jade >= item.price;
            return (
              <div
                key={item.id}
                className={`border-2 rounded-xl p-3 transition-all
                  ${equipped ? 'border-pop bg-pop/10' : 'border-border bg-bg-secondary'}
                  ${owned && !equipped ? 'border-emerald-300' : ''}`}
              >
                <div className="text-center text-4xl mb-1">{item.emoji}</div>
                <h3 className="text-sm font-semibold text-text-primary text-center">{item.name}</h3>
                <p className="text-[10px] text-text-muted text-center mt-0.5 leading-tight h-7 overflow-hidden">{item.desc}</p>
                <div className="mt-2">
                  {equipped ? (
                    <div className="w-full text-center text-xs py-1.5 bg-pop/20 text-pop rounded font-semibold">已装备</div>
                  ) : owned ? (
                    <button
                      onClick={() => equipCosmetic(item.id)}
                      className="w-full text-xs py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                    >
                      装备
                    </button>
                  ) : (
                    <button
                      onClick={() => purchaseCosmetic(item.id)}
                      disabled={!canAfford}
                      className={`w-full text-xs py-1.5 rounded font-semibold transition
                        ${canAfford ? 'bg-pop text-white hover:bg-pop-hover' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                    >
                      💎 {item.price}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 text-[11px] text-text-muted text-center border-t border-border">
          💡 纹玉通过任务、赛季里程碑获得，无法充值购买<br />
          所有外观仅改变视觉效果，不影响任何数值
        </div>
      </div>
    </div>
  );
}

export default CosmeticShop;

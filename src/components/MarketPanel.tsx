// 集市面板：挂单列表 + 新建挂单 + 我的挂单
import { useEffect, useMemo, useState } from 'react';
import { useMarketStore } from '../store/marketStore';
import { useGame } from '../store/gameStore';
import {
  ALL_RESOURCES, RESOURCE_LABEL, RESOURCE_EMOJI, calcFillPrice, orderStatusText,
  type Resource,
} from '../game/market';

type Tab = 'market' | 'create' | 'mine';

export function MarketPanel({ onClose }: { onClose: () => void }) {
  const { orders, myOrders, loading, loadOrders, loadMyOrders, createOrder, fillOrder, cancelOrder } =
    useMarketStore();
  const marketLv = useGame((s) => s.village.buildings.market || 0);
  const [tab, setTab] = useState<Tab>('market');

  useEffect(() => {
    loadOrders();
    loadMyOrders();
  }, [loadOrders, loadMyOrders]);

  const handleFill = async (orderId: string, fillGive: number) => {
    await fillOrder(orderId, fillGive);
  };
  const handleCancel = async (orderId: string) => {
    if (!confirm('确定取消该挂单？剩余资源将退还。')) return;
    await cancelOrder(orderId);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-bg-card border-t sm:border border-border sm:rounded-2xl rounded-t-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto anim-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="sticky top-0 bg-bg-card border-b border-border px-4 py-3 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-text-primary">🏪 集市挂单</h2>
              <p className="text-xs text-text-muted">玩家间资源互换 · 集市 Lv.{marketLv}</p>
            </div>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl px-1">×</button>
          </div>
          {/* Tab */}
          <div className="flex gap-1 mt-3">
            {([
              ['market', '全服挂单'],
              ['create', '我要挂单'],
              ['mine', '我的挂单'],
            ] as [Tab, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-3 py-1.5 text-sm rounded-t transition ${
                  tab === k ? 'bg-bg-secondary text-pop font-semibold' : 'text-text-muted hover:text-text-secondary'
                }`}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* 内容 */}
        <div className="p-3">
          {marketLv < 1 && (
            <div className="text-center text-text-muted text-sm py-8">需先建造集市才能使用挂单功能</div>
          )}
          {marketLv >= 1 && tab === 'market' && (
            <OrderList orders={orders} loading={loading} onFill={handleFill} />
          )}
          {marketLv >= 1 && tab === 'create' && (
            <CreateOrderForm onCreate={async (g, ga, t, ta) => {
              const ok = await createOrder(g, ga, t, ta);
              if (ok) setTab('mine');
            }} />
          )}
          {marketLv >= 1 && tab === 'mine' && (
            <MyOrdersList orders={myOrders} onCancel={handleCancel} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 全服挂单列表 ---------------- */
function OrderList({ orders, loading, onFill }: {
  orders: ReturnType<typeof useMarketStore.getState>['orders'];
  loading: boolean;
  onFill: (id: string, give: number) => void;
}) {
  if (loading && orders.length === 0) {
    return <div className="text-text-muted text-sm py-8 text-center">加载中...</div>;
  }
  if (orders.length === 0) {
    return <div className="text-text-muted text-sm py-8 text-center">暂无挂单，去「我要挂单」发布吧</div>;
  }
  return (
    <div className="space-y-2">
      {orders.map((o) => (
        <OrderCard key={o.id} order={o} onFill={onFill} />
      ))}
    </div>
  );
}

function OrderCard({ order, onFill }: {
  order: ReturnType<typeof useMarketStore.getState>['orders'][number];
  onFill: (id: string, give: number) => void;
}) {
  const [fill, setFill] = useState<number>(order.remaining_give);
  const price = useMemo(() => calcFillPrice(order, fill), [order, fill]);

  return (
    <div className="card-std p-3">
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="font-semibold text-text-primary">{order.seller_name}</span>
        <span className="text-xs text-text-muted">单价 {order.rate} {RESOURCE_LABEL[order.take_resource]}/{RESOURCE_LABEL[order.give_resource]}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <span>付出 <b>{order.give_amount}</b> {RESOURCE_EMOJI[order.give_resource]}{RESOURCE_LABEL[order.give_resource]}</span>
        <span className="text-text-muted">→</span>
        <span>收 <b>{order.take_amount}</b> {RESOURCE_EMOJI[order.take_resource]}{RESOURCE_LABEL[order.take_resource]}</span>
      </div>
      <div className="text-xs text-text-muted mt-1">
        剩余可吃：{order.remaining_give} {RESOURCE_LABEL[order.give_resource]}
      </div>

      {!order.is_mine && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <input
            type="number" min={1} max={order.remaining_give} value={fill}
            onChange={(e) => setFill(Math.max(1, Math.min(order.remaining_give, Number(e.target.value) || 0)))}
            className="w-24 px-2 py-1 border border-border rounded text-sm bg-bg-primary"
          />
          <span className="text-xs text-text-secondary">需付 {price} {RESOURCE_LABEL[order.take_resource]}</span>
          <button
            onClick={() => onFill(order.id, fill)}
            className="ml-auto px-3 py-1 bg-pop text-white rounded text-sm hover:opacity-90"
          >吃单</button>
        </div>
      )}
      {order.is_mine && (
        <div className="mt-2 text-xs text-text-muted">（这是我的挂单，可在「我的挂单」中取消）</div>
      )}
    </div>
  );
}

/* ---------------- 新建挂单 ---------------- */
function CreateOrderForm({ onCreate }: {
  onCreate: (g: string, ga: number, t: string, ta: number) => void;
}) {
  const [giveRes, setGiveRes] = useState<Resource>('wood');
  const [giveAmt, setGiveAmt] = useState<number>(100);
  const [takeRes, setTakeRes] = useState<Resource>('clay');
  const [takeAmt, setTakeAmt] = useState<number>(50);

  const canSubmit = giveAmt > 0 && takeAmt > 0 && giveRes !== takeRes && giveAmt <= 16000 && takeAmt <= 16000;

  return (
    <div className="card-std p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <ResourceField label="我付出" res={giveRes} setRes={setGiveRes} amt={giveAmt} setAmt={setGiveAmt} />
        <ResourceField label="我收取" res={takeRes} setRes={setTakeRes} amt={takeAmt} setAmt={setTakeAmt} />
      </div>
      {giveRes === takeRes && (
        <div className="text-xs text-red-600">付出与收取不能是同种资源</div>
      )}
      <div className="text-xs text-text-muted">
        单价：{(takeAmt / giveAmt).toFixed(4)} {RESOURCE_LABEL[takeRes]} / {RESOURCE_LABEL[giveRes]} · 单笔上限 16000
      </div>
      <button
        disabled={!canSubmit}
        onClick={() => onCreate(giveRes, giveAmt, takeRes, takeAmt)}
        className={`w-full py-2 rounded text-sm font-semibold transition ${
          canSubmit ? 'bg-pop text-white hover:opacity-90' : 'bg-bg-secondary text-text-muted cursor-not-allowed'
        }`}
      >发布挂单（将冻结 {giveAmt} {RESOURCE_LABEL[giveRes]}）</button>
    </div>
  );
}

function ResourceField({ label, res, setRes, amt, setAmt }: {
  label: string; res: Resource; setRes: (r: Resource) => void;
  amt: number; setAmt: (n: number) => void;
}) {
  return (
    <div>
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <div className="flex gap-2">
        <select value={res} onChange={(e) => setRes(e.target.value as Resource)}
          className="px-2 py-1 border border-border rounded text-sm bg-bg-primary">
          {ALL_RESOURCES.map((r) => (
            <option key={r} value={r}>{RESOURCE_EMOJI[r]}{RESOURCE_LABEL[r]}</option>
          ))}
        </select>
        <input type="number" min={1} max={16000} value={amt}
          onChange={(e) => setAmt(Math.max(0, Math.min(16000, Number(e.target.value) || 0)))}
          className="flex-1 px-2 py-1 border border-border rounded text-sm bg-bg-primary" />
      </div>
    </div>
  );
}

/* ---------------- 我的挂单 ---------------- */
function MyOrdersList({ orders, onCancel }: {
  orders: ReturnType<typeof useMarketStore.getState>['myOrders'];
  onCancel: (id: string) => void;
}) {
  if (orders.length === 0) {
    return <div className="text-text-muted text-sm py-8 text-center">你还没有挂单</div>;
  }
  return (
    <div className="space-y-2">
      {orders.map((o) => (
        <div key={o.id} className="card-std p-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-semibold text-text-primary">
              {o.give_amount} {RESOURCE_EMOJI[o.give_resource]}{RESOURCE_LABEL[o.give_resource]}
              <span className="text-text-muted mx-1">→</span>
              {o.take_amount} {RESOURCE_EMOJI[o.take_resource]}{RESOURCE_LABEL[o.take_resource]}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              o.status === 'open' ? 'bg-emerald-100 text-emerald-700'
              : o.status === 'filled' ? 'bg-blue-100 text-blue-700'
              : 'bg-bg-secondary text-text-muted'
            }`}>{orderStatusText(o.status)}</span>
          </div>
          <div className="text-xs text-text-muted">已成交 {o.filled_give}/{o.give_amount}</div>
          {o.status === 'open' && (
            <button onClick={() => onCancel(o.id)}
              className="mt-2 px-3 py-1 bg-red-50 text-red-600 rounded text-sm hover:bg-red-100">
              取消并退款
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

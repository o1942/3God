// 集市挂单撮合 Zustand store
import { create } from 'zustand';
import { ensureClient, getSessionToken } from '../lib/supabase';
import { toast } from './toast';
import type { MarketOrder, MyMarketOrder } from '../game/market';

interface MarketState {
  orders: MarketOrder[];
  myOrders: MyMarketOrder[];
  loading: boolean;

  loadOrders: () => Promise<void>;
  loadMyOrders: () => Promise<void>;
  createOrder: (
    giveResource: string, giveAmount: number,
    takeResource: string, takeAmount: number,
  ) => Promise<boolean>;
  fillOrder: (orderId: string, fillGive: number) => Promise<boolean>;
  cancelOrder: (orderId: string) => Promise<boolean>;
}

// 提取 RPC 错误中的中文提示
function rpcError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.match(/message["']?\s*[:=]\s*["']([^"']+)/);
  if (m) return m[1];
  return msg || '操作失败，请稍后重试';
}

export const useMarketStore = create<MarketState>((set, get) => ({
  orders: [],
  myOrders: [],
  loading: false,

  loadOrders: async () => {
    const token = getSessionToken();
    if (!token) return;
    set({ loading: true });
    try {
      const sb = await ensureClient();
      if (!sb) return;
      const { data, error } = await sb.rpc('list_market_orders', { p_token: token });
      if (error) throw error;
      set({ orders: (data as MarketOrder[]) || [], loading: false });
    } catch (e) {
      set({ loading: false });
      toast.error(rpcError(e));
    }
  },

  loadMyOrders: async () => {
    const token = getSessionToken();
    if (!token) return;
    try {
      const sb = await ensureClient();
      if (!sb) return;
      const { data, error } = await sb.rpc('list_my_market_orders', { p_token: token });
      if (error) throw error;
      set({ myOrders: (data as MyMarketOrder[]) || [] });
    } catch (e) {
      toast.error(rpcError(e));
    }
  },

  createOrder: async (giveResource, giveAmount, takeResource, takeAmount) => {
    const token = getSessionToken();
    if (!token) { toast.warning('请先登录'); return false; }
    try {
      const sb = await ensureClient();
      if (!sb) { toast.error('后端未配置'); return false; }
      const { error } = await sb.rpc('create_market_order', {
        p_token: token,
        p_give_resource: giveResource,
        p_give_amount: giveAmount,
        p_take_resource: takeResource,
        p_take_amount: takeAmount,
      });
      if (error) throw error;
      toast.success('挂单成功，资源已冻结');
      await Promise.all([get().loadOrders(), get().loadMyOrders()]);
      return true;
    } catch (e) {
      toast.error(rpcError(e));
      return false;
    }
  },

  fillOrder: async (orderId, fillGive) => {
    const token = getSessionToken();
    if (!token) { toast.warning('请先登录'); return false; }
    try {
      const sb = await ensureClient();
      if (!sb) { toast.error('后端未配置'); return false; }
      const { error } = await sb.rpc('fill_market_order', {
        p_token: token,
        p_order_id: orderId,
        p_fill_give_amount: fillGive,
      });
      if (error) throw error;
      toast.success('吃单成功');
      await Promise.all([get().loadOrders(), get().loadMyOrders()]);
      return true;
    } catch (e) {
      toast.error(rpcError(e));
      return false;
    }
  },

  cancelOrder: async (orderId) => {
    const token = getSessionToken();
    if (!token) { toast.warning('请先登录'); return false; }
    try {
      const sb = await ensureClient();
      if (!sb) { toast.error('后端未配置'); return false; }
      const { error } = await sb.rpc('cancel_market_order', {
        p_token: token,
        p_order_id: orderId,
      });
      if (error) throw error;
      toast.success('已取消，剩余资源已退还');
      await Promise.all([get().loadOrders(), get().loadMyOrders()]);
      return true;
    } catch (e) {
      toast.error(rpcError(e));
      return false;
    }
  },
}));

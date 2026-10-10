// 集市挂单撮合：类型与工具函数
export type Resource = 'wood' | 'clay' | 'iron' | 'crop';

export const RESOURCE_LABEL: Record<Resource, string> = {
  wood: '木',
  clay: '泥',
  iron: '铁',
  crop: '粮',
};

export const RESOURCE_EMOJI: Record<Resource, string> = {
  wood: '🪵',
  clay: '🧱',
  iron: '⚙️',
  crop: '🌾',
};

export const ALL_RESOURCES: Resource[] = ['wood', 'clay', 'iron', 'crop'];

/** 挂单（list_market_orders 返回） */
export interface MarketOrder {
  id: string;
  seller_id: string;
  seller_name: string;
  give_resource: Resource;
  give_amount: number;
  take_resource: Resource;
  take_amount: number;
  filled_give: number;
  remaining_give: number;
  rate: number; // 单价：每单位 give_resource 需要多少 take_resource
  created_at: string;
  expires_at: string;
  is_mine: boolean;
}

/** 我的挂单（含历史状态） */
export interface MyMarketOrder {
  id: string;
  give_resource: Resource;
  give_amount: number;
  take_resource: Resource;
  take_amount: number;
  filled_give: number;
  status: 'open' | 'filled' | 'cancelled';
  created_at: string;
  expires_at: string;
}

/** 计算吃单 N 单位 give_resource 所需支付的 take_resource（向上取整，与后端一致） */
export function calcFillPrice(
  order: Pick<MarketOrder, 'give_amount' | 'take_amount'>,
  fillGive: number,
): number {
  if (order.give_amount <= 0) return 0;
  return Math.ceil((fillGive * order.take_amount) / order.give_amount);
}

/** 订单状态文案 */
export function orderStatusText(status: MyMarketOrder['status']): string {
  return { open: '挂单中', filled: '已成交', cancelled: '已取消' }[status];
}

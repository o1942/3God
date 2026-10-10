-- ============================================================
-- 涿鹿风云 · 集市挂单撮合系统
-- 玩家间资源互换：挂单（escrow 冻结卖家资源）→ 吃单/撮合 → 取消退款
-- 资源类型：wood(木) / clay(泥) / iron(铁) / crop(粮)
-- 依赖表：players(id, name, password_hash), sessions(token, player_id, expires_at),
--         villages(player_id, village_data jsonb)  -- village_data.resources.{wood,clay,iron,crop}
-- 与 save_village 保持一致的天花板：资源上限 16000
-- ============================================================

-- 资源类型枚举
DO $$ BEGIN
  CREATE TYPE resource_type AS ENUM ('wood', 'clay', 'iron', 'crop');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 挂单表
CREATE TABLE IF NOT EXISTS market_orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id     uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  seller_name   text NOT NULL,                              -- 冗余展示
  give_resource resource_type NOT NULL,
  give_amount   integer NOT NULL CHECK (give_amount > 0),
  take_resource resource_type NOT NULL,
  take_amount   integer NOT NULL CHECK (take_amount > 0),
  filled_give   integer NOT NULL DEFAULT 0,                 -- 已成交的 give_resource 数量
  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','filled','cancelled')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);
CREATE INDEX IF NOT EXISTS idx_market_orders_open
  ON market_orders(status, created_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_market_orders_seller ON market_orders(seller_id);
ALTER TABLE market_orders ENABLE ROW LEVEL SECURITY;
-- 只读 open 列表对所有登录玩家可见；其余操作走 SECURITY DEFINER RPC
CREATE POLICY market_orders_read_open ON market_orders FOR SELECT
  USING (status = 'open');

-- ------------------------------------------------------------
-- 工具：校验 token，返回 player_id；未登录/过期抛错
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION market_get_player(p_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pid uuid; v_exp timestamptz;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION '未登录' USING ERRCODE = '28000';
  END IF;
  SELECT s.player_id, s.expires_at INTO v_pid, v_exp
  FROM sessions s WHERE s.token = p_token;
  IF v_pid IS NULL THEN
    RAISE EXCEPTION '登录已失效，请重新登录' USING ERRCODE = '28000';
  END IF;
  IF v_exp < now() THEN
    RAISE EXCEPTION '登录已过期，请重新登录' USING ERRCODE = '28000';
  END IF;
  RETURN v_pid;
END; $$;

-- ------------------------------------------------------------
-- 工具：读写村庄资源（village_data JSONB）
--   market_get_res(pid) -> {wood,clay,iron,crop}
--   market_add_res(pid, res, delta) -> 实际变更后的值（带天花板校验）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION market_get_res(p_pid uuid, p_res text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v jsonb; vv integer;
BEGIN
  SELECT village_data INTO v FROM villages WHERE player_id = p_pid FOR UPDATE;
  IF v IS NULL THEN RAISE EXCEPTION '村庄不存在'; END IF;
  vv := COALESCE((v->'resources'->>p_res)::int, 0);
  RETURN vv;
END; $$;

CREATE OR REPLACE FUNCTION market_add_res(p_pid uuid, p_res text, p_delta integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v jsonb; cur integer; nxt integer;
BEGIN
  SELECT village_data INTO v FROM villages WHERE player_id = p_pid FOR UPDATE;
  IF v IS NULL THEN RAISE EXCEPTION '村庄不存在'; END IF;
  cur := COALESCE((v->'resources'->>p_res)::int, 0);
  nxt := cur + p_delta;
  IF nxt < 0 THEN RAISE EXCEPTION '资源不足，无法完成交易'; END IF;
  IF nxt > 16000 THEN nxt := 16000; END IF;  -- 与 save_village 天花板一致
  v := jsonb_set(v, ARRAY['resources', p_res], to_jsonb(nxt));
  UPDATE villages SET village_data = v, updated_at = now() WHERE player_id = p_pid;
  RETURN nxt;
END; $$;

-- ------------------------------------------------------------
-- 过期清理：将已过期的 open 订单置为 cancelled（不退款，退款由 cancel 负责）
-- 注：过期订单的资源已在挂单时扣除，需配合 cancel_expired 退款
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION expire_market_orders()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE market_orders SET status = 'cancelled'
  WHERE status = 'open' AND expires_at < now();
$$;

-- 过期订单自动退款给卖家（给 cron 或前端定时调用）
CREATE OR REPLACE FUNCTION refund_expired_market_orders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE o record; refunded integer := 0;
BEGIN
  FOR o IN
    SELECT id, seller_id, give_resource, give_amount, filled_give
    FROM market_orders
    WHERE status = 'open' AND expires_at < now()
    FOR UPDATE
  LOOP
    IF (o.give_amount - o.filled_give) > 0 THEN
      PERFORM market_add_res(o.seller_id, o.give_resource::text, o.give_amount - o.filled_give);
    END IF;
    UPDATE market_orders SET status = 'cancelled' WHERE id = o.id;
    refunded := refunded + 1;
  END LOOP;
  RETURN refunded;
END; $$;

-- ------------------------------------------------------------
-- create_market_order：挂单，冻结卖家 give_amount 资源
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_market_order(
  p_token text,
  p_give_resource text,
  p_give_amount integer,
  p_take_resource text,
  p_take_amount integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pid uuid; v_name text; v_cur integer; v_id uuid;
BEGIN
  v_pid := market_get_player(p_token);
  -- 资源类型与金额校验
  IF p_give_resource NOT IN ('wood','clay','iron','crop') OR
     p_take_resource NOT IN ('wood','clay','iron','crop') THEN
    RAISE EXCEPTION '资源类型无效';
  END IF;
  IF p_give_resource = p_take_resource THEN
    RAISE EXCEPTION '不能用同种资源交易';
  END IF;
  IF p_give_amount <= 0 OR p_take_amount <= 0 THEN
    RAISE EXCEPTION '交易数量必须大于 0';
  END IF;
  IF p_give_amount > 16000 OR p_take_amount > 16000 THEN
    RAISE EXCEPTION '单笔挂单数量不能超过 16000';
  END IF;
  -- 市场建筑等级校验：集市 >= 1 才可挂单（可选，由前端也做校验）
  -- 余额校验并冻结
  v_cur := market_get_res(v_pid, p_give_resource);
  IF v_cur < p_give_amount THEN
    RAISE EXCEPTION '% 资源不足，无法挂单', p_give_resource;
  END IF;
  PERFORM market_add_res(v_pid, p_give_resource, -p_give_amount);
  SELECT name INTO v_name FROM players WHERE id = v_pid;
  INSERT INTO market_orders
    (seller_id, seller_name, give_resource, give_amount, take_resource, take_amount)
  VALUES (v_pid, v_name, p_give_resource::resource_type, p_give_amount,
          p_take_resource::resource_type, p_take_amount)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- ------------------------------------------------------------
-- fill_market_order：吃单（可部分成交）
--   p_fill_give_amount：买家想吃进的 give_resource 数量
-- 按比例结算：买家支付 ceil(fill * take_amount / give_amount) 的 take_resource
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fill_market_order(
  p_token text,
  p_order_id uuid,
  p_fill_give_amount integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pid uuid; o market_orders%ROWTYPE;
  v_remaining integer; v_fill integer; v_price integer;
  v_buyer_before integer; v_seller_before integer;
BEGIN
  v_pid := market_get_player(p_token);
  IF p_fill_give_amount <= 0 THEN RAISE EXCEPTION '吃单数量必须大于 0'; END IF;

  SELECT * INTO o FROM market_orders WHERE id = p_order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION '挂单不存在'; END IF;
  IF o.status <> 'open' THEN RAISE EXCEPTION '该挂单已结束'; END IF;
  IF o.expires_at < now() THEN RAISE EXCEPTION '挂单已过期'; END IF;
  IF o.seller_id = v_pid THEN RAISE EXCEPTION '不能吃自己的挂单'; END IF;

  v_remaining := o.give_amount - o.filled_give;
  v_fill := LEAST(p_fill_give_amount, v_remaining);
  -- 按比例向上取整价格，保障卖家收益
  v_price := CEIL(v_fill::numeric * o.take_amount / o.give_amount)::integer;

  -- 买家余额校验并扣款
  v_buyer_before := market_get_res(v_pid, o.take_resource::text);
  IF v_buyer_before < v_price THEN
    RAISE EXCEPTION '% 资源不足，需要 %', o.take_resource, v_price;
  END IF;
  PERFORM market_add_res(v_pid, o.take_resource::text, -v_price);  -- 买家付款
  PERFORM market_add_res(v_pid, o.give_resource::text, v_fill);     -- 买家收货
  -- 卖家收款（give_resource 已在挂单时扣除）
  PERFORM market_add_res(o.seller_id, o.take_resource::text, v_price);

  o.filled_give := o.filled_give + v_fill;
  IF o.filled_give >= o.give_amount THEN
    UPDATE market_orders SET filled_give = o.filled_give, status = 'filled' WHERE id = o.id;
  ELSE
    UPDATE market_orders SET filled_give = o.filled_give WHERE id = o.id;
  END IF;

  RETURN jsonb_build_object(
    'order_id', o.id,
    'filled_give', v_fill,
    'price_paid', v_price,
    'status', CASE WHEN o.filled_give >= o.give_amount THEN 'filled' ELSE 'open' END
  );
END; $$;

-- ------------------------------------------------------------
-- cancel_market_order：卖家取消挂单，退还剩余冻结资源
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION cancel_market_order(p_token text, p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pid uuid; o market_orders%ROWTYPE; v_refund integer;
BEGIN
  v_pid := market_get_player(p_token);
  SELECT * INTO o FROM market_orders WHERE id = p_order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION '挂单不存在'; END IF;
  IF o.seller_id <> v_pid THEN RAISE EXCEPTION '只能取消自己的挂单'; END IF;
  IF o.status <> 'open' THEN RAISE EXCEPTION '该挂单已结束，无法取消'; END IF;
  v_refund := o.give_amount - o.filled_give;
  IF v_refund > 0 THEN
    PERFORM market_add_res(o.seller_id, o.give_resource::text, v_refund);
  END IF;
  UPDATE market_orders SET status = 'cancelled' WHERE id = o.id;
END; $$;

-- ------------------------------------------------------------
-- list_market_orders：浏览全服 open 挂单（含过期清理）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION list_market_orders(p_token text DEFAULT NULL)
RETURNS TABLE (
  id uuid, seller_id uuid, seller_name text,
  give_resource text, give_amount integer, take_resource text, take_amount integer,
  filled_give integer, remaining_give integer, rate numeric,
  created_at timestamptz, expires_at timestamptz, is_mine boolean
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pid uuid;
BEGIN
  PERFORM refund_expired_market_orders();  -- 顺便清理+退款过期单
  BEGIN v_pid := market_get_player(p_token); EXCEPTION WHEN OTHERS THEN v_pid := NULL; END;
  RETURN QUERY
  SELECT m.id, m.seller_id, m.seller_name,
         m.give_resource::text, m.give_amount, m.take_resource::text, m.take_amount,
         m.filled_give, (m.give_amount - m.filled_give) AS remaining_give,
         ROUND(m.take_amount::numeric / m.give_amount, 4) AS rate,
         m.created_at, m.expires_at,
         (v_pid IS NOT NULL AND m.seller_id = v_pid) AS is_mine
  FROM market_orders m
  WHERE m.status = 'open'
  ORDER BY m.created_at DESC;
END; $$;

-- ------------------------------------------------------------
-- list_my_market_orders：我的挂单（含历史）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION list_my_market_orders(p_token text)
RETURNS TABLE (
  id uuid, give_resource text, give_amount integer, take_resource text, take_amount integer,
  filled_give integer, status text, created_at timestamptz, expires_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pid uuid;
BEGIN
  v_pid := market_get_player(p_token);
  RETURN QUERY
  SELECT m.id, m.give_resource::text, m.give_amount, m.take_resource::text, m.take_amount,
         m.filled_give, m.status, m.created_at, m.expires_at
  FROM market_orders m
  WHERE m.seller_id = v_pid
  ORDER BY m.created_at DESC
  LIMIT 100;
END; $$;

-- 允许 anon/已认证角色执行这些 RPC（与现有 save_village 等保持一致）
GRANT EXECUTE ON FUNCTION create_market_order(text,text,integer,text,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fill_market_order(text,uuid,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_market_order(text,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION list_market_orders(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION list_my_market_orders(text) TO anon, authenticated;

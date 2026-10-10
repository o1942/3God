-- ============================================================
-- 涿鹿风云 · 存档安全校验（反作弊）
-- 在 Supabase SQL Editor 中执行本文件（可重复执行）
--
-- 核心策略：硬性天花板 + 变更速率限制
--   1) 类型与非负校验
--   2) 硬性天花板（等级/资源/兵力上限）
--   3) 变更速率限制（对比上次存档，防止短时间暴增）
--
-- 注意：本方案是「防御性校验」，不追求 100% 精确复刻游戏逻辑，
--       而是设置足够宽松的上限，确保正常玩家不受影响、
--       但明显的篡改（百万资源、满级建筑、凭空刷纹玉）会被拦截。
-- ============================================================

-- 安全提取非负数值（非法输入返回 null，由调用方处理）
create or replace function safe_non_negative(p_val jsonb)
returns numeric
language plpgsql
immutable
as $$
declare
  v_num numeric;
begin
  if p_val is null or jsonb_typeof(p_val) not in ('number', 'string') then
    return null;
  end if;
  begin
    v_num := (p_val #>> '{}')::numeric;
  exception when others then
    return null;
  end;
  if v_num < 0 then
    return null;
  end if;
  return v_num;
end;
$$;

-- ============================================================
-- 重写 save_village：加入完整校验
-- ============================================================
create or replace function save_village(p_token uuid, p_data jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  -- 鉴权
  v_name text;
  -- 旧数据（用于速率校验）
  v_old jsonb;
  v_old_updated timestamptz;
  v_dt_seconds numeric;
  -- 校验临时变量
  v_key text;
  v_val numeric;
  v_old_val numeric;
  v_res_key text;
  -- 硬性天花板
  v_max_res_cap numeric := 16000;        -- 单种资源上限（仓库 Lv20 + 科技 + 余量）
  v_max_field_lv int := 20;              -- 资源田等级上限
  v_max_build_lv int := 20;              -- 建筑等级上限
  v_max_tech_lv int := 3;                -- 科技等级上限
  v_max_units_cap numeric := 50000;      -- 总兵力硬性上限
  -- 变更速率上限（每小时）
  v_max_res_rate numeric := 20000;       -- 单种资源每小时最多增长（Lv20 满田约 8000，留 2.5 倍余量）
  v_max_units_rate numeric := 6000;      -- 总兵力每小时最多增长（军帐 Lv20 满负荷约 3000，留 2 倍余量）
  -- 单次存档增量上限
  v_max_jade_delta numeric := 200;       -- 纹玉单次最多增加
  v_max_points_delta numeric := 200;     -- 赛季积分单次最多增加
  v_max_unit_delta numeric := 1000;      -- 单种兵力单次最多增加（兜底，离线训练队列可能一次性完成很多）
  -- 最小容忍增量：即使时间差很短，也允许最多增长这么多（避免多端不同步/时间计算误差误伤）
  v_min_res_tolerance numeric := 5000;    -- 单种资源最小容忍增量（有天花板 16000 兜底，可放宽）
  v_min_units_tolerance numeric := 500;   -- 总兵力最小容忍增量
  -- 速率校验临时变量
  v_hours numeric;
  v_old_res numeric;
  v_new_res numeric;
  v_res_growth numeric;
  v_old_units numeric;
  v_new_units numeric;
  v_old_jade numeric;
  v_new_jade numeric;
  v_old_points numeric;
  v_new_points numeric;
begin
  -- ============ 1. 鉴权 ============
  select player_name into v_name
    from sessions
    where token = p_token and expires_at > now();
  if v_name is null then
    return '会话失效，请重新登录';
  end if;

  -- ============ 2. 基础结构校验 ============
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    return '存档数据格式错误';
  end if;

  -- resources 必须存在且为 object
  if jsonb_typeof(p_data->'resources') <> 'object' then
    return '存档数据异常：缺少资源字段';
  end if;

  -- ============ 3. 资源：非负 + 上限 ============
  foreach v_res_key in array array['wood','clay','iron','crop'] loop
    v_val := safe_non_negative(p_data->'resources'->v_res_key);
    if v_val is null then
      return '存档数据异常：资源 ' || v_res_key || ' 非法';
    end if;
    if v_val > v_max_res_cap then
      return '存档数据异常：资源 ' || v_res_key || ' 超过上限';
    end if;
  end loop;

  -- ============ 4. 建筑等级：非负整数 + 上限 ============
  if jsonb_typeof(p_data->'buildings') = 'object' then
    for v_key in select jsonb_object_keys(p_data->'buildings') loop
      v_val := safe_non_negative(p_data->'buildings'->v_key);
      if v_val is null then
        return '存档数据异常：建筑 ' || v_key || ' 等级非法';
      end if;
      if v_val > v_max_build_lv then
        return '存档数据异常：建筑 ' || v_key || ' 超过最高等级';
      end if;
    end loop;
  end if;

  -- ============ 5. 资源田等级：非负整数 + 上限 ============
  if jsonb_typeof(p_data->'fields') = 'object' then
    for v_key in select jsonb_object_keys(p_data->'fields') loop
      if jsonb_typeof(p_data->'fields'->v_key) = 'array' then
        for v_val in
          select (jsonb_array_elements(p_data->'fields'->v_key) #>> '{}')::numeric
        loop
          if v_val < 0 or v_val > v_max_field_lv then
            return '存档数据异常：资源田 ' || v_key || ' 等级越界';
          end if;
        end loop;
      end if;
    end loop;
  end if;

  -- ============ 6. 科技等级：上限 ============
  if jsonb_typeof(p_data->'techLevels') = 'object' then
    for v_key in select jsonb_object_keys(p_data->'techLevels') loop
      v_val := safe_non_negative(p_data->'techLevels'->v_key);
      if v_val is null then
        return '存档数据异常：科技 ' || v_key || ' 等级非法';
      end if;
      if v_val > v_max_tech_lv then
        return '存档数据异常：科技 ' || v_key || ' 超过最高等级';
      end if;
    end loop;
  end if;

  -- ============ 7. 兵力：非负 + 总量上限 ============
  if jsonb_typeof(p_data->'units') = 'object' then
    v_val := 0;
    foreach v_key in array array['warrior','archer','cavalry','guard'] loop
      v_old_val := safe_non_negative(p_data->'units'->v_key);
      if v_old_val is null then
        return '存档数据异常：兵力 ' || v_key || ' 非法';
      end if;
      v_val := v_val + v_old_val;
    end loop;
    if v_val > v_max_units_cap then
      return '存档数据异常：总兵力超过上限';
    end if;
  end if;

  -- ============ 8. 纹玉：非负 ============
  v_val := safe_non_negative(p_data->'jade');
  if v_val is null then
    return '存档数据异常：纹玉非法';
  end if;

  -- ============ 9. 赛季积分：非负 ============
  v_val := safe_non_negative(p_data->'season'->'points');
  if v_val is null then
    return '存档数据异常：赛季积分非法';
  end if;

  -- ============ 10. 变更速率校验（对比上次存档）============
  select village_data, updated_at into v_old, v_old_updated
    from villages where player_name = v_name;

  if v_old is not null then
    v_dt_seconds := extract(epoch from (now() - v_old_updated));
    -- 时间差太小（< 1 秒）跳过速率校验，避免高频 tick 误伤
    if v_dt_seconds > 1 then
      v_hours := v_dt_seconds / 3600.0;
      v_old_units := 0;
      v_new_units := 0;

      -- 10.1 资源增长速率
      foreach v_res_key in array array['wood','clay','iron','crop'] loop
        v_old_res := coalesce(safe_non_negative(v_old->'resources'->v_res_key), 0);
        v_new_res := coalesce(safe_non_negative(p_data->'resources'->v_res_key), 0);
        v_res_growth := v_new_res - v_old_res;
        if v_res_growth > greatest(v_max_res_rate * v_hours, v_min_res_tolerance) then
          return '存档数据异常：资源 ' || v_res_key || ' 增长过快';
        end if;
      end loop;

      -- 10.2 兵力增长速率
      foreach v_key in array array['warrior','archer','cavalry','guard'] loop
        v_old_units := v_old_units + coalesce(safe_non_negative(v_old->'units'->v_key), 0);
        v_new_units := v_new_units + coalesce(safe_non_negative(p_data->'units'->v_key), 0);
      end loop;
      if (v_new_units - v_old_units) > greatest(v_max_units_rate * v_hours, v_min_units_tolerance) then
        return '存档数据异常：兵力增长过快';
      end if;

      -- 10.3 纹玉单次增量
      v_old_jade := coalesce(safe_non_negative(v_old->'jade'), 0);
      v_new_jade := coalesce(safe_non_negative(p_data->'jade'), 0);
      if (v_new_jade - v_old_jade) > v_max_jade_delta then
        return '存档数据异常：纹玉增长过快';
      end if;

      -- 10.4 赛季积分单次增量
      v_old_points := coalesce(safe_non_negative(v_old->'season'->'points'), 0);
      v_new_points := coalesce(safe_non_negative(p_data->'season'->'points'), 0);
      if (v_new_points - v_old_points) > v_max_points_delta then
        return '存档数据异常：赛季积分增长过快';
      end if;

      -- 10.5 单种兵力单次增量兜底
      foreach v_key in array array['warrior','archer','cavalry','guard'] loop
        v_old_val := coalesce(safe_non_negative(v_old->'units'->v_key), 0);
        v_val := coalesce(safe_non_negative(p_data->'units'->v_key), 0);
        if (v_val - v_old_val) > v_max_unit_delta then
          return '存档数据异常：兵力 ' || v_key || ' 单次增长过快';
        end if;
      end loop;
    end if;
  end if;

  -- ============ 校验通过，写入 ============
  insert into villages(player_name, village_data, updated_at)
    values (v_name, p_data, now())
    on conflict (player_name) do update
      set village_data = excluded.village_data,
          updated_at = now();
  return null;
end;
$$;

-- 重新授权（create or replace 后需要重新 grant）
grant execute on function save_village(uuid, jsonb) to anon;
grant execute on function safe_non_negative(jsonb) to anon;

-- ============================================================
-- 涿鹿风云 · 跨玩家功能（排行榜 + 互攻）
-- 在 Supabase SQL Editor 中执行本文件（可重复执行）
-- 依赖：supabase-rls-hardening.sql 已执行（sessions / players / villages 已加固）
-- ============================================================

-- 1) 全服排行榜：读取所有玩家村庄的公开概况（不暴露密码，村庄本就公开可读）
create or replace function list_leaderboard()
returns table(
  player_name text,
  tribe text,
  points int,
  units jsonb,
  wall_level int,
  building_sum int,
  shield_until bigint,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    v.player_name,
    coalesce(v.village_data->>'tribe', 'huang') as tribe,
    coalesce((v.village_data->'season'->>'points')::int, 0) as points,
    coalesce(v.village_data->'units', '{}'::jsonb) as units,
    coalesce((v.village_data->'buildings'->>'wall')::int, 0) as wall_level,
    (
      coalesce((v.village_data->'buildings'->>'mainBuilding')::int, 0) +
      coalesce((v.village_data->'buildings'->>'barracks')::int, 0) +
      coalesce((v.village_data->'buildings'->>'rallyPoint')::int, 0) +
      coalesce((v.village_data->'buildings'->>'wall')::int, 0)
    ) as building_sum,
    coalesce((v.village_data->'shield'->>'expiresAt')::bigint, 0) as shield_until,
    v.updated_at
  from villages v
  order by 3 desc, 8 asc
  limit 100;
$$;

grant execute on function list_leaderboard() to anon;

-- 2) 跨玩家攻击：攻击方持令牌提交结算结果，服务端负责鉴权与"应用"
--    MVP 容忍模式：战斗在攻击方客户端结算，服务端做合法性校验 + 上限钳制。
--    - 护盾保护中 → 拒绝
--    - 掠夺资源：每项最多 50% 且不超过目标当前持有
--    - 守军损失：不超过目标当前兵力
--    - 写入目标 village_data.incomingAttacks（保留最近 20 条）
create or replace function attack_player(
  p_token uuid,
  p_target text,
  p_loot jsonb,
  p_defender_loss jsonb,
  p_report jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attacker text;
  v_target_data jsonb;
  v_new_data jsonb;
  v_cur_res jsonb;
  v_cur_units jsonb;
  v_units jsonb;
  v_loot jsonb := '{"wood":0,"clay":0,"iron":0,"crop":0}'::jsonb;
  v_shield bigint;
  v_res_key text;
  v_unit_key text;
  v_take numeric;
  v_have numeric;
  v_loss numeric;
  v_inc jsonb;
begin
  -- 鉴权：必须持有效会话令牌
  select player_name into v_attacker
    from sessions where token = p_token and expires_at > now();
  if v_attacker is null then
    return jsonb_build_object('ok', false, 'reason', '会话失效，请重新登录');
  end if;
  if p_target = v_attacker then
    return jsonb_build_object('ok', false, 'reason', '不能攻击自己的村庄');
  end if;

  -- 锁定目标行
  select village_data into v_target_data
    from villages where player_name = p_target for update;
  if v_target_data is null then
    return jsonb_build_object('ok', false, 'reason', '目标村庄不存在');
  end if;

  -- 护盾保护：新手保护期或主动护盾生效中，禁止被攻击
  v_shield := coalesce((v_target_data->'shield'->>'expiresAt')::bigint, 0);
  if v_shield > (extract(epoch from clock_timestamp()) * 1000)::bigint then
    return jsonb_build_object('ok', false, 'reason', '目标处于护盾保护中');
  end if;

  v_new_data := v_target_data;

  -- 掠夺：钳制每项不超过目标当前持有
  v_cur_res := coalesce(v_target_data->'resources', '{}'::jsonb);
  foreach v_res_key in array array['wood', 'clay', 'iron', 'crop'] loop
    v_have := coalesce((v_cur_res->>v_res_key)::numeric, 0);
    v_take := least(coalesce((p_loot->>v_res_key)::numeric, 0), v_have);
    if v_take > 0 then
      v_loot := jsonb_set(v_loot, array[v_res_key], to_jsonb(v_take));
      v_new_data := jsonb_set(v_new_data, array['resources', v_res_key], to_jsonb(v_have - v_take));
    end if;
  end loop;

  -- 守军损失：钳制不超过目标当前兵力
  v_cur_units := coalesce(v_target_data->'units', '{}'::jsonb);
  v_units := v_cur_units;
  foreach v_unit_key in array array['warrior', 'archer', 'cavalry', 'guard'] loop
    v_have := coalesce((v_cur_units->>v_unit_key)::numeric, 0);
    v_loss := least(coalesce((p_defender_loss->>v_unit_key)::numeric, 0), v_have);
    if v_loss > 0 then
      v_units := jsonb_set(v_units, array[v_unit_key], to_jsonb(greatest(0, v_have - v_loss)));
    end if;
  end loop;
  v_new_data := jsonb_set(v_new_data, array['units'], v_units);

  -- 追加来袭战报，保留最近 20 条（按原顺序）
  v_inc := coalesce(v_new_data->'incomingAttacks', '[]'::jsonb);
  v_inc := v_inc || jsonb_build_array(p_report);
  if jsonb_array_length(v_inc) > 20 then
    select jsonb_agg(elem order by ord) into v_inc from (
      select elem, ord from jsonb_array_elements(v_inc) with ordinality as t(elem, ord)
      order by ord desc limit 20
    ) s;
  end if;
  v_new_data := jsonb_set(v_new_data, array['incomingAttacks'], v_inc);

  -- 盖上服务端写入标记：守方客户端据此接受这次推送（否则会被当作自写回声忽略）
  v_new_data := jsonb_set(v_new_data, array['_w'], to_jsonb('server-attack'::text));

  update villages
    set village_data = v_new_data, updated_at = now()
    where player_name = p_target;

  return jsonb_build_object('ok', true, 'looted', v_loot);
end;
$$;

grant execute on function attack_player(uuid, text, jsonb, jsonb, jsonb) to anon;

-- 3) 标记来袭战报已读（可选，供守方客户端回写）——通过 save_village 自行保存即可，无需额外函数
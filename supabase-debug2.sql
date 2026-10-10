-- 调试函数2：完全镜像 save_village 的速率校验逻辑
create or replace function debug_save_village_check2(p_token uuid, p_data jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_old jsonb;
  v_old_updated timestamptz;
  v_dt_seconds numeric;
  v_old_jade numeric;
  v_new_jade numeric;
  v_max_jade_delta numeric := 200;
  v_old_points numeric;
  v_new_points numeric;
  v_max_points_delta numeric := 200;
begin
  select player_name into v_name from sessions where token = p_token and expires_at > now();
  if v_name is null then return '会话失效'; end if;

  select village_data, updated_at into v_old, v_old_updated from villages where player_name = v_name;

  if v_old is null then return 'v_old 为 null'; end if;

  v_dt_seconds := extract(epoch from (now() - v_old_updated));
  if v_dt_seconds <= 1 then return format('dt=%s <= 1, 跳过速率校验', v_dt_seconds); end if;

  -- 完全镜像 save_village 的逻辑
  v_old_jade := coalesce(safe_non_negative(v_old->'jade'), 0);
  v_new_jade := coalesce(safe_non_negative(p_data->'jade'), 0);

  v_old_points := coalesce(safe_non_negative(v_old->'season'->'points'), 0);
  v_new_points := coalesce(safe_non_negative(p_data->'season'->'points'), 0);

  return format(
    'dt=%s, old_jade=%s, new_jade=%s, jade_delta=%s, jade_pass=%s, old_points=%s, new_points=%s, points_delta=%s, points_pass=%s',
    v_dt_seconds,
    v_old_jade, v_new_jade, v_new_jade - v_old_jade,
    case when (v_new_jade - v_old_jade) > v_max_jade_delta then 'BLOCK' else 'PASS' end,
    v_old_points, v_new_points, v_new_points - v_old_points,
    case when (v_new_points - v_old_points) > v_max_points_delta then 'BLOCK' else 'PASS' end
  );
end;
$$;
grant execute on function debug_save_village_check2(uuid, jsonb) to anon;

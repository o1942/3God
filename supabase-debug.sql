-- 调试函数：检查 save_village 速率校验的各个变量值
create or replace function debug_save_village_check(p_token uuid, p_jade numeric)
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
begin
  select player_name into v_name from sessions where token = p_token and expires_at > now();
  if v_name is null then return '会话失效'; end if;

  select village_data, updated_at into v_old, v_old_updated from villages where player_name = v_name;

  if v_old is null then return 'v_old 为 null'; end if;

  v_dt_seconds := extract(epoch from (now() - v_old_updated));
  v_old_jade := coalesce((v_old->>'jade')::numeric, 0);
  v_new_jade := p_jade;

  return format('v_old_jade=%s, v_new_jade=%s, delta=%s, max=%s, dt=%s, pass_rate_check=%s',
    v_old_jade, v_new_jade, v_new_jade - v_old_jade, v_max_jade_delta, v_dt_seconds,
    case when (v_new_jade - v_old_jade) > v_max_jade_delta then '应拦截' else '放行' end);
end;
$$;
grant execute on function debug_save_village_check(uuid, numeric) to anon;

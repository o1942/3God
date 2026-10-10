-- ============================================================
-- 涿鹿风云 · RLS 行级权限加固
-- 在 Supabase SQL Editor 中执行本文件（可重复执行）
-- ============================================================

-- 1) 删除旧版「全开放」策略
drop policy if exists "anon read players" on players;
drop policy if exists "anon insert players" on players;
drop policy if exists "anon update players" on players;
drop policy if exists "anon read villages" on villages;
drop policy if exists "anon insert villages" on villages;
drop policy if exists "anon update villages" on villages;
drop policy if exists "anon delete villages" on villages;

-- 2) 会话令牌表
create table if not exists sessions (
  token uuid primary key default gen_random_uuid(),
  player_name text not null references players(player_name) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_player_idx on sessions(player_name);

-- 锁死 sessions / players：不创建任何策略 → anon 无法直接访问
alter table sessions enable row level security;
alter table players enable row level security;

-- 3) villages：允许公开读（供实时同步与他人村庄查看），禁止直接写
alter table villages enable row level security;
drop policy if exists "villages public read" on villages;
create policy "villages public read" on villages
  for select to anon, authenticated using (true);

-- 清理过期的旧策略残留（写操作只能走 save_village 函数）
drop policy if exists "anon write villages" on villages;

-- 4) 注册：返回 null 表示成功，返回文本表示错误信息
create or replace function register_player(p_name text, p_hash text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_name is null or length(trim(p_name)) = 0 then
    return '玩家名不能为空';
  end if;
  if exists (select 1 from players where player_name = p_name) then
    return '玩家名已存在';
  end if;
  insert into players(player_name, password_hash, created_at, last_login_at)
    values (p_name, p_hash, now(), now());
  return null;
end;
$$;

-- 5) 登录：校验密码，发放 30 天会话令牌
create or replace function login_player(p_name text, p_hash text)
returns table(err text, token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_token uuid;
begin
  select password_hash into v_hash from players where player_name = p_name;
  if v_hash is null then
    return query select '玩家不存在，请先注册'::text, null::uuid;
    return;
  end if;
  if v_hash <> p_hash then
    return query select '密码错误'::text, null::uuid;
    return;
  end if;
  update players set last_login_at = now() where player_name = p_name;
  insert into sessions(player_name, expires_at)
    values (p_name, now() + interval '30 days')
    returning sessions.token into v_token;
  return query select null::text, v_token;
end;
$$;

-- 6) 保存村庄：必须持有效令牌，且只能写自己那一行
create or replace function save_village(p_token uuid, p_data jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select player_name into v_name
    from sessions
    where token = p_token and expires_at > now();
  if v_name is null then
    return '会话失效，请重新登录';
  end if;
  insert into villages(player_name, village_data, updated_at)
    values (v_name, p_data, now())
    on conflict (player_name) do update
      set village_data = excluded.village_data,
          updated_at = now();
  return null;
end;
$$;

-- 7) 全服玩家名列表（公开信息）
create or replace function list_players()
returns setof text
language sql
security definer
set search_path = public
as $$
  select player_name from players order by created_at;
$$;

-- 8) 仅授权 anon 调用这些函数（表的直接访问已被 RLS 拒绝）
grant execute on function register_player(text, text) to anon;
grant execute on function login_player(text, text) to anon;
grant execute on function save_village(uuid, jsonb) to anon;
grant execute on function list_players() to anon;
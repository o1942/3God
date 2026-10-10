-- ============================================================
-- 涿鹿风云 · Supabase Schema
-- 在 Supabase 项目 SQL Editor 中执行此文件
-- ============================================================

-- 玩家账号表
create table if not exists players (
  player_name text primary key,
  password_hash text not null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

-- 村庄存档表（每个玩家一份 JSONB 存档）
create table if not exists villages (
  player_name text primary key references players(player_name) on delete cascade,
  village_data jsonb not null,
  updated_at timestamptz not null default now()
);

-- 启用 Row Level Security
alter table players enable row level security;
alter table villages enable row level security;

-- MVP 阶段：允许匿名读写（anon key 即为客户端 key）
-- 生产环境应改为按 auth.uid() 或 player_name 做行级授权
create policy "anon read players" on players for select to anon using (true);
create policy "anon insert players" on players for insert to anon with check (true);
create policy "anon update players" on players for update to anon using (true);
create policy "anon read villages" on villages for select to anon using (true);
create policy "anon insert villages" on villages for insert to anon with check (true);
create policy "anon update villages" on villages for update to anon using (true);
create policy "anon delete villages" on villages for delete to anon using (true);

-- 启用 Realtime 订阅（村庄表）
alter table villages replica identity full;
alter publication supabase_realtime add table villages;

-- updated_at 自动更新触发器
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger villages_update_at
  before update on villages
  for each row execute function update_updated_at();

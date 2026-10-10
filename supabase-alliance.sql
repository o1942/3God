-- ============================================================
-- 涿鹿风云 · 联盟系统
-- 创建/加入/退出联盟、邀请、踢人、联盟聊天、联盟战力榜
-- 依赖：players(id, name), sessions(token, player_id, expires_at),
--       villages(player_id, village_data jsonb)  -- village_data.power 作为个人战力
-- ============================================================

-- 联盟表
CREATE TABLE IF NOT EXISTS alliances (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL UNIQUE,
  tag          text NOT NULL UNIQUE CHECK (char_length(tag) BETWEEN 2 AND 6),
  leader_id    uuid NOT NULL REFERENCES players(id),
  description  text NOT NULL DEFAULT '',
  member_count integer NOT NULL DEFAULT 1,
  power        integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alliances_power ON alliances(power DESC);

-- 联盟成员
CREATE TABLE IF NOT EXISTS alliance_members (
  alliance_id uuid NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  player_id   uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member' CHECK (role IN ('leader','officer','member')),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alliance_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_alliance_members_player ON alliance_members(player_id);

-- 联盟邀请
CREATE TABLE IF NOT EXISTS alliance_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id uuid NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  player_id   uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,  -- 被邀请人
  invited_by  uuid NOT NULL REFERENCES players(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alliance_id, player_id)
);

-- 联盟聊天
CREATE TABLE IF NOT EXISTS alliance_chat (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id uuid NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  player_id   uuid NOT NULL REFERENCES players(id),
  player_name text NOT NULL,
  message     text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alliance_chat_time ON alliance_chat(alliance_id, created_at DESC);

ALTER TABLE alliances ENABLE ROW LEVEL SECURITY;
ALTER TABLE alliance_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE alliance_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE alliance_chat ENABLE ROW LEVEL SECURITY;
-- 所有读写均通过 SECURITY DEFINER RPC，RLS 默认拒绝直连
CREATE POLICY deny_direct ON alliances FOR ALL USING (false);
CREATE POLICY deny_direct_members ON alliance_members FOR ALL USING (false);
CREATE POLICY deny_direct_invites ON alliance_invites FOR ALL USING (false);
CREATE POLICY deny_direct_chat ON alliance_chat FOR ALL USING (false);

-- ------------------------------------------------------------
-- 复用集市的 token 校验（若已存在则跳过）
-- ------------------------------------------------------------
DO $outer$ BEGIN
  CREATE FUNCTION alliance_get_player(p_token text) RETURNS uuid AS $body$
  DECLARE v_pid uuid; v_exp timestamptz;
  BEGIN
    IF p_token IS NULL OR p_token = '' THEN
      RAISE EXCEPTION '未登录' USING ERRCODE = '28000';
    END IF;
    SELECT s.player_id, s.expires_at INTO v_pid, v_exp
    FROM sessions s WHERE s.token = p_token;
    IF v_pid IS NULL THEN RAISE EXCEPTION '登录已失效，请重新登录' USING ERRCODE = '28000'; END IF;
    IF v_exp < now() THEN RAISE EXCEPTION '登录已过期，请重新登录' USING ERRCODE = '28000'; END IF;
    RETURN v_pid;
  END; $body$ LANGUAGE plpgsql SECURITY DEFINER;
EXCEPTION WHEN duplicate_function THEN NULL; END $outer$;

-- ------------------------------------------------------------
-- 工具：玩家当前所在联盟 id（无则 NULL）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION my_alliance_id(p_pid uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT alliance_id FROM alliance_members WHERE player_id = p_pid LIMIT 1;
$$;

-- ------------------------------------------------------------
-- create_alliance：创建联盟（需大使馆建筑，由前端也校验）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_alliance(
  p_token text, p_name text, p_tag text, p_description text DEFAULT ''
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pid uuid; v_aid uuid; v_cur uuid;
BEGIN
  v_pid := alliance_get_player(p_token);
  IF char_length(p_name) < 2 OR char_length(p_name) > 16 THEN
    RAISE EXCEPTION '联盟名称需 2-16 个字符';
  END IF;
  IF char_length(p_tag) < 2 OR char_length(p_tag) > 6 THEN
    RAISE EXCEPTION '联盟简称需 2-6 个字符';
  END IF;
  v_cur := my_alliance_id(v_pid);
  IF v_cur IS NOT NULL THEN RAISE EXCEPTION '你已在联盟中，请先退出'; END IF;
  INSERT INTO alliances (name, tag, leader_id, description)
  VALUES (p_name, p_tag, v_pid, COALESCE(p_description, ''))
  RETURNING id INTO v_aid;
  INSERT INTO alliance_members (alliance_id, player_id, role) VALUES (v_aid, v_pid, 'leader');
  RETURN v_aid;
END; $$;

-- ------------------------------------------------------------
-- invite_to_alliance：官员/盟主邀请玩家
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION invite_to_alliance(p_token text, p_player_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pid uuid; v_aid uuid; v_role text; v_target_alliance uuid;
BEGIN
  v_pid := alliance_get_player(p_token);
  SELECT alliance_id, role INTO v_aid, v_role FROM alliance_members WHERE player_id = v_pid;
  IF v_aid IS NULL THEN RAISE EXCEPTION '你不在任何联盟中'; END IF;
  IF v_role NOT IN ('leader','officer') THEN RAISE EXCEPTION '只有盟主或官员可邀请'; END IF;
  v_target_alliance := my_alliance_id(p_player_id);
  IF v_target_alliance IS NOT NULL THEN RAISE EXCEPTION '该玩家已在联盟中'; END IF;
  INSERT INTO alliance_invites (alliance_id, player_id, invited_by)
  VALUES (v_aid, p_player_id, v_pid)
  ON CONFLICT (alliance_id, player_id) DO NOTHING;
END; $$;

-- ------------------------------------------------------------
-- join_alliance：通过邀请加入
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION join_alliance(p_token text, p_invite_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pid uuid; inv alliance_invites%ROWTYPE; v_aid uuid;
BEGIN
  v_pid := alliance_get_player(p_token);
  IF my_alliance_id(v_pid) IS NOT NULL THEN RAISE EXCEPTION '你已在联盟中'; END IF;
  SELECT * INTO inv FROM alliance_invites WHERE id = p_invite_id;
  IF inv.id IS NULL THEN RAISE EXCEPTION '邀请不存在'; END IF;
  IF inv.player_id <> v_pid THEN RAISE EXCEPTION '该邀请不是发给你的'; END IF;
  v_aid := inv.alliance_id;
  INSERT INTO alliance_members (alliance_id, player_id) VALUES (v_aid, v_pid);
  UPDATE alliances SET member_count = member_count + 1 WHERE id = v_aid;
  DELETE FROM alliance_invites WHERE id = inv.id;
  -- 清理该玩家的其它邀请
  DELETE FROM alliance_invites WHERE player_id = v_pid;
  RETURN v_aid;
END; $$;

-- ------------------------------------------------------------
-- leave_alliance：退出联盟；盟主需先转让或解散
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION leave_alliance(p_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pid uuid; v_aid uuid; v_role text; v_cnt integer;
BEGIN
  v_pid := alliance_get_player(p_token);
  SELECT alliance_id, role INTO v_aid, v_role FROM alliance_members WHERE player_id = v_pid;
  IF v_aid IS NULL THEN RAISE EXCEPTION '你不在任何联盟中'; END IF;
  SELECT count(*) INTO v_cnt FROM alliance_members WHERE alliance_id = v_aid;
  IF v_role = 'leader' AND v_cnt > 1 THEN
    RAISE EXCEPTION '盟主请先转让盟主位再退出';
  END IF;
  DELETE FROM alliance_members WHERE player_id = v_pid;
  DELETE FROM alliance_invites WHERE player_id = v_pid;
  IF v_cnt <= 1 THEN
    DELETE FROM alliances WHERE id = v_aid;  -- 联盟解散
  ELSE
    UPDATE alliances SET member_count = member_count - 1 WHERE id = v_aid;
  END IF;
END; $$;

-- ------------------------------------------------------------
-- transfer_leadership：转让盟主（盟主→另一成员）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION transfer_leadership(p_token text, p_new_leader_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pid uuid; v_aid uuid; v_role text; v_target_aid uuid;
BEGIN
  v_pid := alliance_get_player(p_token);
  SELECT alliance_id, role INTO v_aid, v_role FROM alliance_members WHERE player_id = v_pid;
  IF v_role <> 'leader' THEN RAISE EXCEPTION '只有盟主可转让'; END IF;
  SELECT alliance_id INTO v_target_aid FROM alliance_members WHERE player_id = p_new_leader_id;
  IF v_target_aid <> v_aid THEN RAISE EXCEPTION '目标不在本联盟'; END IF;
  UPDATE alliance_members SET role = 'member' WHERE player_id = v_pid AND alliance_id = v_aid;
  UPDATE alliance_members SET role = 'leader' WHERE player_id = p_new_leader_id AND alliance_id = v_aid;
  UPDATE alliances SET leader_id = p_new_leader_id WHERE id = v_aid;
END; $$;

-- ------------------------------------------------------------
-- kick_member：踢人（盟主/官员）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION kick_member(p_token text, p_player_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pid uuid; v_aid uuid; v_role text; v_target_aid uuid; v_target_role text;
BEGIN
  v_pid := alliance_get_player(p_token);
  SELECT alliance_id, role INTO v_aid, v_role FROM alliance_members WHERE player_id = v_pid;
  IF v_role NOT IN ('leader','officer') THEN RAISE EXCEPTION '无权限踢人'; END IF;
  SELECT alliance_id, role INTO v_target_aid, v_target_role FROM alliance_members WHERE player_id = p_player_id;
  IF v_target_aid <> v_aid THEN RAISE EXCEPTION '目标不在本联盟'; END IF;
  IF v_target_role = 'leader' THEN RAISE EXCEPTION '不能踢盟主'; END IF;
  IF v_role = 'officer' AND v_target_role = 'officer' THEN
    RAISE EXCEPTION '官员不能踢官员';
  END IF;
  DELETE FROM alliance_members WHERE player_id = p_player_id AND alliance_id = v_aid;
  DELETE FROM alliance_invites WHERE player_id = p_player_id;
  UPDATE alliances SET member_count = member_count - 1 WHERE id = v_aid;
END; $$;

-- ------------------------------------------------------------
-- set_member_role：设置官员/成员（盟主）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_member_role(p_token text, p_player_id uuid, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pid uuid; v_aid uuid; v_role text; v_target_aid uuid;
BEGIN
  v_pid := alliance_get_player(p_token);
  SELECT alliance_id, role INTO v_aid, v_role FROM alliance_members WHERE player_id = v_pid;
  IF v_role <> 'leader' THEN RAISE EXCEPTION '只有盟主可设置职位'; END IF;
  IF p_role NOT IN ('officer','member') THEN RAISE EXCEPTION '职位无效'; END IF;
  SELECT alliance_id INTO v_target_aid FROM alliance_members WHERE player_id = p_player_id;
  IF v_target_aid <> v_aid THEN RAISE EXCEPTION '目标不在本联盟'; END IF;
  UPDATE alliance_members SET role = p_role WHERE player_id = p_player_id AND alliance_id = v_aid;
END; $$;

-- ------------------------------------------------------------
-- refresh_alliance_power：重算联盟战力（成员 village_data.power 之和）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_alliance_power(p_aid uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_power integer;
BEGIN
  SELECT COALESCE(SUM(COALESCE((v.village_data->>'power')::int, 0)), 0) INTO v_power
  FROM alliance_members am
  JOIN villages v ON v.player_id = am.player_id
  WHERE am.alliance_id = p_aid;
  UPDATE alliances SET power = v_power WHERE id = p_aid;
  RETURN v_power;
END; $$;

-- ------------------------------------------------------------
-- list_alliances：联盟战力榜（自动重算所有联盟战力）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION list_alliances()
RETURNS TABLE (
  id uuid, name text, tag text, description text,
  leader_name text, member_count integer, power integer,
  rank bigint, created_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 全量重算战力（数据量小时可接受；后续可改定时任务）
  PERFORM refresh_alliance_power(a.id) FROM alliances a;
  RETURN QUERY
  SELECT a.id, a.name, a.tag, a.description,
         p.name AS leader_name, a.member_count, a.power,
         ROW_NUMBER() OVER (ORDER BY a.power DESC, a.created_at ASC) AS rank,
         a.created_at
  FROM alliances a
  JOIN players p ON p.id = a.leader_id
  ORDER BY a.power DESC, a.created_at ASC
  LIMIT 100;
END; $$;

-- ------------------------------------------------------------
-- get_my_alliance：我的联盟详情 + 成员列表
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_alliance(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pid uuid; v_aid uuid; v_role text; v_alliance jsonb; v_members jsonb;
BEGIN
  v_pid := alliance_get_player(p_token);
  SELECT am.alliance_id, am.role INTO v_aid, v_role FROM alliance_members am WHERE am.player_id = v_pid;
  IF v_aid IS NULL THEN RETURN NULL; END IF;
  PERFORM refresh_alliance_power(v_aid);
  SELECT jsonb_build_object(
    'id', a.id, 'name', a.name, 'tag', a.tag, 'description', a.description,
    'leader_id', a.leader_id, 'leader_name', p.name,
    'member_count', a.member_count, 'power', a.power, 'created_at', a.created_at,
    'my_role', v_role
  ) INTO v_alliance
  FROM alliances a JOIN players p ON p.id = a.leader_id WHERE a.id = v_aid;

  SELECT jsonb_agg(m ORDER BY (m->>'role'='leader') DESC, (m->>'joined_at')::timestamptz ASC) INTO v_members
  FROM (
    SELECT jsonb_build_object(
      'player_id', am.player_id, 'player_name', p.name, 'role', am.role,
      'power', COALESCE((v.village_data->>'power')::int, 0),
      'tribe', v.village_data->>'tribe', 'joined_at', am.joined_at
    ) AS m
    FROM alliance_members am
    JOIN players p ON p.id = am.player_id
    LEFT JOIN villages v ON v.player_id = am.player_id
    WHERE am.alliance_id = v_aid
  ) s;
  RETURN jsonb_build_object('alliance', v_alliance, 'members', v_members);
END; $$;

-- ------------------------------------------------------------
-- 联盟聊天
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION send_alliance_chat(p_token text, p_message text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pid uuid; v_aid uuid; v_name text; v_id uuid;
BEGIN
  v_pid := alliance_get_player(p_token);
  SELECT alliance_id INTO v_aid FROM alliance_members WHERE player_id = v_pid;
  IF v_aid IS NULL THEN RAISE EXCEPTION '你不在任何联盟中'; END IF;
  IF char_length(p_message) < 1 OR char_length(p_message) > 500 THEN
    RAISE EXCEPTION '消息长度需 1-500 字符';
  END IF;
  SELECT name INTO v_name FROM players WHERE id = v_pid;
  INSERT INTO alliance_chat (alliance_id, player_id, player_name, message)
  VALUES (v_aid, v_pid, v_name, p_message)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION list_alliance_chat(p_token text, p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid, player_id uuid, player_name text, message text, created_at timestamptz, is_mine boolean
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pid uuid; v_aid uuid;
BEGIN
  v_pid := alliance_get_player(p_token);
  SELECT am.alliance_id INTO v_aid FROM alliance_members am WHERE am.player_id = v_pid;
  IF v_aid IS NULL THEN RAISE EXCEPTION '你不在任何联盟中'; END IF;
  RETURN QUERY
  SELECT c.id, c.player_id, c.player_name, c.message, c.created_at, (c.player_id = v_pid) AS is_mine
  FROM alliance_chat c
  WHERE c.alliance_id = v_aid
  ORDER BY c.created_at DESC
  LIMIT LEAST(COALESCE(p_limit, 50), 200);
END; $$;

-- ------------------------------------------------------------
-- 邀请相关
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION list_my_invites(p_token text)
RETURNS TABLE (
  id uuid, alliance_id uuid, alliance_name text, alliance_tag text,
  invited_by_name text, created_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pid uuid;
BEGIN
  v_pid := alliance_get_player(p_token);
  RETURN QUERY
  SELECT i.id, i.alliance_id, a.name, a.tag, p.name, i.created_at
  FROM alliance_invites i
  JOIN alliances a ON a.id = i.alliance_id
  JOIN players p ON p.id = i.invited_by
  WHERE i.player_id = v_pid
  ORDER BY i.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION cancel_invite(p_token text, p_invite_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pid uuid; v_role text; v_aid uuid; inv alliance_invites%ROWTYPE;
BEGIN
  v_pid := alliance_get_player(p_token);
  SELECT alliance_id, role INTO v_aid, v_role FROM alliance_members WHERE player_id = v_pid;
  IF v_role NOT IN ('leader','officer') THEN RAISE EXCEPTION '无权限'; END IF;
  SELECT * INTO inv FROM alliance_invites WHERE id = p_invite_id;
  IF inv.alliance_id <> v_aid THEN RAISE EXCEPTION '邀请不属于本联盟'; END IF;
  DELETE FROM alliance_invites WHERE id = p_invite_id;
END; $$;

-- 权限：与现有 RPC 一致
GRANT EXECUTE ON FUNCTION create_alliance(text,text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION invite_to_alliance(text,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION join_alliance(text,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION leave_alliance(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION transfer_leadership(text,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION kick_member(text,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION set_member_role(text,uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION list_alliances() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_my_alliance(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION send_alliance_chat(text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION list_alliance_chat(text,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION list_my_invites(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_invite(text,uuid) TO anon, authenticated;

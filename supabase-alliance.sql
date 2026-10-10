-- ============================================================
-- 涿鹿风云 · 联盟系统
-- 创建/加入/退出联盟、邀请、踢人、联盟聊天、联盟战力榜
-- 依赖：players(player_name text PK), sessions(token uuid, player_name text, expires_at),
--       villages(player_name text, village_data jsonb)  -- village_data.season.points 作为个人战力
-- ============================================================

-- 联盟表
CREATE TABLE IF NOT EXISTS alliances (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL UNIQUE,
  tag          text NOT NULL UNIQUE CHECK (char_length(tag) BETWEEN 2 AND 6),
  leader_name  text NOT NULL REFERENCES players(player_name),
  description  text NOT NULL DEFAULT '',
  member_count integer NOT NULL DEFAULT 1,
  power        integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alliances_power ON alliances(power DESC);

-- 联盟成员
CREATE TABLE IF NOT EXISTS alliance_members (
  alliance_id uuid NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  player_name text NOT NULL REFERENCES players(player_name) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member' CHECK (role IN ('leader','officer','member')),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alliance_id, player_name)
);
CREATE INDEX IF NOT EXISTS idx_alliance_members_player ON alliance_members(player_name);

-- 联盟邀请
CREATE TABLE IF NOT EXISTS alliance_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id uuid NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  player_name text NOT NULL REFERENCES players(player_name) ON DELETE CASCADE,  -- 被邀请人
  invited_by  text NOT NULL REFERENCES players(player_name),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alliance_id, player_name)
);

-- 联盟聊天
CREATE TABLE IF NOT EXISTS alliance_chat (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id uuid NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  player_name text NOT NULL REFERENCES players(player_name),
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
-- token 校验：返回 player_name；未登录/过期抛错
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION alliance_get_player(p_token uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
Set search_path = public
AS $$
DECLARE v_pname text; v_exp timestamptz;
BEGIN
  IF p_token IS NULL THEN
    RAISE EXCEPTION '未登录' USING ERRCODE = '28000';
  END IF;
  SELECT s.player_name, s.expires_at INTO v_pname, v_exp
  FROM sessions s WHERE s.token = p_token;
  IF v_pname IS NULL THEN RAISE EXCEPTION '登录已失效，请重新登录' USING ERRCODE = '28000'; END IF;
  IF v_exp < now() THEN RAISE EXCEPTION '登录已过期，请重新登录' USING ERRCODE = '28000'; END IF;
  RETURN v_pname;
END; $$;

-- ------------------------------------------------------------
-- 工具：玩家当前所在联盟 id（无则 NULL）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION my_alliance_id(p_pname text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER
Set search_path = public
AS $$
  SELECT alliance_id FROM alliance_members WHERE player_name = p_pname LIMIT 1;
$$;

-- ------------------------------------------------------------
-- create_alliance：创建联盟（需大使馆建筑，由前端也校验）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_alliance(
  p_token uuid, p_name text, p_tag text, p_description text DEFAULT ''
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
Set search_path = public
AS $$
DECLARE v_pname text; v_aid uuid; v_cur uuid;
BEGIN
  v_pname := alliance_get_player(p_token);
  IF char_length(p_name) < 2 OR char_length(p_name) > 16 THEN
    RAISE EXCEPTION '联盟名称需 2-16 个字符';
  END IF;
  IF char_length(p_tag) < 2 OR char_length(p_tag) > 6 THEN
    RAISE EXCEPTION '联盟简称需 2-6 个字符';
  END IF;
  v_cur := my_alliance_id(v_pname);
  IF v_cur IS NOT NULL THEN RAISE EXCEPTION '你已在联盟中，请先退出'; END IF;
  INSERT INTO alliances (name, tag, leader_name, description)
  VALUES (p_name, p_tag, v_pname, COALESCE(p_description, ''))
  RETURNING id INTO v_aid;
  INSERT INTO alliance_members (alliance_id, player_name, role) VALUES (v_aid, v_pname, 'leader');
  RETURN v_aid;
END; $$;

-- ------------------------------------------------------------
-- invite_to_alliance：官员/盟主邀请玩家
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION invite_to_alliance(p_token uuid, p_player_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
Set search_path = public
AS $$
DECLARE v_pname text; v_aid uuid; v_role text; v_target_alliance uuid;
BEGIN
  v_pname := alliance_get_player(p_token);
  SELECT alliance_id, role INTO v_aid, v_role FROM alliance_members WHERE player_name = v_pname;
  IF v_aid IS NULL THEN RAISE EXCEPTION '你不在任何联盟中'; END IF;
  IF v_role NOT IN ('leader','officer') THEN RAISE EXCEPTION '只有盟主或官员可邀请'; END IF;
  v_target_alliance := my_alliance_id(p_player_name);
  IF v_target_alliance IS NOT NULL THEN RAISE EXCEPTION '该玩家已在联盟中'; END IF;
  INSERT INTO alliance_invites (alliance_id, player_name, invited_by)
  VALUES (v_aid, p_player_name, v_pname)
  ON CONFLICT (alliance_id, player_name) DO NOTHING;
END; $$;

-- ------------------------------------------------------------
-- join_alliance：通过邀请加入
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION join_alliance(p_token uuid, p_invite_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
Set search_path = public
AS $$
DECLARE v_pname text; inv alliance_invites%ROWTYPE; v_aid uuid;
BEGIN
  v_pname := alliance_get_player(p_token);
  IF my_alliance_id(v_pname) IS NOT NULL THEN RAISE EXCEPTION '你已在联盟中'; END IF;
  SELECT * INTO inv FROM alliance_invites WHERE id = p_invite_id;
  IF inv.id IS NULL THEN RAISE EXCEPTION '邀请不存在'; END IF;
  IF inv.player_name <> v_pname THEN RAISE EXCEPTION '该邀请不是发给你的'; END IF;
  v_aid := inv.alliance_id;
  INSERT INTO alliance_members (alliance_id, player_name) VALUES (v_aid, v_pname);
  UPDATE alliances SET member_count = member_count + 1 WHERE id = v_aid;
  DELETE FROM alliance_invites WHERE id = inv.id;
  -- 清理该玩家的其它邀请
  DELETE FROM alliance_invites WHERE player_name = v_pname;
  RETURN v_aid;
END; $$;

-- ------------------------------------------------------------
-- leave_alliance：退出联盟；盟主需先转让或解散
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION leave_alliance(p_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
Set search_path = public
AS $$
DECLARE v_pname text; v_aid uuid; v_role text; v_cnt integer;
BEGIN
  v_pname := alliance_get_player(p_token);
  SELECT alliance_id, role INTO v_aid, v_role FROM alliance_members WHERE player_name = v_pname;
  IF v_aid IS NULL THEN RAISE EXCEPTION '你不在任何联盟中'; END IF;
  SELECT count(*) INTO v_cnt FROM alliance_members WHERE alliance_id = v_aid;
  IF v_role = 'leader' AND v_cnt > 1 THEN
    RAISE EXCEPTION '盟主请先转让盟主位再退出';
  END IF;
  DELETE FROM alliance_members WHERE player_name = v_pname;
  DELETE FROM alliance_invites WHERE player_name = v_pname;
  IF v_cnt <= 1 THEN
    DELETE FROM alliances WHERE id = v_aid;  -- 联盟解散
  ELSE
    UPDATE alliances SET member_count = member_count - 1 WHERE id = v_aid;
  END IF;
END; $$;

-- ------------------------------------------------------------
-- transfer_leadership：转让盟主（盟主→另一成员）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION transfer_leadership(p_token uuid, p_new_leader_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
Set search_path = public
AS $$
DECLARE v_pname text; v_aid uuid; v_role text; v_target_aid uuid;
BEGIN
  v_pname := alliance_get_player(p_token);
  SELECT alliance_id, role INTO v_aid, v_role FROM alliance_members WHERE player_name = v_pname;
  IF v_role <> 'leader' THEN RAISE EXCEPTION '只有盟主可转让'; END IF;
  SELECT alliance_id INTO v_target_aid FROM alliance_members WHERE player_name = p_new_leader_name;
  IF v_target_aid <> v_aid THEN RAISE EXCEPTION '目标不在本联盟'; END IF;
  UPDATE alliance_members SET role = 'member' WHERE player_name = v_pname AND alliance_id = v_aid;
  UPDATE alliance_members SET role = 'leader' WHERE player_name = p_new_leader_name AND alliance_id = v_aid;
  UPDATE alliances SET leader_name = p_new_leader_name WHERE id = v_aid;
END; $$;

-- ------------------------------------------------------------
-- kick_member：踢人（盟主/官员）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION kick_member(p_token uuid, p_player_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
Set search_path = public
AS $$
DECLARE v_pname text; v_aid uuid; v_role text; v_target_aid uuid; v_target_role text;
BEGIN
  v_pname := alliance_get_player(p_token);
  SELECT alliance_id, role INTO v_aid, v_role FROM alliance_members WHERE player_name = v_pname;
  IF v_role NOT IN ('leader','officer') THEN RAISE EXCEPTION '无权限踢人'; END IF;
  SELECT alliance_id, role INTO v_target_aid, v_target_role FROM alliance_members WHERE player_name = p_player_name;
  IF v_target_aid <> v_aid THEN RAISE EXCEPTION '目标不在本联盟'; END IF;
  IF v_target_role = 'leader' THEN RAISE EXCEPTION '不能踢盟主'; END IF;
  IF v_role = 'officer' AND v_target_role = 'officer' THEN
    RAISE EXCEPTION '官员不能踢官员';
  END IF;
  DELETE FROM alliance_members WHERE player_name = p_player_name AND alliance_id = v_aid;
  DELETE FROM alliance_invites WHERE player_name = p_player_name;
  UPDATE alliances SET member_count = member_count - 1 WHERE id = v_aid;
END; $$;

-- ------------------------------------------------------------
-- set_member_role：设置官员/成员（盟主）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_member_role(p_token uuid, p_player_name text, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
Set search_path = public
AS $$
DECLARE v_pname text; v_aid uuid; v_role text; v_target_aid uuid;
BEGIN
  v_pname := alliance_get_player(p_token);
  SELECT alliance_id, role INTO v_aid, v_role FROM alliance_members WHERE player_name = v_pname;
  IF v_role <> 'leader' THEN RAISE EXCEPTION '只有盟主可设置职位'; END IF;
  IF p_role NOT IN ('officer','member') THEN RAISE EXCEPTION '职位无效'; END IF;
  SELECT alliance_id INTO v_target_aid FROM alliance_members WHERE player_name = p_player_name;
  IF v_target_aid <> v_aid THEN RAISE EXCEPTION '目标不在本联盟'; END IF;
  UPDATE alliance_members SET role = p_role WHERE player_name = p_player_name AND alliance_id = v_aid;
END; $$;

-- ------------------------------------------------------------
-- refresh_alliance_power：重算联盟战力（成员 season.points 之和）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_alliance_power(p_aid uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
Set search_path = public
AS $$
DECLARE v_power integer;
BEGIN
  SELECT COALESCE(SUM(COALESCE((v.village_data->'season'->>'points')::int, 0)), 0) INTO v_power
  FROM alliance_members am
  JOIN villages v ON v.player_name = am.player_name
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
) LANGUAGE plpgsql SECURITY DEFINER
Set search_path = public
AS $$
BEGIN
  -- 全量重算战力（数据量小时可接受；后续可改定时任务）
  PERFORM refresh_alliance_power(a.id) FROM alliances a;
  RETURN QUERY
  SELECT a.id, a.name, a.tag, a.description,
         a.leader_name, a.member_count, a.power,
         ROW_NUMBER() OVER (ORDER BY a.power DESC, a.created_at ASC) AS rank,
         a.created_at
  FROM alliances a
  ORDER BY a.power DESC, a.created_at ASC
  LIMIT 100;
END; $$;

-- ------------------------------------------------------------
-- get_my_alliance：我的联盟详情 + 成员列表
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_alliance(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
Set search_path = public
AS $$
DECLARE v_pname text; v_aid uuid; v_role text; v_alliance jsonb; v_members jsonb;
BEGIN
  v_pname := alliance_get_player(p_token);
  SELECT am.alliance_id, am.role INTO v_aid, v_role FROM alliance_members am WHERE am.player_name = v_pname;
  IF v_aid IS NULL THEN RETURN NULL; END IF;
  PERFORM refresh_alliance_power(v_aid);
  SELECT jsonb_build_object(
    'id', a.id, 'name', a.name, 'tag', a.tag, 'description', a.description,
    'leader_id', a.leader_name, 'leader_name', a.leader_name,
    'member_count', a.member_count, 'power', a.power, 'created_at', a.created_at,
    'my_role', v_role
  ) INTO v_alliance
  FROM alliances a WHERE a.id = v_aid;

  SELECT jsonb_agg(m ORDER BY (m->>'role'='leader') DESC, (m->>'joined_at')::timestamptz ASC) INTO v_members
  FROM (
    SELECT jsonb_build_object(
      'player_id', am.player_name, 'player_name', am.player_name, 'role', am.role,
      'power', COALESCE((v.village_data->'season'->>'points')::int, 0),
      'tribe', v.village_data->>'tribe', 'joined_at', am.joined_at
    ) AS m
    FROM alliance_members am
    LEFT JOIN villages v ON v.player_name = am.player_name
    WHERE am.alliance_id = v_aid
  ) s;
  RETURN jsonb_build_object('alliance', v_alliance, 'members', v_members);
END; $$;

-- ------------------------------------------------------------
-- 联盟聊天
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION send_alliance_chat(p_token uuid, p_message text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
Set search_path = public
AS $$
DECLARE v_pname text; v_aid uuid; v_id uuid;
BEGIN
  v_pname := alliance_get_player(p_token);
  SELECT alliance_id INTO v_aid FROM alliance_members WHERE player_name = v_pname;
  IF v_aid IS NULL THEN RAISE EXCEPTION '你不在任何联盟中'; END IF;
  IF char_length(p_message) < 1 OR char_length(p_message) > 500 THEN
    RAISE EXCEPTION '消息长度需 1-500 字符';
  END IF;
  INSERT INTO alliance_chat (alliance_id, player_name, message)
  VALUES (v_aid, v_pname, p_message)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION list_alliance_chat(p_token uuid, p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid, player_id text, player_name text, message text, created_at timestamptz, is_mine boolean
) LANGUAGE plpgsql SECURITY DEFINER
Set search_path = public
AS $$
DECLARE v_pname text; v_aid uuid;
BEGIN
  v_pname := alliance_get_player(p_token);
  SELECT am.alliance_id INTO v_aid FROM alliance_members am WHERE am.player_name = v_pname;
  IF v_aid IS NULL THEN RAISE EXCEPTION '你不在任何联盟中'; END IF;
  RETURN QUERY
  SELECT c.id, c.player_name AS player_id, c.player_name, c.message, c.created_at,
         (c.player_name = v_pname) AS is_mine
  FROM alliance_chat c
  WHERE c.alliance_id = v_aid
  ORDER BY c.created_at DESC
  LIMIT LEAST(COALESCE(p_limit, 50), 200);
END; $$;

-- ------------------------------------------------------------
-- 邀请相关
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION list_my_invites(p_token uuid)
RETURNS TABLE (
  id uuid, alliance_id uuid, alliance_name text, alliance_tag text,
  invited_by_name text, created_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER
Set search_path = public
AS $$
DECLARE v_pname text;
BEGIN
  v_pname := alliance_get_player(p_token);
  RETURN QUERY
  SELECT i.id, i.alliance_id, a.name, a.tag, i.invited_by, i.created_at
  FROM alliance_invites i
  JOIN alliances a ON a.id = i.alliance_id
  WHERE i.player_name = v_pname
  ORDER BY i.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION cancel_invite(p_token uuid, p_invite_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
Set search_path = public
AS $$
DECLARE v_pname text; v_role text; v_aid uuid; inv alliance_invites%ROWTYPE;
BEGIN
  v_pname := alliance_get_player(p_token);
  SELECT alliance_id, role INTO v_aid, v_role FROM alliance_members WHERE player_name = v_pname;
  IF v_role NOT IN ('leader','officer') THEN RAISE EXCEPTION '无权限'; END IF;
  SELECT * INTO inv FROM alliance_invites WHERE id = p_invite_id;
  IF inv.alliance_id <> v_aid THEN RAISE EXCEPTION '邀请不属于本联盟'; END IF;
  DELETE FROM alliance_invites WHERE id = p_invite_id;
END; $$;

-- 权限：与现有 RPC 一致
GRANT EXECUTE ON FUNCTION create_alliance(uuid,text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION invite_to_alliance(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION join_alliance(uuid,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION leave_alliance(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION transfer_leadership(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION kick_member(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION set_member_role(uuid,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION list_alliances() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_my_alliance(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION send_alliance_chat(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION list_alliance_chat(uuid,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION list_my_invites(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_invite(uuid,uuid) TO anon, authenticated;

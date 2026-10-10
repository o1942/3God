// 联盟系统：类型与工具
export type AllianceRole = 'leader' | 'officer' | 'member';

export const ROLE_LABEL: Record<AllianceRole, string> = {
  leader: '盟主',
  officer: '官员',
  member: '成员',
};

export interface Alliance {
  id: string;
  name: string;
  tag: string;
  description: string;
  leader_id: string;
  leader_name: string;
  member_count: number;
  power: number;
  created_at: string;
  my_role: AllianceRole;
}

export interface AllianceMember {
  player_id: string;
  player_name: string;
  role: AllianceRole;
  power: number;
  tribe: string | null;
  joined_at: string;
}

export interface AllianceRankingItem {
  id: string;
  name: string;
  tag: string;
  description: string;
  leader_name: string;
  member_count: number;
  power: number;
  rank: number;
  created_at: string;
}

export interface AllianceInvite {
  id: string;
  alliance_id: string;
  alliance_name: string;
  alliance_tag: string;
  invited_by_name: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  player_id: string;
  player_name: string;
  message: string;
  created_at: string;
  is_mine: boolean;
}

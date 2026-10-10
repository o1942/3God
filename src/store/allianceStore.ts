// 联盟系统 Zustand store
import { create } from 'zustand';
import { ensureClient, getSessionToken } from '../lib/supabase';
import { toast } from './toast';
import type {
  Alliance, AllianceMember, AllianceRankingItem, AllianceInvite, ChatMessage,
} from '../game/alliance';

interface AllianceState {
  alliance: Alliance | null;
  members: AllianceMember[];
  rankings: AllianceRankingItem[];
  invites: AllianceInvite[];
  chat: ChatMessage[];

  loadMyAlliance: () => Promise<void>;
  loadRankings: () => Promise<void>;
  loadInvites: () => Promise<void>;
  loadChat: () => Promise<void>;

  createAlliance: (name: string, tag: string, description: string) => Promise<boolean>;
  joinAlliance: (inviteId: string) => Promise<boolean>;
  leaveAlliance: () => Promise<boolean>;
  inviteMember: (playerId: string) => Promise<boolean>;
  kickMember: (playerId: string) => Promise<boolean>;
  transferLeadership: (playerId: string) => Promise<boolean>;
  setMemberRole: (playerId: string, role: 'officer' | 'member') => Promise<boolean>;
  sendChat: (message: string) => Promise<boolean>;
}

function rpcError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.match(/message["']?\s*[:=]\s*["']([^"']+)/);
  if (m) return m[1];
  return msg || '操作失败，请稍后重试';
}

export const useAllianceStore = create<AllianceState>((set, get) => ({
  alliance: null,
  members: [],
  rankings: [],
  invites: [],
  chat: [],

  loadMyAlliance: async () => {
    const token = getSessionToken();
    if (!token) return;
    try {
      const sb = await ensureClient();
      if (!sb) return;
      const { data, error } = await sb.rpc('get_my_alliance', { p_token: token });
      if (error) throw error;
      if (data) {
        set({ alliance: data.alliance as Alliance, members: (data.members as AllianceMember[]) || [] });
      } else {
        set({ alliance: null, members: [] });
      }
    } catch (e) {
      // 静默：未加入联盟不算错误
    }
  },

  loadRankings: async () => {
    try {
      const sb = await ensureClient();
      if (!sb) return;
      const { data, error } = await sb.rpc('list_alliances');
      if (error) throw error;
      set({ rankings: (data as AllianceRankingItem[]) || [] });
    } catch (e) {
      // 静默
    }
  },

  loadInvites: async () => {
    const token = getSessionToken();
    if (!token) return;
    try {
      const sb = await ensureClient();
      if (!sb) return;
      const { data, error } = await sb.rpc('list_my_invites', { p_token: token });
      if (error) throw error;
      set({ invites: (data as AllianceInvite[]) || [] });
    } catch (e) {
      // 静默
    }
  },

  loadChat: async () => {
    const token = getSessionToken();
    if (!token) return;
    try {
      const sb = await ensureClient();
      if (!sb) return;
      const { data, error } = await sb.rpc('list_alliance_chat', { p_token: token, p_limit: 50 });
      if (error) throw error;
      set({ chat: ((data as ChatMessage[]) || []).reverse() });
    } catch (e) {
      // 静默
    }
  },

  createAlliance: async (name, tag, description) => {
    const token = getSessionToken();
    if (!token) { toast.warning('请先登录'); return false; }
    try {
      const sb = await ensureClient();
      if (!sb) { toast.error('后端未配置'); return false; }
      const { error } = await sb.rpc('create_alliance', {
        p_token: token, p_name: name, p_tag: tag, p_description: description,
      });
      if (error) throw error;
      toast.success('联盟创建成功');
      await get().loadMyAlliance();
      return true;
    } catch (e) {
      toast.error(rpcError(e));
      return false;
    }
  },

  joinAlliance: async (inviteId) => {
    const token = getSessionToken();
    if (!token) { toast.warning('请先登录'); return false; }
    try {
      const sb = await ensureClient();
      if (!sb) { toast.error('后端未配置'); return false; }
      const { error } = await sb.rpc('join_alliance', { p_token: token, p_invite_id: inviteId });
      if (error) throw error;
      toast.success('已加入联盟');
      await Promise.all([get().loadMyAlliance(), get().loadInvites()]);
      return true;
    } catch (e) {
      toast.error(rpcError(e));
      return false;
    }
  },

  leaveAlliance: async () => {
    const token = getSessionToken();
    if (!token) { toast.warning('请先登录'); return false; }
    try {
      const sb = await ensureClient();
      if (!sb) { toast.error('后端未配置'); return false; }
      const { error } = await sb.rpc('leave_alliance', { p_token: token });
      if (error) throw error;
      toast.success('已退出联盟');
      set({ alliance: null, members: [], chat: [] });
      return true;
    } catch (e) {
      toast.error(rpcError(e));
      return false;
    }
  },

  inviteMember: async (playerId) => {
    const token = getSessionToken();
    if (!token) { toast.warning('请先登录'); return false; }
    try {
      const sb = await ensureClient();
      if (!sb) { toast.error('后端未配置'); return false; }
      const { error } = await sb.rpc('invite_to_alliance', { p_token: token, p_player_name: playerId });
      if (error) throw error;
      toast.success('邀请已发送');
      return true;
    } catch (e) {
      toast.error(rpcError(e));
      return false;
    }
  },

  kickMember: async (playerId) => {
    const token = getSessionToken();
    if (!token) { toast.warning('请先登录'); return false; }
    try {
      const sb = await ensureClient();
      if (!sb) { toast.error('后端未配置'); return false; }
      const { error } = await sb.rpc('kick_member', { p_token: token, p_player_name: playerId });
      if (error) throw error;
      toast.success('已踢出该成员');
      await get().loadMyAlliance();
      return true;
    } catch (e) {
      toast.error(rpcError(e));
      return false;
    }
  },

  transferLeadership: async (playerId) => {
    const token = getSessionToken();
    if (!token) { toast.warning('请先登录'); return false; }
    try {
      const sb = await ensureClient();
      if (!sb) { toast.error('后端未配置'); return false; }
      const { error } = await sb.rpc('transfer_leadership', { p_token: token, p_new_leader_name: playerId });
      if (error) throw error;
      toast.success('盟主已转让');
      await get().loadMyAlliance();
      return true;
    } catch (e) {
      toast.error(rpcError(e));
      return false;
    }
  },

  setMemberRole: async (playerId, role) => {
    const token = getSessionToken();
    if (!token) { toast.warning('请先登录'); return false; }
    try {
      const sb = await ensureClient();
      if (!sb) { toast.error('后端未配置'); return false; }
      const { error } = await sb.rpc('set_member_role', {
        p_token: token, p_player_name: playerId, p_role: role,
      });
      if (error) throw error;
      toast.success('职位已更新');
      await get().loadMyAlliance();
      return true;
    } catch (e) {
      toast.error(rpcError(e));
      return false;
    }
  },

  sendChat: async (message) => {
    const token = getSessionToken();
    if (!token) { toast.warning('请先登录'); return false; }
    try {
      const sb = await ensureClient();
      if (!sb) { toast.error('后端未配置'); return false; }
      const { error } = await sb.rpc('send_alliance_chat', { p_token: token, p_message: message });
      if (error) throw error;
      await get().loadChat();
      return true;
    } catch (e) {
      toast.error(rpcError(e));
      return false;
    }
  },
}));

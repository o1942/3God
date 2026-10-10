// 联盟面板：联盟榜单 / 创建 / 成员管理 / 联盟聊天
import { useEffect, useState } from 'react';
import { useAllianceStore } from '../store/allianceStore';
import { useGame } from '../store/gameStore';
import { ROLE_LABEL, type AllianceRole } from '../game/alliance';

export function AlliancePanel({ onClose }: { onClose: () => void }) {
  const {
    alliance, members, rankings, invites, chat,
    loadMyAlliance, loadRankings, loadInvites, loadChat,
    createAlliance, joinAlliance, leaveAlliance, sendChat,
  } = useAllianceStore();
  const embassyLv = useGame((s) => s.village.buildings.embassy || 0);

  useEffect(() => {
    loadMyAlliance();
    loadRankings();
    loadInvites();
  }, [loadMyAlliance, loadRankings, loadInvites]);

  useEffect(() => {
    if (alliance) {
      loadChat();
      const t = setInterval(loadChat, 8000);
      return () => clearInterval(t);
    }
  }, [alliance, loadChat]);

  const inAlliance = !!alliance;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-bg-card border-t sm:border border-border sm:rounded-2xl rounded-t-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto anim-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="sticky top-0 bg-bg-card border-b border-border px-4 py-3 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-text-primary">🛡️ 联盟</h2>
              <p className="text-xs text-text-muted">结盟共伐洪荒 · 大使馆 Lv.{embassyLv}</p>
            </div>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl px-1">×</button>
          </div>
        </div>

        {/* 内容 */}
        <div className="p-3">
          {embassyLv < 1 && (
            <div className="text-center text-text-muted text-sm py-8">需先建造大使馆才能使用联盟功能</div>
          )}
          {embassyLv >= 1 && !inAlliance && (
            <>
              <InvitesBanner invites={invites} onJoin={joinAlliance} />
              <CreateAllianceForm onCreate={createAlliance} />
              <AllianceRanking rankings={rankings} />
            </>
          )}
          {embassyLv >= 1 && inAlliance && (
            <>
              <AllianceHeader alliance={alliance!} onLeave={leaveAlliance} />
              <MembersList
                members={members}
                myRole={alliance!.my_role}
                myId={alliance!.leader_id}
              />
              <InviteForm />
              <AllianceChat chat={chat} onSend={sendChat} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 邀请横幅 ---------------- */
function InvitesBanner({ invites, onJoin }: {
  invites: ReturnType<typeof useAllianceStore.getState>['invites'];
  onJoin: (id: string) => Promise<boolean>;
}) {
  if (invites.length === 0) return null;
  return (
    <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
      <div className="text-sm font-semibold text-blue-800 mb-2">你有 {invites.length} 条联盟邀请</div>
      {invites.map((inv) => (
        <div key={inv.id} className="flex items-center justify-between text-sm py-1">
          <span className="text-blue-700">
            [{inv.alliance_tag}] {inv.alliance_name}（{inv.invited_by_name} 邀请）
          </span>
          <button onClick={() => onJoin(inv.id)}
            className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">接受</button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- 创建联盟 ---------------- */
function CreateAllianceForm({ onCreate }: {
  onCreate: (name: string, tag: string, desc: string) => Promise<boolean>;
}) {
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [desc, setDesc] = useState('');
  const canCreate = name.length >= 2 && name.length <= 16 && tag.length >= 2 && tag.length <= 6;

  return (
    <div className="card-std p-4 mb-3">
      <h3 className="font-semibold text-text-primary mb-2">创建联盟</h3>
      <div className="grid grid-cols-2 gap-3 mb-2">
        <div>
          <div className="text-xs text-text-muted mb-1">联盟名称（2-16）</div>
          <input value={name} maxLength={16}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2 py-1 border border-border rounded text-sm bg-bg-primary" />
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">简称 tag（2-6）</div>
          <input value={tag} maxLength={6}
            onChange={(e) => setTag(e.target.value)}
            className="w-full px-2 py-1 border border-border rounded text-sm bg-bg-primary" />
        </div>
      </div>
      <div className="mb-2">
        <div className="text-xs text-text-muted mb-1">简介（选填）</div>
        <input value={desc} maxLength={100}
          onChange={(e) => setDesc(e.target.value)}
          className="w-full px-2 py-1 border border-border rounded text-sm bg-bg-primary" />
      </div>
      <button disabled={!canCreate}
        onClick={async () => {
          const ok = await onCreate(name.trim(), tag.trim(), desc.trim());
          if (ok) { setName(''); setTag(''); setDesc(''); }
        }}
        className={`w-full py-2 rounded text-sm font-semibold transition ${
          canCreate ? 'bg-pop text-white hover:opacity-90' : 'bg-bg-secondary text-text-muted cursor-not-allowed'
        }`}>创建联盟</button>
    </div>
  );
}

/* ---------------- 联盟榜单 ---------------- */
function AllianceRanking({ rankings }: {
  rankings: ReturnType<typeof useAllianceStore.getState>['rankings'];
}) {
  if (rankings.length === 0) {
    return <div className="text-text-muted text-sm py-6 text-center">暂无联盟</div>;
  }
  return (
    <div className="card-std p-3">
      <h3 className="font-semibold text-text-primary mb-2">联盟战力榜</h3>
      <div className="space-y-1 text-sm">
        {rankings.map((a) => (
          <div key={a.id} className="flex items-center gap-2 py-1 border-b border-border last:border-0">
            <span className={`w-6 text-center font-bold ${
              a.rank === 1 ? 'text-yellow-600' : a.rank === 2 ? 'text-text-muted' : a.rank === 3 ? 'text-pop' : 'text-text-muted'
            }`}>{a.rank}</span>
            <span className="font-semibold text-text-primary">[{a.tag}] {a.name}</span>
            <span className="ml-auto text-xs text-text-muted">{a.member_count}人 · 战力 {a.power}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 联盟头部 ---------------- */
function AllianceHeader({ alliance, onLeave }: {
  alliance: NonNullable<ReturnType<typeof useAllianceStore.getState>['alliance']>;
  onLeave: () => Promise<boolean>;
}) {
  return (
    <div className="card-std p-3 mb-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-text-primary">[{alliance.tag}] {alliance.name}</h3>
          <div className="text-xs text-text-muted">盟主：{alliance.leader_name} · {alliance.member_count} 人 · 战力 {alliance.power}</div>
        </div>
        <button onClick={async () => {
          if (!confirm('确定退出联盟？盟主请先转让盟主位。')) return;
          await onLeave();
        }}
          className="px-3 py-1 bg-red-50 text-red-600 rounded text-sm hover:bg-red-100">退出联盟</button>
      </div>
      {alliance.description && <div className="text-sm text-text-secondary mt-1">{alliance.description}</div>}
    </div>
  );
}

/* ---------------- 成员列表 ---------------- */
function MembersList({ members, myRole, myId }: {
  members: ReturnType<typeof useAllianceStore.getState>['members'];
  myRole: AllianceRole;
  myId: string;
}) {
  const { kickMember, transferLeadership, setMemberRole } = useAllianceStore();
  const canManage = myRole === 'leader' || myRole === 'officer';

  return (
    <div className="card-std p-3 mb-3">
      <h3 className="font-semibold text-text-primary mb-2">成员（{members.length}）</h3>
      <div className="space-y-1 text-sm">
        {members.map((m) => (
          <div key={m.player_id} className="flex items-center gap-2 py-1 border-b border-border last:border-0">
            <span className="font-semibold text-text-primary">{m.player_name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              m.role === 'leader' ? 'bg-yellow-100 text-yellow-700'
              : m.role === 'officer' ? 'bg-blue-100 text-blue-700'
              : 'bg-bg-secondary text-text-muted'
            }`}>{ROLE_LABEL[m.role]}</span>
            <span className="text-xs text-text-muted">战力 {m.power}</span>
            <div className="ml-auto flex gap-1">
              {myRole === 'leader' && m.role !== 'leader' && (
                <>
                  <button onClick={() => {
                    if (!confirm('确定将盟主转让给该成员？')) return;
                    transferLeadership(m.player_id);
                  }}
                    className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded text-xs hover:bg-yellow-100">传位</button>
                  <button onClick={() => setMemberRole(m.player_id, m.role === 'officer' ? 'member' : 'officer')}
                    className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100">
                    {m.role === 'officer' ? '降为成员' : '设为官员'}
                  </button>
                </>
              )}
              {canManage && m.role !== 'leader' && m.player_id !== myId && (
                <button onClick={() => {
                  if (!confirm('确定踢出该成员？')) return;
                  kickMember(m.player_id);
                }}
                  className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100">踢出</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 邀请成员 ---------------- */
function InviteForm() {
  const { inviteMember } = useAllianceStore();
  const [pid, setPid] = useState('');
  return (
    <div className="card-std p-3 mb-3">
      <h3 className="font-semibold text-text-primary mb-2">邀请成员</h3>
      <div className="flex gap-2">
        <input value={pid} placeholder="输入玩家 ID"
          onChange={(e) => setPid(e.target.value)}
          className="flex-1 px-2 py-1 border border-border rounded text-sm bg-bg-primary" />
        <button onClick={() => {
          if (pid.trim()) { inviteMember(pid.trim()); setPid(''); }
        }}
          className="px-3 py-1 bg-pop text-white rounded text-sm hover:opacity-90">邀请</button>
      </div>
      <div className="text-xs text-text-muted mt-1">提示：玩家 ID 可从排行榜侦查或战报中获取</div>
    </div>
  );
}

/* ---------------- 联盟聊天 ---------------- */
function AllianceChat({ chat, onSend }: {
  chat: ReturnType<typeof useAllianceStore.getState>['chat'];
  onSend: (m: string) => Promise<boolean>;
}) {
  const [text, setText] = useState('');
  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };
  return (
    <div className="card-std p-3">
      <h3 className="font-semibold text-text-primary mb-2">联盟聊天</h3>
      <div className="h-48 overflow-y-auto bg-bg-primary/60 border border-border rounded p-2 mb-2 space-y-1 text-sm">
        {chat.length === 0 && <div className="text-text-muted text-xs text-center py-8">暂无消息</div>}
        {chat.map((c) => (
          <div key={c.id} className={`flex flex-col ${c.is_mine ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[80%] px-2 py-1 rounded ${
              c.is_mine ? 'bg-pop text-white' : 'bg-bg-secondary text-text-primary'
            }`}>
              <div className={`text-xs ${c.is_mine ? 'text-white/70' : 'text-text-muted'}`}>{c.player_name}</div>
              <div>{c.message}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={text} maxLength={500} placeholder="输入消息（1-500字）"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          className="flex-1 px-2 py-1 border border-border rounded text-sm bg-bg-primary" />
        <button onClick={send}
          className="px-3 py-1 bg-pop text-white rounded text-sm hover:opacity-90">发送</button>
      </div>
    </div>
  );
}

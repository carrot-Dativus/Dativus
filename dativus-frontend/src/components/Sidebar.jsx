import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosInstance';
import dativusLogo from '../assets/Dativus_logo.png';

function Section({ title, badge, defaultOpen = false, storageKey, children }) {
  const [open, setOpen] = useState(() => {
    if (storageKey) {
      try {
        const saved = sessionStorage.getItem(`sb_sec_${storageKey}`);
        if (saved !== null) return saved === 'true';
      } catch {}
    }
    return defaultOpen;
  });

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (storageKey) {
      try { sessionStorage.setItem(`sb_sec_${storageKey}`, String(next)); } catch {}
    }
  };

  return (
    <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #e8e8e8' }}>
      <button
        onClick={toggle}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '11px 14px', background: open ? '#f7f7f7' : '#fff',
          border: 'none', cursor: 'pointer', borderBottom: open ? '1px solid #e8e8e8' : 'none',
          transition: 'background 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#111' }}>{title}</span>
          {badge != null && (
            <span style={{
              fontSize: '10px', fontWeight: '700', color: '#fff',
              backgroundColor: '#555', borderRadius: '10px',
              padding: '1px 6px', lineHeight: '16px',
            }}>{badge}</span>
          )}
        </div>
        <span style={{ fontSize: '10px', color: '#aaa', transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: '12px 14px', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

const toggleBtnBase = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: '#bbb', borderRadius: '6px', lineHeight: 1,
  transition: 'color 0.15s, background 0.15s',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

export default function Sidebar({
  width = 260,
  isOpen = true, setIsOpen,
  setIsUploadOpen, setIsDocManagerOpen, setIsAgentCreateOpen,
  agentList, onEditAgent, handleDeleteAgent,
  newTeamName, setNewTeamName, handleCreateTeam,
  inviteCode, setInviteCode, handleJoinTeam, workspaces, workspaceId,
  currentUserId, teamSessionId, privateSessionId,
  onSelectTeamSession, onSelectPrivateSession,
}) {
  const navigate = useNavigate();

  // ─── 세션 목록 ───
  const [sessions, setSessions] = useState({ teamChannels: [], personalChats: [] });
  const [sessionRefresh, setSessionRefresh] = useState(0);
  const hasAutoSelected = useRef(false);

  // 채널 생성 모달
  const [channelModal, setChannelModal] = useState(null); // null | { name: '', mode: 'AI' }
  // 개인 채팅 생성 인라인 입력
  const [creatingPersonalChat, setCreatingPersonalChat] = useState(false);
  const [newPersonalChatName, setNewPersonalChatName] = useState('');
  const cancelPersonalChatRef = useRef(false);
  // 서브 패널: null | 'team' | 'personal'
  const [subPanel, setSubPanel] = useState(null);

  useEffect(() => {
    if (!workspaceId || workspaceId === 'null') return;
    const fetchSessions = async () => {
      try {
        const res = await apiClient.get(
          `/api/v1/chats/workspace/${workspaceId}/sessions?userId=${currentUserId || ''}`
        );
        if (res.ok) {
          const data = await res.json();
          setSessions(data);
          // 최초 로드 시 팀/개인 채널 자동 선택 (마지막 방문 채널 복원)
          if (!hasAutoSelected.current) {
            hasAutoSelected.current = true;
            if (data.teamChannels.length > 0 && !teamSessionId) {
              const lastId = localStorage.getItem('lastTeamSessionId');
              const restored = lastId && data.teamChannels.find(ch => ch.id === lastId);
              const target = restored || data.teamChannels[0];
              onSelectTeamSession?.(target.id, target.channelMode || 'AI');
            }
            if (data.personalChats.length > 0 && !privateSessionId) {
              const lastId = localStorage.getItem('lastPrivateSessionId');
              const restored = lastId && data.personalChats.find(c => c.id === lastId);
              const target = restored || data.personalChats[0];
              onSelectPrivateSession?.(target.id);
            }
          }
        }
      } catch (e) {
        console.error('세션 목록 로드 실패:', e);
      }
    };
    fetchSessions();
  }, [workspaceId, sessionRefresh]);

  const handleCreateChannel = async () => {
    if (!channelModal) return;
    const name = channelModal.name.trim();
    const mode = channelModal.mode;
    setChannelModal(null);
    if (!name) return;
    try {
      const res = await apiClient.post(`/api/v1/chats/workspace/${workspaceId}/sessions`, {
        title: name,
        sessionType: 'TEAM_CHANNEL',
        channelMode: mode,
      });
      if (res.ok) {
        const data = await res.json();
        const newChannel = { id: data.sessionId, title: name, channelMode: mode };
        // 낙관적 업데이트: 서버 재조회 전에 즉시 목록에 추가
        setSessions(prev => ({ ...prev, teamChannels: [...prev.teamChannels, newChannel] }));
        onSelectTeamSession?.(data.sessionId, mode);
        // 이후 서버 목록과 동기화
        setSessionRefresh(n => n + 1);
      }
    } catch (e) {
      console.error('채팅방 생성 실패:', e);
    }
  };

  const handleCreatePersonalChat = async () => {
    if (cancelPersonalChatRef.current) { cancelPersonalChatRef.current = false; return; }
    const name = newPersonalChatName.trim();
    setCreatingPersonalChat(false);
    setNewPersonalChatName('');
    if (!name) return;
    try {
      const res = await apiClient.post(`/api/v1/chats/workspace/${workspaceId}/sessions`, {
        title: name,
        sessionType: 'PERSONAL',
        userId: currentUserId,
      });
      if (res.ok) {
        const data = await res.json();
        setSessionRefresh(n => n + 1);
        onSelectPrivateSession?.(data.sessionId);
      }
    } catch (e) {
      console.error('개인 채팅 생성 실패:', e);
    }
  };

  if (!isOpen) {
    return (
      <div style={{
        width: '32px', flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: '10px',
        borderRight: '1px solid #eee',
        boxShadow: '2px 0 8px rgba(0,0,0,0.04)',
        zIndex: 1,
      }}>
        <button
          onClick={() => { sessionStorage.setItem('sb_open', 'true'); setIsOpen(true); }}
          title="사이드바 열기"
          style={{ ...toggleBtnBase, fontSize: '15px', padding: '6px 4px' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#444'; e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#bbb'; e.currentTarget.style.background = 'transparent'; }}
        >»</button>
      </div>
    );
  }

  return (
    <div className="sidebar-cell" style={{
      width: `${width}px`, flexShrink: 0,
      padding: '0', display: 'flex', flexDirection: 'column',
      boxShadow: '2px 0 12px rgba(0,0,0,0.07)', zIndex: 1, position: 'relative',
    }}>

      {/* 상단: 로고 + 토글 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 14px 10px', flexShrink: 0,
        borderBottom: '1px solid #f0f0f0',
      }}>
        <img
          src={dativusLogo} alt="Dativus"
          onClick={() => navigate('/')}
          style={{ height: '22px', objectFit: 'contain', cursor: 'pointer', opacity: 0.85 }}
        />
        <button
          onClick={() => { sessionStorage.setItem('sb_open', 'false'); setIsOpen(false); }}
          title="사이드바 닫기"
          style={{ ...toggleBtnBase, fontSize: '15px', padding: '5px 7px' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#444'; e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#bbb'; e.currentTarget.style.background = 'transparent'; }}
        >«</button>
      </div>

      {/* 스크롤 영역 */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0 12px', display: 'flex', flexDirection: 'column' }}>

      {/* ── 팀 채팅방 요약 행 ── */}
      {(() => {
        const activeCh = sessions.teamChannels.find(ch => ch.id === teamSessionId);
        return (
          <div style={{ padding: '4px 10px' }}>
            <button
              onClick={() => setSubPanel(p => p === 'team' ? null : 'team')}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: subPanel === 'team' ? '#f0f0f8' : 'transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (subPanel !== 'team') e.currentTarget.style.background = '#f4f4f6'; }}
              onMouseLeave={e => { if (subPanel !== 'team') e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#999', letterSpacing: '0.07em', textTransform: 'uppercase', flexShrink: 0 }}>팀 채팅방</span>
              {activeCh && (
                <span style={{ fontSize: '12px', color: '#555', flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeCh.title}
                </span>
              )}
              <span style={{
                fontSize: '11px', color: subPanel === 'team' ? '#6366f1' : '#bbb',
                fontWeight: '700', flexShrink: 0, transition: 'color 0.15s',
                transform: subPanel === 'team' ? 'rotate(180deg)' : 'none',
                display: 'inline-block', transition: 'transform 0.2s, color 0.15s',
              }}>›</span>
            </button>
          </div>
        );
      })()}

      {/* ── 개인 AI 채팅 요약 행 ── */}
      {(() => {
        const activeChat = sessions.personalChats.find(c => c.id === privateSessionId);
        return (
          <div style={{ padding: '0 10px 4px' }}>
            <button
              onClick={() => setSubPanel(p => p === 'personal' ? null : 'personal')}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: subPanel === 'personal' ? '#f0f0f8' : 'transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (subPanel !== 'personal') e.currentTarget.style.background = '#f4f4f6'; }}
              onMouseLeave={e => { if (subPanel !== 'personal') e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'linear-gradient(135deg, #111, #555)', flexShrink: 0 }} />
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#999', letterSpacing: '0.07em', textTransform: 'uppercase', flexShrink: 0 }}>개인 AI 채팅</span>
              {activeChat && (
                <span style={{ fontSize: '12px', color: '#555', flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeChat.title}
                </span>
              )}
              <span style={{
                fontSize: '11px', color: subPanel === 'personal' ? '#555' : '#bbb',
                fontWeight: '700', flexShrink: 0,
                display: 'inline-block', transform: subPanel === 'personal' ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s, color 0.15s',
              }}>›</span>
            </button>
          </div>
        );
      })()}

      {/* ── 서브패널 (채널 목록 슬라이드) ── */}
      <div style={{
        position: 'absolute', top: 0, left: '100%', bottom: 0,
        width: '220px',
        background: '#fff',
        boxShadow: '4px 0 20px rgba(0,0,0,0.10)',
        zIndex: 20,
        display: 'flex', flexDirection: 'column',
        transform: subPanel ? 'translateX(0)' : 'translateX(-8px)',
        opacity: subPanel ? 1 : 0,
        pointerEvents: subPanel ? 'auto' : 'none',
        transition: 'transform 0.2s ease, opacity 0.2s ease',
        borderLeft: '1px solid #eee',
      }}>
        {/* 서브패널 헤더 */}
        <div style={{
          padding: '14px 16px 10px', borderBottom: '1px solid #f0f0f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
              background: subPanel === 'team'
                ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                : 'linear-gradient(135deg, #111, #555)',
            }} />
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#111' }}>
              {subPanel === 'team' ? '팀 채팅방' : '개인 AI 채팅'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {subPanel === 'team' && (
              <button
                onClick={() => setChannelModal({ name: '', mode: 'AI' })}
                title="새 채팅방"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: '18px', lineHeight: 1, padding: '0 4px', borderRadius: '4px', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#555'}
                onMouseLeave={e => e.currentTarget.style.color = '#bbb'}
              >+</button>
            )}
            {subPanel === 'personal' && !creatingPersonalChat && (
              <button
                onClick={() => setCreatingPersonalChat(true)}
                title="새 채팅"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: '18px', lineHeight: 1, padding: '0 4px', borderRadius: '4px', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#555'}
                onMouseLeave={e => e.currentTarget.style.color = '#bbb'}
              >+</button>
            )}
            <button
              onClick={() => setSubPanel(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '14px', lineHeight: 1, padding: '0 4px', borderRadius: '4px', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#555'}
              onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
            >✕</button>
          </div>
        </div>

        {/* 서브패널 목록 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }} className="channel-scroll">
          {subPanel === 'team' && (
            <>
              {sessions.teamChannels.length === 0 && (
                <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '12px', color: '#ccc' }}>채팅방이 없습니다</div>
              )}
              {sessions.teamChannels.map(ch => {
                const isActive = teamSessionId === ch.id;
                const isChat = ch.channelMode === 'CHAT';
                const accentColor = isChat ? '#3b82f6' : '#6366f1';
                return (
                  <div key={ch.id}
                    onClick={() => { onSelectTeamSession?.(ch.id, ch.channelMode || 'AI'); localStorage.setItem('lastTeamSessionId', ch.id); setSubPanel(null); }}
                    style={{
                      padding: '8px 10px 8px 12px', borderRadius: '8px', cursor: 'pointer',
                      backgroundColor: isActive ? '#111' : 'transparent',
                      color: isActive ? '#fff' : '#333',
                      fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
                      borderLeft: `2.5px solid ${isActive ? 'transparent' : accentColor + '55'}`,
                      marginBottom: '2px', transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.backgroundColor = '#f4f4f6'; e.currentTarget.style.borderLeftColor = accentColor; } }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderLeftColor = accentColor + '55'; } }}
                  >
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px',
                      background: isActive ? 'rgba(255,255,255,0.15)' : (isChat ? '#dbeafe' : '#ede9fe'),
                    }}>{isChat ? '💬' : '✦'}</div>
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isActive ? '600' : '400' }}>{ch.title}</span>
                    <span style={{
                      fontSize: '9px', fontWeight: '700', padding: '2px 5px', borderRadius: '4px', flexShrink: 0,
                      color: isActive ? 'rgba(255,255,255,0.6)' : (isChat ? '#2563eb' : '#7c3aed'),
                      background: isActive ? 'rgba(255,255,255,0.12)' : (isChat ? '#dbeafe' : '#ede9fe'),
                    }}>{isChat ? 'CHAT' : 'AI'}</span>
                  </div>
                );
              })}
            </>
          )}
          {subPanel === 'personal' && (
            <>
              {sessions.personalChats.map(chat => {
                const isActive = privateSessionId === chat.id;
                return (
                  <div key={chat.id}
                    onClick={() => { onSelectPrivateSession?.(chat.id); localStorage.setItem('lastPrivateSessionId', chat.id); setSubPanel(null); }}
                    style={{
                      padding: '8px 10px 8px 12px', borderRadius: '8px', cursor: 'pointer',
                      backgroundColor: isActive ? '#111' : 'transparent',
                      color: isActive ? '#fff' : '#333',
                      fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
                      borderLeft: `2.5px solid ${isActive ? 'transparent' : '#33333322'}`,
                      marginBottom: '2px', transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.backgroundColor = '#f4f4f6'; e.currentTarget.style.borderLeftColor = '#333'; } }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderLeftColor = '#33333322'; } }}
                  >
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px',
                      background: isActive ? 'rgba(255,255,255,0.15)' : '#f0f0f0',
                    }}>✦</div>
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isActive ? '600' : '400' }}>{chat.title}</span>
                  </div>
                );
              })}
              {creatingPersonalChat && (
                <input
                  autoFocus
                  value={newPersonalChatName}
                  onChange={e => setNewPersonalChatName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreatePersonalChat();
                    if (e.key === 'Escape') { cancelPersonalChatRef.current = true; setCreatingPersonalChat(false); setNewPersonalChatName(''); }
                  }}
                  onBlur={handleCreatePersonalChat}
                  placeholder="채팅 이름..."
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '8px 10px', borderRadius: '8px',
                    border: '1.5px solid #6366f1', fontSize: '12px', outline: 'none',
                    marginTop: '4px', color: '#111',
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* ── 채널 생성 모달 ── */}
      {channelModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(2px)',
        }}
          onClick={() => setChannelModal(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: '18px',
              padding: '0', width: '310px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#111' }}>새 채팅방 만들기</div>
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '3px' }}>이름과 타입을 선택하세요</div>
            </div>
            <div style={{ padding: '18px 22px 20px' }}>
              <input
                autoFocus
                value={channelModal.name}
                onChange={e => setChannelModal(prev => ({ ...prev, name: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateChannel(); if (e.key === 'Escape') setChannelModal(null); }}
                placeholder="채팅방 이름을 입력하세요"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: '10px', border: '1.5px solid #e8e8e8', fontSize: '13px', outline: 'none', marginBottom: '16px', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = '#6366f1'}
                onBlur={e => e.target.style.borderColor = '#e8e8e8'}
              />
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {[
                  { mode: 'AI',   accent: '#6366f1', bg: '#ede9fe', icon: '✦', label: 'AI 채팅방',  desc: 'AI가 자동으로 응답' },
                  { mode: 'CHAT', accent: '#3b82f6', bg: '#dbeafe', icon: '💬', label: '팀 채팅방', desc: '팀원끼리 자유 채팅' },
                ].map(opt => {
                  const selected = channelModal.mode === opt.mode;
                  return (
                    <button key={opt.mode}
                      onClick={() => setChannelModal(prev => ({ ...prev, mode: opt.mode }))}
                      style={{
                        flex: 1, padding: '12px 8px', borderRadius: '12px', cursor: 'pointer',
                        border: selected ? `2px solid ${opt.accent}` : '2px solid #f0f0f0',
                        background: selected ? opt.bg : '#fafafa',
                        transition: 'all 0.15s', textAlign: 'center',
                      }}
                    >
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '10px',
                        background: selected ? opt.accent : '#e8e8e8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '14px', margin: '0 auto 8px', color: '#fff',
                        transition: 'background 0.15s',
                      }}>{opt.icon}</div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: selected ? opt.accent : '#333' }}>{opt.label}</div>
                      <div style={{ fontSize: '10px', color: '#999', marginTop: '3px', lineHeight: 1.4 }}>{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setChannelModal(null)}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#666', fontWeight: '500' }}
                >취소</button>
                <button onClick={handleCreateChannel} disabled={!channelModal.name.trim()}
                  style={{
                    flex: 2, padding: '10px', borderRadius: '10px', border: 'none',
                    background: channelModal.name.trim()
                      ? (channelModal.mode === 'AI' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'linear-gradient(135deg, #3b82f6, #2563eb)')
                      : '#e8e8e8',
                    color: channelModal.name.trim() ? '#fff' : '#aaa',
                    cursor: channelModal.name.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '13px', fontWeight: '700', transition: 'background 0.2s',
                  }}
                >채팅방 만들기</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: '1px', background: '#f0f0f0', margin: '4px 10px 8px' }} />

      {/* 기존 접이식 섹션 */}
      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

      {/* 1. 지식 베이스 */}
      <Section title="지식 베이스" defaultOpen={true} storageKey="knowledge">
        <button onClick={() => setIsUploadOpen(true)} style={{
          padding: '10px', backgroundColor: '#fff',
          border: '2px dashed #333', borderRadius: '8px',
          cursor: 'pointer', fontWeight: 'bold', color: '#111', fontSize: '13px',
        }}>
          문서 업로드
        </button>
        <button onClick={() => setIsDocManagerOpen(true)} style={{
          padding: '10px', backgroundColor: '#fff',
          border: '1px solid #ccc', borderRadius: '8px',
          cursor: 'pointer', fontWeight: 'bold', color: '#333', fontSize: '13px',
        }}>
          문서 관리
        </button>
      </Section>

      {/* 2. 커스텀 에이전트 */}
      <Section title="커스텀 에이전트" badge={agentList.length > 0 ? agentList.length : null} defaultOpen={true} storageKey="agents">
        <button onClick={() => setIsAgentCreateOpen(true)} style={{
          padding: '9px', background: '#000', color: '#fff',
          border: 'none', borderRadius: '6px', cursor: 'pointer',
          fontSize: '12px', fontWeight: 'bold',
        }}>
          + 새 에이전트 추가
        </button>
        {agentList.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#aaa', textAlign: 'center', padding: '8px 0' }}>등록된 에이전트가 없습니다.</div>
        ) : (
          agentList.map(agent => (
            <div key={agent.id} style={{ padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px solid #e8e8e8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{agent.name}</div>
                  <div style={{ fontSize: '11px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent.description}</div>
                  <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>임계값 {(agent.threshold ?? 0.38).toFixed(2)}</div>
                </div>
                <div style={{ display: 'flex', gap: '4px', marginLeft: '6px', flexShrink: 0 }}>
                  <button onClick={() => onEditAgent(agent)}
                    style={{ background: 'none', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', padding: '2px 5px' }}>편집</button>
                  <button onClick={() => handleDeleteAgent(agent.id)}
                    style={{ background: 'none', border: '1px solid #ffcccc', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', padding: '2px 5px', color: '#e53935' }}>삭제</button>
                </div>
              </div>
            </div>
          ))
        )}
      </Section>

      {/* 3. 팀 관리 */}
      <Section title="팀 관리" storageKey="team_manage">
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#888', marginBottom: '2px' }}>새 팀 만들기</div>
        <input
          type="text" placeholder="팀 이름 입력" value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          style={{ padding: '9px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px', outline: 'none' }}
        />
        <button onClick={handleCreateTeam} style={{
          padding: '9px', backgroundColor: '#000', color: '#fff',
          border: 'none', borderRadius: '6px', cursor: 'pointer',
          fontWeight: 'bold', fontSize: '12px',
        }}>
          팀 생성 후 합류
        </button>

        <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />

        <div style={{ fontSize: '11px', fontWeight: '600', color: '#888', marginBottom: '2px' }}>초대 코드로 합류</div>
        <input
          type="text" placeholder="6자리 코드 입력" value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          style={{ padding: '9px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px', outline: 'none' }}
        />
        <button onClick={() => handleJoinTeam()} style={{
          padding: '9px', backgroundColor: '#fff', color: '#000',
          border: '2px solid #000', borderRadius: '6px', cursor: 'pointer',
          fontWeight: 'bold', fontSize: '12px',
        }}>
          입장하기
        </button>
      </Section>

      {/* 4. 소속 팀 */}
      <Section title="소속 팀" badge={workspaces.length > 0 ? workspaces.length : null} defaultOpen={true} storageKey="workspaces">
        {workspaces.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#aaa', textAlign: 'center', padding: '8px 0' }}>소속된 팀이 없습니다.</div>
        ) : (
          workspaces.map((ws) => (
            <div
              key={ws.id}
              onClick={() => { localStorage.setItem('workspace_id', ws.id); window.location.reload(); }}
              style={{
                padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                backgroundColor: workspaceId === ws.id ? '#111' : '#f9f9f9',
                border: workspaceId === ws.id ? '1.5px solid #111' : '1px solid #e8e8e8',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '13px', color: workspaceId === ws.id ? '#fff' : '#111' }}>{ws.name}</div>
              <div style={{ fontSize: '11px', color: workspaceId === ws.id ? 'rgba(255,255,255,0.5)' : '#aaa', marginTop: '3px' }}>초대 코드: {ws.inviteCode}</div>
            </div>
          ))
        )}
      </Section>

      </div>{/* /기존 섹션 wrap */}

      </div>{/* /스크롤 영역 */}

      {/* 하단: 마이페이지 / 로그아웃 */}
      <div style={{
        padding: '10px 14px 14px', flexShrink: 0,
        borderTop: '1px solid #f0f0f0',
        display: 'flex', flexDirection: 'column', gap: '6px',
      }}>
        <button
          onClick={() => navigate('/mypage')}
          style={{
            width: '100%', padding: '9px', borderRadius: '8px',
            border: '1px solid #e0e0e0', background: '#fff',
            cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#333',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
        >마이페이지</button>
        <button
          onClick={() => apiClient.logout()}
          style={{
            width: '100%', padding: '9px', borderRadius: '8px',
            border: 'none', background: '#f5f5f5',
            cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#888',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#ffe5e5'; e.currentTarget.style.color = '#e53935'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.color = '#888'; }}
        >로그아웃</button>
      </div>

    </div>
  );
}

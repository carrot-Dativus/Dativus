import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../api/axiosInstance';
import { useTeamSync } from './useTeamSync';

const AI_BASE_URL = import.meta.env.VITE_AI_BASE_URL || '';


// ── localStorage 캐시 헬퍼 ──────────────────────────────────────────────────
// v3: v2 테스트 도중 오염된 캐시를 추가 무효화
const CACHE_VERSION = 'v3';
const sessionCacheKey = (sessionId) => `dativus_chat_${CACHE_VERSION}_${sessionId}`;

function saveMsgs(key, msgs) {
  try { localStorage.setItem(key, JSON.stringify(msgs)); } catch {}
}
function loadMsgs(key) {
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : null; } catch { return null; }
}

// ── DB 응답 변환 (캐시가 없을 때만 사용) ────────────────────────────────────
function transformMsg(msg) {
  const senderType = msg.senderType ?? (msg.sender === 'user' ? 'USER' : 'LOCAL_AI');
  const senderName = msg.senderName ?? '';
  const content    = msg.content ?? msg.text ?? '';
  return {
    sender:    senderType === 'USER' ? 'user' : senderName.startsWith('AGENT:') ? 'custom_agent' : 'ai',
    text:      content,
    agentName: senderName.startsWith('AGENT:') ? senderName.slice(6) : undefined,
    senderName: senderType === 'USER' ? senderName : undefined,
  };
}

function sortAndTransform(data) {
  const list = Array.isArray(data) ? [...data] : [];
  list.sort((a, b) => {
    // 1순위: createdAt (턴 간 순서)
    if (a.createdAt && b.createdAt) {
      const dt = new Date(a.createdAt) - new Date(b.createdAt);
      if (dt !== 0) return dt;
    }
    // 2순위: messageOrder (같은 턴 내 순서 — 0=사용자, 1=AI, 2+=에이전트)
    if (a.messageOrder != null && b.messageOrder != null && a.messageOrder !== b.messageOrder)
      return a.messageOrder - b.messageOrder;
    // 3순위: id
    if (a.id != null && b.id != null) return a.id - b.id;
    return 0;
  });
  return list.map(transformMsg);
}

// teamSessionId: 팀 탭에서 보여줄 세션 (팀 채팅방 선택)
// privateSessionId: 개인 공간 탭에서 보여줄 세션 (개인 AI 채팅 선택)
export function useChatSession(workspaceId, currentUserId, teamSessionId, privateSessionId) {
  // ── 팀 메시지: 세션별 맵 { sessionId → messages[] } ─────────────────────
  const [teamMsgMap, setTeamMsgMap] = useState({});
  const messages = teamMsgMap[teamSessionId] || [];

  // ── 개인 메시지: 팀과 동일한 방식으로 세션별 맵 사용 ───────────────────────
  // 단일 배열로 관리하면 개인 세션 전환 시 스트리밍 중인 답변이 새 세션에 덮어씌워지는 버그 발생
  const [privateMsgMap, setPrivateMsgMap] = useState({});
  const privateMessages = privateMsgMap[privateSessionId] || [];
  const [agentLogs, setAgentLogs] = useState([]);
  const [graphHitNodes, setGraphHitNodes] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [clarifyData, setClarifyData] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentTrace, setCurrentTrace] = useState('');
  const [currentRoute, setCurrentRoute] = useState('');
  const [groqWarning, setGroqWarning] = useState(null);
  const [graphPendingCount, setGraphPendingCount] = useState(null);

  // 항상 올바른 sessionId 슬롯에 씁니다 (세션 전환 후에도 정확한 방에 저장)
  const setSessionMsgs = useCallback((sessionId, updater) => {
    setTeamMsgMap(prev => ({
      ...prev,
      [sessionId]: typeof updater === 'function' ? updater(prev[sessionId] || []) : updater,
    }));
  }, []);

  const setPrivateSessionMsgs = useCallback((sessionId, updater) => {
    setPrivateMsgMap(prev => ({
      ...prev,
      [sessionId]: typeof updater === 'function' ? updater(prev[sessionId] || []) : updater,
    }));
  }, []);

  // 팀 탭 실시간 동기화 (WebSocket) — 현재 선택된 채널 메시지만 수신
  const teamSessionIdRef = useRef(teamSessionId);
  useEffect(() => { teamSessionIdRef.current = teamSessionId; }, [teamSessionId]);
  const privateSessionIdRef = useRef(privateSessionId);
  useEffect(() => { privateSessionIdRef.current = privateSessionId; }, [privateSessionId]);

  const handleTeamMessage = useCallback((msg) => {
    if (teamSessionIdRef.current && msg.sessionId && msg.sessionId !== teamSessionIdRef.current) return;
    if (msg.type === 'canvas_update') {
      setDashboardData(msg.data);
      return;
    }
    setSessionMsgs(teamSessionIdRef.current, prev => [...prev, { ...msg, senderName: msg.senderName || '' }]);
  }, [setSessionMsgs]);
  useTeamSync(workspaceId, currentUserId, handleTeamMessage);

  // "로드 완료" ref — 세션 전환 중에는 null로 두어 잘못된 캐시 저장 방지
  const teamLoadedRef = useRef(null);
  const privateLoadedRef = useRef(null);
  // 이미 맵에 로드된 세션 추적 — 재로드 방지 (스트리밍 중인 세션 보존)
  const teamLoadedSet = useRef(new Set());
  const privateLoadedSet = useRef(new Set());

  // 팀 세션 전환 → 캔버스 복원 + 메시지 로드
  // setMessages([]) 없이 teamMsgMap의 해당 슬롯으로 전환만 합니다
  useEffect(() => {
    setDashboardData(null);
    teamLoadedRef.current = null;
    if (!teamSessionId) return;

    // 이 채널에 저장된 캔버스 복원
    apiClient.get(`/api/v1/chats/session/${teamSessionId}/canvas`)
      .then(res => (res.ok && res.status !== 204) ? res.json() : null)
      .then(data => { if (data) setDashboardData(data); })
      .catch(() => {});

    // 이미 로드(또는 스트리밍 중)인 세션이면 ref만 업데이트하고 종료
    if (teamLoadedSet.current.has(teamSessionId)) {
      teamLoadedRef.current = teamSessionId;
      return;
    }

    const key = `${sessionCacheKey(teamSessionId)}_team`;
    const cached = loadMsgs(key);
    if (cached?.length > 0) {
      teamLoadedSet.current.add(teamSessionId);
      teamLoadedRef.current = teamSessionId;
      setSessionMsgs(teamSessionId, cached);
      return;
    }
    apiClient.get(`/api/v1/chats/session/${teamSessionId}/messages?isPrivate=false`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        teamLoadedSet.current.add(teamSessionId);
        teamLoadedRef.current = teamSessionId;
        // 이미 사용자가 메시지를 보냈으면 덮어쓰지 않음 (DB 로드와의 경쟁 조건 방지)
        setTeamMsgMap(prev => {
          if (prev[teamSessionId]?.length > 0) return prev;
          return { ...prev, [teamSessionId]: sortAndTransform(data) };
        });
      })
      .catch(err => console.error(err));
  }, [teamSessionId]);

  // 개인 세션 전환 → 팀과 동일하게 맵 방식으로 관리 (초기화 없음)
  useEffect(() => {
    privateLoadedRef.current = null;
    if (!privateSessionId) return;

    if (privateLoadedSet.current.has(privateSessionId)) {
      privateLoadedRef.current = privateSessionId;
      return;
    }

    const key = sessionCacheKey(privateSessionId);
    const cached = loadMsgs(key);
    if (cached?.length > 0) {
      privateLoadedSet.current.add(privateSessionId);
      privateLoadedRef.current = privateSessionId;
      setPrivateSessionMsgs(privateSessionId, cached);
      return;
    }
    apiClient.get(`/api/v1/chats/session/${privateSessionId}/messages?isPrivate=true`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        privateLoadedSet.current.add(privateSessionId);
        privateLoadedRef.current = privateSessionId;
        setPrivateMsgMap(prev => {
          if (prev[privateSessionId]?.length > 0) return prev;
          return { ...prev, [privateSessionId]: sortAndTransform(data) };
        });
      })
      .catch(err => console.error(err));
  }, [privateSessionId]);

  // 캐시 저장 — 로드 완료된 세션만 저장 (전환 중 잘못된 키로 저장 방지)
  useEffect(() => {
    const last = messages[messages.length - 1];
    const hasEmptyAI = last?.sender === 'ai' && last?.text === '';
    if (teamSessionId && teamSessionId === teamLoadedRef.current && messages.length > 0 && !hasEmptyAI)
      saveMsgs(`${sessionCacheKey(teamSessionId)}_team`, messages);
  }, [messages, teamSessionId]);

  useEffect(() => {
    const lastP = privateMessages[privateMessages.length - 1];
    const hasEmptyAIPrivate = lastP?.sender === 'ai' && lastP?.text === '';
    if (privateSessionId && privateSessionId === privateLoadedRef.current && privateMessages.length > 0 && !hasEmptyAIPrivate)
      saveMsgs(sessionCacheKey(privateSessionId), privateMessages);
  }, [privateMessages, privateSessionId]);

  // 메시지 전송 + AI 스트리밍
  const sendMessage = async ({ userQuery, currentTab, selectedAgent, agentList = [], existingDashboard = null, channelMode = 'AI' }) => {
    const isPrivateMode = currentTab === 'PRIVATE';
    const isChatOnly = channelMode === 'CHAT';
    const activeSessionId = isPrivateMode ? privateSessionId : teamSessionId;
    if (!userQuery.trim() || !activeSessionId) return;

    const personaMemo = localStorage.getItem('persona_memo') || '';
    const personaExpertise = localStorage.getItem('persona_expertise') || '';
    const personaTone = localStorage.getItem('persona_tone') || '';
    const personaDecisionStyle = localStorage.getItem('persona_decision_style') || '';
    const myName = localStorage.getItem('username') || '팀원';

    // sentSessionId: 이 요청이 시작된 세션 (변하지 않음)
    const sentSessionId = activeSessionId;
    // setTargetMsgs: 항상 sentSessionId 슬롯에 씁니다
    // → 사용자가 다른 방으로 이동해도 원래 방의 메시지를 정확히 업데이트
    const setTargetMsgs = isPrivateMode
      ? (updater) => setPrivateSessionMsgs(sentSessionId, updater)
      : (updater) => setSessionMsgs(sentSessionId, updater);

    const currentMessageArray = isPrivateMode
      ? (privateMsgMap[sentSessionId] || [])
      : (teamMsgMap[sentSessionId] || []);

    setTargetMsgs(prev => [...prev, { sender: 'user', text: userQuery, senderName: myName }]);
    if (!isChatOnly) setTargetMsgs(prev => [...prev, { sender: 'ai', text: '' }]);

    // 사용자 메시지 DB 저장
    const userMsgSavePromise = apiClient.post('/api/v1/chats/messages', {
      sessionId: activeSessionId,
      userId: currentUserId || '',
      senderType: 'USER',
      senderName: myName,
      content: userQuery.replace(/^\[skip\]\s*/g, ''),
      isPrivate: isPrivateMode,
      latency: 0,
      tokens: 0,
      messageOrder: 0,
    }).catch(e => console.warn('사용자 메시지 저장 실패:', e));

    // 팀 채팅 전용 채널: DB 저장만 하고 AI 호출 없이 종료
    if (isChatOnly) {
      await userMsgSavePromise;
      return;
    }

    let aiFullText = '';              // 메인 답변 (DB 저장용)
    let inMultiAgent = false;         // 다중 에이전트 스트리밍 중 여부
    let currentAgentName = '';        // 현재 스트리밍 중인 에이전트 이름
    let currentAgentText = '';        // 현재 에이전트 누적 텍스트
    let completedAgentResponses = []; // 완료된 에이전트 응답 [{name, text}]
    let finalLatency = 0.0;
    let finalTokens = 0;

    // 격리구역 1: AI 스트리밍
    setIsStreaming(true);
    setCurrentTrace('');
    setCurrentRoute('');
    setAgentLogs([]);
    setGraphHitNodes([]);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${AI_BASE_URL}/api/v1/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          query: userQuery,
          session_id: activeSessionId,
          workspace_id: localStorage.getItem('workspace_id'),
          history: currentMessageArray.slice(-4).map(m => ({
            role: m.sender === 'user' ? 'user' : 'ai',
            content: (m.text || m.content || '').slice(0, 400),
          })),
          force_agent: selectedAgent?._builtin ? selectedAgent.id : null,
          target_agent_name: (!selectedAgent?._builtin && selectedAgent?.name) ? selectedAgent.name : null,
          target_agent_prompt: (!selectedAgent?._builtin && selectedAgent?.description) ? selectedAgent.description : null,
          target_agent_type: (!selectedAgent?._builtin && selectedAgent?.agentType) ? selectedAgent.agentType : null,
          custom_agents_list: (!selectedAgent && agentList.length > 0)
            ? agentList.filter(a => !a._builtin).map(a => ({ name: a.name, description: a.description, threshold: a.threshold ?? 0.38, agent_type: a.agentType ?? 'EXTERNAL_API' }))
            : [],
          persona_expertise: personaExpertise,
          persona_tone: personaTone,
          persona_decision_style: personaDecisionStyle,
          persona_memo: personaMemo,
          existing_dashboard: existingDashboard ?? null,
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let sseBuffer = '';  // 청크 경계에서 잘린 이벤트를 보관하는 버퍼
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const events = sseBuffer.split('\n\n');
        sseBuffer = events.pop() ?? '';  // 마지막 불완전한 조각은 다음 청크까지 보관

        // 현재 보고 있는 세션 == 스트리밍 세션일 때만 표시용 상태(trace, logs 등) 업데이트
        const viewingId = isPrivateMode ? privateSessionIdRef.current : teamSessionIdRef.current;
        const showUI = viewingId === sentSessionId;

        for (const event of events) {
          // 멀티라인 SSE 지원: 이벤트 내 모든 data: 필드를 \n으로 합산
          const dataLines = event.split('\n')
            .filter(l => l.startsWith('data: '))
            .map(l => l.substring(6));
          if (dataLines.length === 0) continue;
          const dataText = dataLines.join('\n').replace(/\n$/, '');

          if (dataText === '[DONE]') { streamDone = true; break; }
          if (dataText.startsWith('[CLARIFY]')) {
            try {
              const parsed = JSON.parse(dataText.substring(9));
              if (showUI) setClarifyData({ ...parsed, originalQuery: userQuery });
              setTargetMsgs(prev => {
                const msgs = [...prev];
                msgs[msgs.length - 1].text = `💬 ${parsed.question}`;
                return msgs;
              });
            } catch (e) {
              console.warn('CLARIFY 파싱 실패:', e);
            }
          } else if (dataText.startsWith('[DASHBOARD]')) {
            try {
              const parsed = JSON.parse(dataText.substring(11));
              if (showUI) setDashboardData(parsed);
              // 팀 채널: 백엔드에 저장 → 다른 팀원에게 WS 브로드캐스트
              if (!isPrivateMode) {
                apiClient.put(`/api/v1/chats/session/${activeSessionId}/canvas`, parsed).catch(() => {});
              }
            } catch (e) {
              console.warn('대시보드 JSON 파싱 실패:', e);
            }
          } else if (dataText.startsWith('[ROUTE]')) {
            const routeKey = dataText.substring(7);
            if (showUI) setCurrentRoute(routeKey);
            const routeLabels = { general_agent: '일반', expert_agent: '전문가', coding_math_agent: '코딩/수학' };
            const routeLabel = routeLabels[routeKey] || '일반';
            apiClient.post('/api/v1/agents/usage', {
              userId: currentUserId,
              workspaceId,
              agentName: routeLabel,
            }).catch(() => {});
          } else if (dataText.startsWith('[WARN]')) {
            if (showUI) setGroqWarning(dataText.substring(6));
          } else if (dataText.startsWith('[GRAPH_PENDING]')) {
            const count = parseInt(dataText.substring(15), 10);
            if (showUI && !isNaN(count) && count > 0) setGraphPendingCount(count);
          } else if (dataText.startsWith('[GRAPH_HIT]')) {
            const hits = dataText.substring(11).split(',').map(s => s.trim()).filter(Boolean);
            if (showUI && hits.length > 0) setGraphHitNodes(hits);
          } else if (dataText.startsWith('[LOG]')) {
            const logMsg = dataText.substring(5);
            if (showUI) {
              setAgentLogs(prev => [...prev, logMsg]);
              if (aiFullText === '') setCurrentTrace(logMsg);
            }
            if (logMsg.includes('소요 시간:')) {
              finalLatency = parseFloat(logMsg.match(/소요 시간:\s*([\d.]+)초/)?.[1] || 0);
              finalTokens = parseInt(logMsg.match(/소모 토큰:\s*(\d+)/)?.[1] || 0);
            }
          } else if (dataText.startsWith('[AGENT_START:')) {
            if (currentAgentName && currentAgentText) {
              completedAgentResponses.push({ name: currentAgentName, text: currentAgentText });
            }
            const agentName = dataText.slice(13, -1);
            inMultiAgent = true;
            currentAgentName = agentName;
            currentAgentText = '';
            setTargetMsgs(prev => [...prev, { sender: 'custom_agent', agentName, text: '' }]);
          } else if (dataText === '[AGENT_END]') {
            if (currentAgentName && currentAgentText) {
              completedAgentResponses.push({ name: currentAgentName, text: currentAgentText });
              currentAgentName = '';
              currentAgentText = '';
            }
          } else {
            if (showUI && aiFullText === '' && !inMultiAgent) setCurrentTrace('');
            const chunk = dataText === '' ? '\n' : dataText;
            if (!inMultiAgent) {
              aiFullText += chunk;
              setTargetMsgs(prev => {
                if (prev.length === 0) return [{ sender: 'ai', text: aiFullText }];
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1].text = aiFullText;
                return newMsgs;
              });
            } else {
              currentAgentText += chunk;
              setTargetMsgs(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1] = {
                  ...newMsgs[newMsgs.length - 1],
                  text: newMsgs[newMsgs.length - 1].text + chunk,
                };
                return newMsgs;
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('스트리밍 에러:', error);
      if (aiFullText.length === 0) {
        setTargetMsgs(prev => {
          if (prev.length === 0) return [{ sender: 'ai', text: '🚨 서버 통신 오류 발생!' }];
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1].text = '🚨 서버 통신 오류 발생!';
          return newMsgs;
        });
      }
    } finally {
      setIsStreaming(false);
      setCurrentTrace('');
    }

    // 격리구역 2: DB 저장
    if (!aiFullText) return;
    await userMsgSavePromise;
    let msgOrder = 1;
    try {
      await apiClient.post('/api/v1/chats/messages', {
        sessionId: activeSessionId,
        userId: currentUserId || '',
        senderType: 'LOCAL_AI',
        senderName: 'AI 어시스턴트',
        content: aiFullText,
        isPrivate: isPrivateMode,
        latency: finalLatency,
        tokens: finalTokens,
        messageOrder: msgOrder,
      });
    } catch (e) {
      console.warn('DB 저장만 실패했습니다 (답변은 보존됨):', e);
    }
    for (const agent of completedAgentResponses) {
      msgOrder += 1;
      try {
        await apiClient.post('/api/v1/chats/messages', {
          sessionId: activeSessionId,
          userId: currentUserId || '',
          senderType: 'LOCAL_AI',
          senderName: `AGENT:${agent.name}`,
          content: agent.text,
          isPrivate: isPrivateMode,
          latency: 0,
          tokens: 0,
          messageOrder: msgOrder,
        });
      } catch (e) {
        console.warn(`에이전트 메시지 저장 실패 (${agent.name}):`, e);
      }
    }
  };

  // 팀 공유
  const shareToTeam = async ({ sessionId: sid, content, currentUserId: uid }) => {
    try {
      await apiClient.post('/api/v1/chats/messages', {
        sessionId: sid,
        userId: uid,
        senderType: 'LOCAL_AI',
        senderName: 'AI 공유 브리핑',
        content,
        isPrivate: false,
      });
      setSessionMsgs(sid, prev => [...prev, { sender: 'ai', text: `[팀원 공유 메모]\n${content}` }]);
      alert('팀에 공유되었습니다!');
    } catch {
      alert('공유 실패!');
    }
  };

  // 피드백
  const sendFeedback = async ({ workspaceId: wsId, userId, query, answer, isPositive }) => {
    try {
      await apiClient.post('/api/v1/feedback', { workspaceId: wsId, userId, query, answer, isPositive });
    } catch (error) {
      console.error('피드백 전송 실패:', error);
    }
  };

  const flushPendingGraph = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${AI_BASE_URL}/api/v1/graph/flush-pending`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setGraphPendingCount(null);
      return data;
    } catch (e) {
      console.error('flush pending graph 실패:', e);
    }
  };

  const removeMessage = useCallback((msg, isPrivate) => {
    if (isPrivate) {
      setPrivateSessionMsgs(privateSessionIdRef.current, prev => prev.filter(m => m !== msg));
    } else {
      setSessionMsgs(teamSessionIdRef.current, prev => prev.filter(m => m !== msg));
    }
  }, [setSessionMsgs, setPrivateSessionMsgs]);

  const resetDashboard = () => setDashboardData(null);

  return {
    sessionId: teamSessionId,  // 팀 공유 등 기존 코드 호환용
    messages,
    privateMessages,
    agentLogs,
    graphHitNodes,
    dashboardData,
    clarifyData,
    setClarifyData,
    groqWarning,
    setGroqWarning,
    graphPendingCount,
    setGraphPendingCount,
    flushPendingGraph,
    sendMessage,
    shareToTeam,
    sendFeedback,
    removeMessage,
    isStreaming,
    currentTrace,
    currentRoute,
    resetDashboard,
  };
}

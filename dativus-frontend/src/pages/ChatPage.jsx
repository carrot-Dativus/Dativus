import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosInstance';

import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import CanvasArea from '../components/CanvasArea';
import UploadModal from '../components/modals/UploadModal';
import DocManagerModal from '../components/modals/DocManagerModal';
import AgentCreateModal from '../components/modals/AgentCreateModal';
import GraphPanel from '../components/GraphPanel';

import { useChatSession } from '../hooks/useChatSession';
import { useWorkspace } from '../hooks/useWorkspace';
import { useDocuments } from '../hooks/useDocuments';
import { useAgents } from '../hooks/useAgents';

function ResizeDivider({ onMouseDown }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '4px', flexShrink: 0, cursor: 'col-resize', zIndex: 10,
        backgroundColor: hovered ? 'rgba(0,0,0,0.15)' : 'transparent',
        transition: 'background-color 0.2s',
      }}
    />
  );
}

export default function ChatPage() {
  const navigate = useNavigate();

  const currentUserId = localStorage.getItem('user_id') || '';
  const workspaceId = localStorage.getItem('workspace_id');

  // --- 모달 열림/닫힘 상태 (UI 제어만) ---
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDocManagerOpen, setIsDocManagerOpen] = useState(false);
  const [isAgentCreateOpen, setIsAgentCreateOpen] = useState(false);
  const [isAgentEditOpen, setIsAgentEditOpen] = useState(false);

  // --- 패널 크기 조절 ---
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [canvasWidth, setCanvasWidth] = useState(420);
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [graphWidth, setGraphWidth] = useState(380);
  const handleToggleGraph = useCallback(() => setIsGraphOpen(v => !v), []);

  const startSidebarResize = useCallback((e) => {
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev) => setSidebarWidth(Math.max(180, Math.min(440, startW + ev.clientX - startX)));
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  const startCanvasResize = useCallback((e) => {
    const startX = e.clientX;
    const startW = canvasWidth;
    const onMove = (ev) => setCanvasWidth(Math.max(240, Math.min(700, startW - (ev.clientX - startX))));
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [canvasWidth]);

  const startGraphResize = useCallback((e) => {
    const startX = e.clientX;
    const startW = graphWidth;
    const onMove = (ev) => setGraphWidth(Math.max(240, Math.min(700, startW - (ev.clientX - startX))));
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [graphWidth]);

  // --- 사이드바 ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    try {
      const saved = sessionStorage.getItem('sb_open');
      return saved !== null ? saved === 'true' : true;
    } catch { return true; }
  });

  // --- 선택된 세션 (탭별 독립 관리) ---
  const [teamSessionId, setTeamSessionId] = useState(null);     // 팀 탭에서 볼 세션
  const [teamChannelMode, setTeamChannelMode] = useState('AI'); // 현재 팀 채널의 채팅 모드
  const [privateSessionId, setPrivateSessionId] = useState(null); // 개인 탭에서 볼 세션

  // --- 탭 / 입력창 ---
  const [currentTab, setCurrentTab] = useState('TEAM');
  const [input, setInput] = useState('');

  // --- 캔버스 (PRIVATE / TEAM 분리) ---
  const [privateCanvas, setPrivateCanvas] = useState(() => {
    try { return { isOpen: false, data: JSON.parse(localStorage.getItem('canvas_private') || 'null') }; }
    catch { return { isOpen: false, data: null }; }
  });
  const [teamCanvas, setTeamCanvas] = useState(() => {
    try { return { isOpen: false, data: JSON.parse(localStorage.getItem('canvas_team') || 'null') }; }
    catch { return { isOpen: false, data: null }; }
  });

  const panelCanvases = { PRIVATE: privateCanvas, TEAM: teamCanvas };

  const handleToggleCanvas = (tab) => {
    if (tab === 'PRIVATE') setPrivateCanvas(prev => ({ ...prev, isOpen: !prev.isOpen }));
    else setTeamCanvas(prev => ({ ...prev, isOpen: !prev.isOpen }));
  };

  // 현재 탭 기준 활성 캔버스 (CanvasArea에 전달)
  const activeCanvas = currentTab === 'PRIVATE' ? privateCanvas : teamCanvas;
  const isCanvasOpen = activeCanvas.isOpen;
  const canvasData = activeCanvas.data;
  const setIsCanvasOpen = (open) => {
    if (currentTab === 'PRIVATE') setPrivateCanvas(prev => ({ ...prev, isOpen: open }));
    else setTeamCanvas(prev => ({ ...prev, isOpen: open }));
  };

  // currentTab ref — dashboardData effect 스테일 클로저 방지
  const currentTabRef = useRef(currentTab);
  useEffect(() => { currentTabRef.current = currentTab; }, [currentTab]);

  // --- 스크롤 ---
  const chatEndRef = useRef(null);
  const logEndRef = useRef(null);

  // =========================================================================
  // 커스텀 훅 조립
  // =========================================================================
  const {
    sessionId,
    messages, privateMessages, agentLogs,
    graphHitNodes,
    dashboardData,
    clarifyData, setClarifyData,
    groqWarning, setGroqWarning,
    graphPendingCount, setGraphPendingCount, flushPendingGraph,
    sendMessage, shareToTeam, sendFeedback, removeMessage,
    isStreaming, currentTrace, currentRoute,
    resetDashboard,
  } = useChatSession(workspaceId, currentUserId, teamSessionId, privateSessionId);

  const [graphPendingProcessing, setGraphPendingProcessing] = useState(false);

  const handleFlushPendingGraph = async () => {
    setGraphPendingProcessing(true);
    try {
      const result = await flushPendingGraph();
      if (result?.processed_items > 0) {
        alert(`🕸️ 지식 그래프 처리 완료!\n${result.processed_items}건 처리 → ${result.saved_triples}개 트리플 저장`);
      } else {
        alert('처리할 항목이 없거나 Groq 한도가 소진되어 처리하지 못했습니다.');
        setGraphPendingCount(null);
      }
    } finally {
      setGraphPendingProcessing(false);
    }
  };

  // 대시보드 데이터 수신 시 현재 탭 캔버스에 저장 + 자동 오픈 (ref로 스테일 클로저 방지)
  useEffect(() => {
    if (!dashboardData) return;
    if (currentTabRef.current === 'PRIVATE') {
      setPrivateCanvas({ isOpen: true, data: dashboardData });
      try { localStorage.setItem('canvas_private', JSON.stringify(dashboardData)); } catch {}
    } else {
      setTeamCanvas({ isOpen: true, data: dashboardData });
      try { localStorage.setItem('canvas_team', JSON.stringify(dashboardData)); } catch {}
    }
  }, [dashboardData]);

  const {
    workspaces,
    newTeamName, setNewTeamName,
    inviteCode, setInviteCode,
    handleCreateTeam, handleJoinTeam,
  } = useWorkspace(currentUserId);

  const {
    docList,
    selectedFile, setSelectedFile,
    isUploading,
    handleFileUpload, handleDeleteDocument,
  } = useDocuments(workspaceId, isDocManagerOpen);

  const {
    agentList,
    agentForm, setAgentForm,
    editingAgent, setEditingAgent,
    selectedAgentId, setSelectedAgentId,
    selectedAgent,
    fetchAgents,
    handleCreateAgent,
    handleUpdateAgent,
    handleDeleteAgent,
  } = useAgents(currentUserId);

  // =========================================================================
  // 가드: 구형 계정 or 비로그인 접근 차단
  // =========================================================================
  useEffect(() => {
    if (!workspaceId || workspaceId === 'null') {
      alert('구형 계정입니다. 새 계정으로 가입하여 샌드박스를 발급받아 주십시오!');
      localStorage.clear();
      navigate('/');
    }
  }, [workspaceId, navigate]);

  // 초기 에이전트 목록 로드
  useEffect(() => { fetchAgents(); }, [currentUserId]);

  // 로그인 직후 페르소나 복원 — logout 시 localStorage.clear()로 날아간 값을 DB에서 다시 채움
  useEffect(() => {
    if (!currentUserId) return;
    apiClient.get(`/api/v1/users/${currentUserId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        localStorage.setItem('persona_memo', data.personaMemo || '');
        localStorage.setItem('persona_expertise', data.expertise || '');
        localStorage.setItem('persona_tone', data.tone || '');
        localStorage.setItem('persona_decision_style', data.decisionStyle || '');
      })
      .catch(() => {});
  }, [currentUserId]);

  // 탭 변경 시 스크롤
  useEffect(() => {
    if (currentTab === 'TEAM' || currentTab === 'PRIVATE') {
      chatEndRef.current?.scrollIntoView({ behavior: 'auto' });
    } else if (currentTab === 'LOG') {
      logEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, privateMessages, agentLogs, currentTab]);

  // =========================================================================
  // 핸들러 (훅 결과를 조립해서 컴포넌트에 전달)
  // =========================================================================
  const isSendingRef = useRef(false);
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    const activeSessionId = currentTab === 'PRIVATE' ? privateSessionId : teamSessionId;
    if (!activeSessionId) return; // 세션 미선택 → input 보존
    if (isSendingRef.current) return; // 더블 전송 방지
    isSendingRef.current = true;
    const userQuery = input;
    setInput('');
    const existingDashboard = currentTab === 'PRIVATE' ? privateCanvas.data : teamCanvas.data;
    // 팀 채팅 전용 채널이면 AI 없이 메시지만 전송
    const activeChannelMode = currentTab === 'TEAM' ? teamChannelMode : 'AI';
    try {
      await sendMessage({ userQuery, currentTab, selectedAgent, agentList, existingDashboard, channelMode: activeChannelMode });
    } finally {
      isSendingRef.current = false;
    }
  };

  const handleShareToTeam = (content) =>
    shareToTeam({ sessionId, content, currentUserId });

  const handleFeedback = (isPositive, query, answer, msg, isPrivate) => {
    sendFeedback({ workspaceId, userId: currentUserId, query, answer, isPositive });
    if (!isPositive && msg) removeMessage(msg, isPrivate);
  };

  const handleClarifySubmit = (selectedOptions, otherText) => {
    const { originalQuery } = clarifyData;
    const extras = [...selectedOptions, otherText].filter(Boolean).join(', ');
    const enrichedQuery = `${originalQuery} [추가 정보: ${extras}]`;
    setClarifyData(null);
    const existingDashboard = currentTab === 'PRIVATE' ? privateCanvas.data : teamCanvas.data;
    sendMessage({ userQuery: enrichedQuery, currentTab, selectedAgent, agentList, existingDashboard });
  };

  const handleResetCanvas = () => {
    if (currentTab === 'PRIVATE') {
      setPrivateCanvas({ isOpen: false, data: null });
      try { localStorage.removeItem('canvas_private'); } catch {}
    } else {
      setTeamCanvas({ isOpen: false, data: null });
      try { localStorage.removeItem('canvas_team'); } catch {}
    }
    resetDashboard();
  };

  const handleOpenEditAgent = (agent) => {
    setEditingAgent({ id: agent.id, name: agent.name, description: agent.description, agentType: agent.agentType, threshold: agent.threshold ?? 0.38 });
    setIsAgentEditOpen(true);
  };

  const handleClarifyCancel = () => {
    const originalQuery = clarifyData?.originalQuery;
    setClarifyData(null);
    if (originalQuery) {
      const existingDashboard = currentTab === 'PRIVATE' ? privateCanvas.data : teamCanvas.data;
      sendMessage({ userQuery: `[skip] ${originalQuery}`, currentTab, selectedAgent, agentList, existingDashboard });
    }
  };

  // 팀 채팅방 클릭 → 팀 탭 세션 교체 + 탭 전환
  const handleSelectTeamSession = (id, channelMode = 'AI') => {
    setTeamSessionId(id);
    setTeamChannelMode(channelMode);
    setCurrentTab('TEAM');
    setTeamCanvas(prev => ({ ...prev, isOpen: false }));
    setClarifyData(null);
  };

  // 개인 AI 채팅 클릭 → 개인 탭 세션 교체 + 탭 전환
  const handleSelectPrivateSession = (id) => {
    setPrivateSessionId(id);
    setCurrentTab('PRIVATE');
    setPrivateCanvas(prev => ({ ...prev, isOpen: false }));
    setClarifyData(null);
  };

  const handleSetCurrentTab = (tab) => {
    if (tab !== currentTab) setClarifyData(null);
    setCurrentTab(tab);
  };

  // =========================================================================
  // 렌더링
  // =========================================================================
  return (
    <div style={{ display: 'flex', height: '100vh', position: 'relative' }}>

      <div className="layout-grid" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          width={sidebarWidth}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          setIsUploadOpen={setIsUploadOpen}
          setIsDocManagerOpen={setIsDocManagerOpen}
          setIsAgentCreateOpen={setIsAgentCreateOpen}
          agentList={agentList}
          onEditAgent={handleOpenEditAgent} handleDeleteAgent={handleDeleteAgent}
          newTeamName={newTeamName} setNewTeamName={setNewTeamName} handleCreateTeam={handleCreateTeam}
          inviteCode={inviteCode} setInviteCode={setInviteCode} handleJoinTeam={handleJoinTeam}
          workspaces={workspaces} workspaceId={workspaceId}
          currentUserId={currentUserId}
          teamSessionId={teamSessionId}
          privateSessionId={privateSessionId}
          onSelectTeamSession={handleSelectTeamSession}
          onSelectPrivateSession={handleSelectPrivateSession}
        />
        {isSidebarOpen && <ResizeDivider onMouseDown={startSidebarResize} />}

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <ChatArea
            currentTab={currentTab} setCurrentTab={handleSetCurrentTab}
            panelCanvases={panelCanvases} onToggleCanvas={handleToggleCanvas}
            isGraphOpen={isGraphOpen} onToggleGraph={handleToggleGraph}
            privateMessages={privateMessages} messages={messages} agentLogs={agentLogs}
            chatEndRef={chatEndRef} logEndRef={logEndRef}
            handleShareToTeam={handleShareToTeam} handleFeedback={handleFeedback}
            selectedAgentId={selectedAgentId} setSelectedAgentId={setSelectedAgentId} agentList={agentList}
            input={input} setInput={setInput} handleSendMessage={handleSendMessage}
            clarifyData={clarifyData}
            onClarifySubmit={handleClarifySubmit}
            onClarifyCancel={handleClarifyCancel}
            isStreaming={isStreaming} currentTrace={currentTrace} currentRoute={currentRoute}
            teamChannelMode={teamChannelMode}
          />
          {isCanvasOpen && <ResizeDivider onMouseDown={startCanvasResize} />}
          <CanvasArea
            isCanvasOpen={isCanvasOpen} setIsCanvasOpen={setIsCanvasOpen}
            canvasData={canvasData} canvasWidth={canvasWidth}
            onReset={handleResetCanvas}
          />
          {isGraphOpen && <ResizeDivider onMouseDown={startGraphResize} />}
          <GraphPanel
            isOpen={isGraphOpen}
            onClose={handleToggleGraph}
            width={graphWidth}
            hitNodes={graphHitNodes}
          />
        </div>
      </div>

      {/* Groq 소진 경고 배너 */}
      {groqWarning && (
        <div style={{
          position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 2000, backgroundColor: '#fff8e1', border: '1px solid #f59e0b',
          borderRadius: '10px', padding: '12px 20px', display: 'flex', alignItems: 'center',
          gap: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxWidth: '560px',
        }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <span style={{ fontSize: '13px', color: '#92400e', flex: 1 }}>{groqWarning}</span>
          <button onClick={() => setGroqWarning(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#b45309', padding: '0 4px' }}>✕</button>
        </div>
      )}

      {/* Graph Pending 확인 배너 */}
      {graphPendingCount > 0 && (
        <div style={{
          position: 'fixed', bottom: groqWarning ? '140px' : '80px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 2000, backgroundColor: '#eff6ff', border: '1px solid #3b82f6',
          borderRadius: '10px', padding: '12px 20px', display: 'flex', alignItems: 'center',
          gap: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxWidth: '560px',
        }}>
          <span style={{ fontSize: '20px' }}>🕸️</span>
          <span style={{ fontSize: '13px', color: '#1e40af', flex: 1 }}>
            처리 대기 중인 지식 그래프 데이터 <strong>{graphPendingCount}건</strong>이 있습니다. 지금 처리할까요?
          </span>
          <button onClick={handleFlushPendingGraph} disabled={graphPendingProcessing}
            style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px',
              padding: '6px 14px', fontSize: '13px', fontWeight: '600', cursor: graphPendingProcessing ? 'not-allowed' : 'pointer',
              opacity: graphPendingProcessing ? 0.6 : 1 }}>
            {graphPendingProcessing ? '처리 중…' : '처리하기'}
          </button>
          <button onClick={() => setGraphPendingCount(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#3b82f6', padding: '0 4px' }}>✕</button>
        </div>
      )}

      {/* 모달 */}
      {isUploadOpen && (
        <UploadModal
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          isUploading={isUploading}
          onUpload={handleFileUpload}
          onClose={() => { setIsUploadOpen(false); setSelectedFile(null); }}
        />
      )}

      {isDocManagerOpen && (
        <DocManagerModal
          docList={docList}
          onDelete={handleDeleteDocument}
          onClose={() => setIsDocManagerOpen(false)}
        />
      )}

      {isAgentCreateOpen && (
        <AgentCreateModal
          form={agentForm}
          setForm={setAgentForm}
          onSubmit={handleCreateAgent}
          isEdit={false}
          onClose={() => setIsAgentCreateOpen(false)}
        />
      )}

      {isAgentEditOpen && editingAgent && (
        <AgentCreateModal
          form={editingAgent}
          setForm={setEditingAgent}
          onSubmit={handleUpdateAgent}
          isEdit={true}
          onClose={() => { setIsAgentEditOpen(false); setEditingAgent(null); }}
        />
      )}

    </div>
  );
}

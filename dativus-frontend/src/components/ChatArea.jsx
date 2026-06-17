import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import AgentDashboard from './AgentDashboard';
import MessageBubble from './MessageBubble';
import FloatingPanel from './FloatingPanel';

const TAB_LABELS = { PRIVATE: '개인 공간', TEAM: '팀 워크스페이스', LOG: '워크플로우' };

function InternalDivider({ onMouseDown }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '5px', flexShrink: 0, cursor: 'col-resize',
        backgroundColor: hovered ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
        transition: 'background-color 0.2s',
      }}
    />
  );
}

function PanelSlot({
  panel, isActive, isOnly, agentKey, flexValue,
  onFocus, onTabChange, onSplit, onFloat, onClose, onFloatTab,
  privateMessages, messages, agentLogs, agentList,
  handleShareToTeam, handleFeedback,
  isStreaming, currentTrace, logEndRef,
  panelCanvases, onToggleCanvas,
  isGraphOpen, onToggleGraph,
  teamChannelMode,
}) {
  const { id, tab } = panel;
  const endRef = useRef(null);
  const pressTimerRef = useRef(null);
  const pressingTabRef = useRef(null);
  const longPressedRef = useRef(false);
  const isPrivate = tab === 'PRIVATE';

  const startLongPress = (t) => {
    longPressedRef.current = false;
    pressingTabRef.current = t;
    pressTimerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      onFloatTab(pressingTabRef.current);
    }, 300);
  };
  const cancelLongPress = () => {
    clearTimeout(pressTimerRef.current);
    pressTimerRef.current = null;
  };
  const msgList = isPrivate ? privateMessages : messages;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, privateMessages, agentLogs, tab]);

  return (
    <div
      onClick={() => onFocus(id)}
      style={{
        flex: flexValue, display: 'flex', flexDirection: 'column', minWidth: 0,
        borderLeft: isActive && !isOnly ? '2px solid rgba(59,130,246,0.75)' : '2px solid transparent',
        boxShadow: isActive && !isOnly ? 'inset 22px 0 24px rgba(59,130,246,0.1)' : 'none',
      }}
    >
      {/* Panel header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', backgroundColor: '#fafafa', borderBottom: '1px solid #eee',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: '2px' }}>
          {Object.entries(TAB_LABELS).map(([t, label]) => (
            <button
              key={t}
              onMouseDown={() => startLongPress(t)}
              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}
              onClick={(e) => {
                e.stopPropagation();
                cancelLongPress();
                if (longPressedRef.current) { longPressedRef.current = false; return; }
                onTabChange(id, t);
              }}
              style={{
                fontSize: '13px', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer',
                border: 'none',
                background: tab === t ? '#111' : 'transparent',
                color: tab === t ? '#fff' : '#888',
                fontWeight: tab === t ? '700' : '500',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {(tab === 'PRIVATE' || tab === 'TEAM') && (() => {
            const open = panelCanvases?.[tab]?.isOpen;
            return (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onFocus(id); onToggleCanvas(tab); }}
                  title={open ? '캔버스 닫기' : '캔버스 열기'}
                  style={{
                    background: open ? '#333' : '#2196f3', color: '#fff',
                    border: 'none', borderRadius: '4px', cursor: 'pointer',
                    fontSize: '11px', padding: '3px 9px', fontWeight: 'bold',
                    transition: 'background 0.2s',
                  }}
                >캔버스</button>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleGraph?.(); }}
                  title={isGraphOpen ? '지식 그래프 닫기' : '지식 그래프 열기'}
                  style={{
                    background: isGraphOpen ? '#064e3b' : '#065f46', color: '#6ee7b7',
                    border: 'none', borderRadius: '4px', cursor: 'pointer',
                    fontSize: '11px', padding: '3px 9px', fontWeight: 'bold',
                    transition: 'background 0.2s',
                  }}
                >🕸️ 그래프</button>
              </>
            );
          })()}
          <button
            onClick={(e) => { e.stopPropagation(); onSplit(id); }}
            title="분할 보기"
            style={{ background: 'none', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', padding: '2px 7px', color: '#666' }}
          >⊞</button>
          {!isOnly && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onFloat(id); }}
                title="분리 창으로 띄우기"
                style={{ background: 'none', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', padding: '2px 7px', color: '#666' }}
              >⤢</button>
              <button
                onClick={(e) => { e.stopPropagation(); onClose(id); }}
                title="패널 닫기"
                onMouseEnter={e => e.currentTarget.style.color = '#e53e3e'}
                onMouseLeave={e => e.currentTarget.style.color = '#999'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '2px 7px', color: '#999', transition: 'color 0.15s' }}
              >✕</button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {tab === 'LOG' ? (
        <div className="dark-scroll" style={{ flex: 1, overflow: 'auto', minHeight: 0, backgroundColor: '#09090f', paddingBottom: '90px' }}>
          <AgentDashboard
            key={agentKey}
            agentLogs={agentLogs}
            isStreaming={isStreaming}
            currentTrace={currentTrace}
            logEndRef={logEndRef}
            customAgentList={agentList.filter(a => !a._builtin)}
          />
        </div>
      ) : (
        <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto', padding: `20px 30px ${tab === 'TEAM' && teamChannelMode === 'CHAT' ? '145px' : '90px'}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {msgList.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '80px' }}>
              {isPrivate ? (
                <>
                  <p style={{ color: '#555', fontWeight: 'bold', fontSize: '15px' }}>비밀 메모장에 오신 것을 환영합니다.</p>
                  <p style={{ color: '#aaa', fontSize: '13px', marginTop: '8px' }}>이곳의 대화는 다른 팀원들에게 노출되지 않습니다.</p>
                </>
              ) : (
                <p style={{ color: '#aaa', fontSize: '14px' }}>AI 비서에게 무엇이든 물어보세요!</p>
              )}
            </div>
          )}
          {msgList.map((msg, idx) => (
            <MessageBubble
              key={idx} msg={msg} prevMsg={msgList[idx - 1]}
              handleShareToTeam={handleShareToTeam} handleFeedback={handleFeedback}
              isPrivate={isPrivate} isLastMsg={idx === msgList.length - 1}
              isStreaming={isStreaming} currentTrace={currentTrace}
            />
          ))}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}

function AgentDropdown({ selectedAgentId, setSelectedAgentId, agentList }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const builtinOptions = [
    { value: '', label: 'Dati (자동)' },
    { value: 'general_agent', label: '일반 대화' },
    { value: 'expert_agent', label: '전문 분석' },
    { value: 'coding_math_agent', label: '코딩 / 수학' },
    { value: 'local_test', label: '로컬 테스트', isLocal: true },
    { value: 'pure_llm',   label: '순수 LLM',   isLocal: true },
  ];

  const selectedLabel =
    builtinOptions.find(o => o.value === selectedAgentId)?.label ||
    agentList.find(a => a.id === selectedAgentId)?.name ||
    'Dati (자동)';

  const itemStyle = (isSelected) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', padding: '9px 12px', borderRadius: '8px',
    border: 'none', background: isSelected ? '#f0f0f0' : 'transparent',
    cursor: 'pointer', fontSize: '13px', color: '#111', textAlign: 'left',
    fontWeight: isSelected ? '700' : '500', transition: 'background 0.1s', boxSizing: 'border-box',
  });

  return (
    <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setIsOpen(o => !o)}
        onMouseEnter={e => e.currentTarget.style.borderColor = '#bbb'}
        onMouseLeave={e => e.currentTarget.style.borderColor = '#e0e0e0'}
        style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          padding: '8px 14px', borderRadius: '20px',
          border: '1.5px solid #e0e0e0', background: '#fff',
          cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#111',
          whiteSpace: 'nowrap', transition: 'border-color 0.15s',
        }}
      >
        <span style={{ fontSize: '13px', color: '#6366f1' }}>✦</span>
        {selectedLabel}
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
          <path fill="#999" d="M5 7L1 3h8z" />
        </svg>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
          backgroundColor: '#fff', border: '1px solid #ebebeb',
          borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          minWidth: '200px', zIndex: 100, padding: '8px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#bbb', padding: '4px 12px 6px', letterSpacing: '0.5px' }}>기본 에이전트</div>
          {builtinOptions.filter(o => !o.isLocal).map(opt => (
            <button
              key={opt.value}
              onClick={() => { setSelectedAgentId(opt.value); setIsOpen(false); }}
              onMouseEnter={e => { if (selectedAgentId !== opt.value) e.currentTarget.style.background = '#fafafa'; }}
              onMouseLeave={e => { if (selectedAgentId !== opt.value) e.currentTarget.style.background = 'transparent'; }}
              style={itemStyle(selectedAgentId === opt.value)}
            >
              <span>{opt.label}</span>
              {selectedAgentId === opt.value && <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: '700' }}>✓</span>}
            </button>
          ))}
          <div style={{ height: '1px', backgroundColor: '#f0f0f0', margin: '6px 0' }} />
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#bbb', padding: '4px 12px 6px', letterSpacing: '0.5px' }}>개발 / 테스트</div>
          {builtinOptions.filter(o => o.isLocal).map(opt => (
            <button
              key={opt.value}
              onClick={() => { setSelectedAgentId(opt.value); setIsOpen(false); }}
              onMouseEnter={e => { if (selectedAgentId !== opt.value) e.currentTarget.style.background = '#fafafa'; }}
              onMouseLeave={e => { if (selectedAgentId !== opt.value) e.currentTarget.style.background = 'transparent'; }}
              style={{ ...itemStyle(selectedAgentId === opt.value), color: selectedAgentId === opt.value ? '#111' : '#888' }}
            >
              <span>🖥 {opt.label}</span>
              {selectedAgentId === opt.value && <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: '700' }}>✓</span>}
            </button>
          ))}

          {agentList.length > 0 && (
            <>
              <div style={{ height: '1px', backgroundColor: '#f0f0f0', margin: '6px 0' }} />
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#bbb', padding: '4px 12px 6px', letterSpacing: '0.5px' }}>나의 에이전트</div>
              {agentList.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => { setSelectedAgentId(agent.id); setIsOpen(false); }}
                  onMouseEnter={e => { if (selectedAgentId !== agent.id) e.currentTarget.style.background = '#fafafa'; }}
                  onMouseLeave={e => { if (selectedAgentId !== agent.id) e.currentTarget.style.background = 'transparent'; }}
                  style={itemStyle(selectedAgentId === agent.id)}
                >
                  <span>{agent.name}</span>
                  {selectedAgentId === agent.id && <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: '700' }}>✓</span>}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const getPanelState = () => {
  try { return JSON.parse(sessionStorage.getItem('dativus_panel_state') || 'null') || {}; }
  catch { return {}; }
};

let _nextId = 2;

export default function ChatArea({
  currentTab, setCurrentTab,
  panelCanvases, onToggleCanvas,
  isGraphOpen, onToggleGraph,
  privateMessages, messages, agentLogs,
  chatEndRef, logEndRef,
  handleShareToTeam, handleFeedback,
  selectedAgentId, setSelectedAgentId, agentList,
  input, setInput, handleSendMessage,
  clarifyData, onClarifySubmit, onClarifyCancel,
  isStreaming, currentTrace, currentRoute = '',
  teamChannelMode = 'AI',
}) {
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [clarifyOther, setClarifyOther] = useState('');
  const [agentKey, setAgentKey] = useState(0);
  const bumpAgentKey = () => setAgentKey(k => k + 1);

  // Panel state — sessionStorage에서 복원
  const [panels, setPanels] = useState(() => {
    const s = getPanelState();
    if (s.nextId) _nextId = Math.max(2, s.nextId);
    return s.panels || [{ id: 1, tab: currentTab }];
  });
  const [panelFlexes, setPanelFlexes] = useState(() => getPanelState().panelFlexes || [1]);
  const [floatingPanels, setFloatingPanels] = useState(() => getPanelState().floatingPanels || []);
  const [activePanelId, setActivePanelId] = useState(() => getPanelState().activePanelId || 1);

  const panelFlexesRef = useRef(panelFlexes);
  useEffect(() => { panelFlexesRef.current = panelFlexes; }, [panelFlexes]);

  // 패널 상태 변경 시 sessionStorage 저장
  useEffect(() => {
    try {
      sessionStorage.setItem('dativus_panel_state', JSON.stringify(
        { panels, panelFlexes, floatingPanels, activePanelId, nextId: _nextId }
      ));
    } catch {}
  }, [panels, panelFlexes, floatingPanels, activePanelId]);

  // 복원 시 currentTab 동기화
  useEffect(() => {
    const s = getPanelState();
    if (s.panels && s.activePanelId) {
      const active = s.panels.find(p => p.id === s.activePanelId);
      if (active) setCurrentTab(active.tab);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const containerRef = useRef(null);

  useEffect(() => {
    setSelectedOptions([]);
    setClarifyOther('');
  }, [clarifyData]);

  useEffect(() => {
    if (!clarifyData) return;
    const handleGlobalEnter = (e) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      if (e.target.classList.contains('clarify-other-input')) return;
      if (selectedOptions.length > 0 || clarifyOther.trim()) {
        bumpAgentKey();
        onClarifySubmit(selectedOptions, clarifyOther);
        setSelectedOptions([]);
        setClarifyOther('');
      }
    };
    document.addEventListener('keydown', handleGlobalEnter);
    return () => document.removeEventListener('keydown', handleGlobalEnter);
  }, [clarifyData, selectedOptions, clarifyOther, onClarifySubmit]);

  // Panel management
  const handlePanelFocus = (panelId) => {
    setActivePanelId(panelId);
    const panel = panels.find(p => p.id === panelId);
    if (panel) setCurrentTab(panel.tab);
  };

  const handlePanelTabChange = (panelId, newTab) => {
    setPanels(prev => prev.map(p => p.id === panelId ? { ...p, tab: newTab } : p));
    if (panelId === activePanelId) setCurrentTab(newTab);
  };

  const handleSplitPanel = (panelId) => {
    const panel = panels.find(p => p.id === panelId);
    const otherTabs = ['PRIVATE', 'TEAM', 'LOG'].filter(t => t !== panel.tab);
    const newPanel = { id: _nextId++, tab: otherTabs[0] };
    setPanels(prev => [...prev, newPanel]);
    setPanelFlexes(prev => [...prev, 1]);
    setActivePanelId(newPanel.id);
    setCurrentTab(newPanel.tab);
  };

  const handleFloatPanel = (panelId) => {
    if (panels.length <= 1) return;
    const idx = panels.findIndex(p => p.id === panelId);
    const panel = panels.find(p => p.id === panelId);
    const offset = floatingPanels.length * 30;
    setPanels(prev => {
      const newPanels = prev.filter(p => p.id !== panelId);
      if (activePanelId === panelId) {
        setActivePanelId(newPanels[0].id);
        setCurrentTab(newPanels[0].tab);
      }
      return newPanels;
    });
    setPanelFlexes(prev => prev.filter((_, i) => i !== idx));
    setFloatingPanels(prev => [
      ...prev,
      { ...panel, x: 220 + offset, y: 60 + offset, w: 1090, h: 720 },
    ]);
  };

  const handleClosePanel = (panelId) => {
    if (panels.length <= 1) return;
    const idx = panels.findIndex(p => p.id === panelId);
    setPanels(prev => {
      const newPanels = prev.filter(p => p.id !== panelId);
      if (activePanelId === panelId) {
        setActivePanelId(newPanels[0].id);
        setCurrentTab(newPanels[0].tab);
      }
      return newPanels;
    });
    setPanelFlexes(prev => prev.filter((_, i) => i !== idx));
  };

  const handleNewFloatPanel = (tab) => {
    const offset = floatingPanels.length * 30;
    setFloatingPanels(prev => [
      ...prev,
      { id: _nextId++, tab, x: 300 + offset, y: 80 + offset, w: 1090, h: 720 },
    ]);
  };

  const handleCloseFloating = (panelId) => {
    setFloatingPanels(prev => prev.filter(p => p.id !== panelId));
  };

  const handleFloatingTabChange = (panelId, newTab) => {
    setFloatingPanels(prev => prev.map(p => p.id === panelId ? { ...p, tab: newTab } : p));
  };

  // Panel resize
  const startPanelResize = useCallback((dividerIdx) => (e) => {
    e.preventDefault();
    const containerW = containerRef.current?.offsetWidth || 800;
    const startX = e.clientX;
    const startFlexes = [...panelFlexesRef.current];
    const totalFlex = startFlexes.reduce((a, b) => a + b, 0);

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dFlex = (dx / containerW) * totalFlex;
      setPanelFlexes(() => {
        const next = [...startFlexes];
        next[dividerIdx] = Math.max(0.15, startFlexes[dividerIdx] + dFlex);
        next[dividerIdx + 1] = Math.max(0.15, startFlexes[dividerIdx + 1] - dFlex);
        return next;
      });
    };
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
  }, []);

  return (
    <div className="content-cell" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 0, backgroundColor: '#fff', position: 'relative' }}>

      {/* Panel area */}
      <div ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {panels.map((panel, idx) => (
          <Fragment key={panel.id}>
            {idx > 0 && <InternalDivider onMouseDown={startPanelResize(idx - 1)} />}
            <PanelSlot
              panel={panel}
              isActive={panel.id === activePanelId}
              isOnly={panels.length === 1}
              agentKey={agentKey}
              flexValue={panelFlexes[idx] ?? 1}
              onFocus={handlePanelFocus}
              onTabChange={handlePanelTabChange}
              onSplit={handleSplitPanel}
              onFloat={handleFloatPanel}
              onClose={handleClosePanel}
              onFloatTab={handleNewFloatPanel}
              privateMessages={privateMessages}
              messages={messages}
              agentLogs={agentLogs}
              agentList={agentList}
              handleShareToTeam={handleShareToTeam}
              handleFeedback={handleFeedback}
              isStreaming={isStreaming}
              currentTrace={currentTrace}
              logEndRef={logEndRef}
              panelCanvases={panelCanvases}
              onToggleCanvas={onToggleCanvas}
              isGraphOpen={isGraphOpen}
              onToggleGraph={onToggleGraph}
              teamChannelMode={teamChannelMode}
            />
          </Fragment>
        ))}
      </div>

      {/* Input overlay — absolutely floats over the chat area */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10 }}>

      {/* Clarify card */}
      {clarifyData && (
        <div style={{
          margin: '0 40px 10px',
          padding: '16px 20px',
          backgroundColor: '#f7f7f7',
          border: '1px solid #e0e0e0',
          borderRadius: '12px',
          flexShrink: 0,
        }}>
          <div style={{ fontWeight: 'bold', color: '#111', marginBottom: '12px', fontSize: '14px' }}>
            {clarifyData.question}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            {clarifyData.options.map(opt => (
              <label key={opt} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px',
                backgroundColor: selectedOptions.includes(opt) ? '#111' : '#fff',
                color: selectedOptions.includes(opt) ? '#fff' : '#333',
                border: '1px solid #d0d0d0', borderRadius: '20px',
                cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s', userSelect: 'none',
              }}>
                <input
                  type={clarifyData.multi_select ? 'checkbox' : 'radio'}
                  name="clarify-opt" value={opt}
                  checked={selectedOptions.includes(opt)}
                  onChange={() => {
                    if (clarifyData.multi_select) {
                      setSelectedOptions(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]);
                    } else {
                      setSelectedOptions([opt]);
                    }
                  }}
                  style={{ display: 'none' }}
                />
                {opt}
              </label>
            ))}
          </div>
          <input
            type="text" className="clarify-other-input" placeholder="기타 직접 입력..."
            value={clarifyOther} onChange={e => setClarifyOther(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (selectedOptions.length > 0 || clarifyOther.trim())) {
                bumpAgentKey(); onClarifySubmit(selectedOptions, clarifyOther);
                setSelectedOptions([]); setClarifyOther('');
              }
            }}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none', fontSize: '13px', marginBottom: '12px', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={onClarifyCancel}
              style={{ padding: '6px 16px', border: '1px solid #ccc', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '13px' }}>
              그냥 보내기
            </button>
            <button
              onClick={() => {
                if (selectedOptions.length === 0 && !clarifyOther.trim()) return;
                bumpAgentKey(); onClarifySubmit(selectedOptions, clarifyOther);
              }}
              style={{
                padding: '6px 16px', background: '#111', color: '#fff',
                border: 'none', borderRadius: '6px', cursor: 'pointer',
                fontSize: '13px', fontWeight: 'bold',
                opacity: (selectedOptions.length === 0 && !clarifyOther.trim()) ? 0.4 : 1,
              }}
            >확인</button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div style={{ padding: '0 0 20px' }}>
      {/* 팀 채팅 채널 안내 배너 */}
      {currentTab === 'TEAM' && teamChannelMode === 'CHAT' && (
        <div style={{
          margin: '0 40px 8px',
          padding: '7px 16px',
          borderRadius: '10px',
          background: 'linear-gradient(90deg, #dbeafe, #eff6ff)',
          border: '1px solid #93c5fd',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span style={{ fontSize: '13px' }}>💬</span>
          <span style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: '600' }}>팀 채팅 전용 채널</span>
          <span style={{ fontSize: '11px', color: '#2563eb', opacity: 0.7 }}>— AI 없이 팀원끼리 대화합니다</span>
        </div>
      )}

      <div className="input-bar" style={{
        display: 'flex',
        ...(() => {
          if (currentTab === 'TEAM' && teamChannelMode === 'CHAT')
            return { backgroundColor: 'rgba(59,130,246,0.08)', boxShadow: 'inset 0 0 0 1.5px rgba(59,130,246,0.45)' };
          const routeColors = {
            general_agent:    { backgroundColor: 'rgba(34,197,94,0.08)',  boxShadow: 'inset 0 0 0 1.5px rgba(34,197,94,0.55)' },
            expert_agent:     { backgroundColor: 'rgba(99,102,241,0.08)', boxShadow: 'inset 0 0 0 1.5px rgba(99,102,241,0.55)' },
            coding_math_agent:{ backgroundColor: 'rgba(249,115,22,0.08)', boxShadow: 'inset 0 0 0 1.5px rgba(249,115,22,0.55)' },
          };
          return routeColors[currentRoute] || { backgroundColor: 'rgba(0,0,0,0.07)', boxShadow: 'inset 0 0 0 1.5px rgba(0,0,0,0.35), inset 0 0 40px rgba(0,0,0,0.21)' };
        })(),
        backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
        borderRadius: '40px',
        padding: '12px 20px', gap: '15px', alignItems: 'center',
        margin: '0 40px', flexShrink: 0,
        transition: 'background-color 0.2s, box-shadow 0.2s',
      }}>
        {!(currentTab === 'TEAM' && teamChannelMode === 'CHAT') && (
          <AgentDropdown selectedAgentId={selectedAgentId} setSelectedAgentId={setSelectedAgentId} agentList={agentList} />
        )}
        <input
          type="text" className="chat-input"
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '16px', opacity: clarifyData ? 0.4 : 1 }}
          placeholder={
            clarifyData ? '위 선택지를 먼저 선택해 주세요' :
            isStreaming ? '응답을 기다리는 중...' :
            (currentTab === 'TEAM' && teamChannelMode === 'CHAT') ? '팀원에게 메시지 보내기...' :
            '명령을 하달해 주십시오...'
          }
          value={input} disabled={!!clarifyData || isStreaming}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { bumpAgentKey(); handleSendMessage(); } }}
        />
        <button
          className="btn-send"
          onClick={() => { bumpAgentKey(); handleSendMessage(); }}
          disabled={!!clarifyData || isStreaming}
          style={{
            background: (clarifyData || isStreaming) ? '#aaa' : '#000',
            color: '#fff', border: 'none', borderRadius: '50%',
            width: '36px', height: '36px',
            cursor: (clarifyData || isStreaming) ? 'not-allowed' : 'pointer',
            fontWeight: 'bold', flexShrink: 0, fontSize: '16px',
          }}
        >→</button>
      </div>
      </div>{/* /input bar wrapper */}

      </div>{/* /Input overlay */}

      {/* Floating panels */}
      {floatingPanels.map(fp => (
        <FloatingPanel
          key={fp.id} panel={fp}
          privateMessages={privateMessages} messages={messages}
          agentLogs={agentLogs} agentList={agentList}
          handleShareToTeam={handleShareToTeam} handleFeedback={handleFeedback}
          isStreaming={isStreaming} currentTrace={currentTrace}
          onClose={() => handleCloseFloating(fp.id)}
          onChangeTab={handleFloatingTabChange}
        />
      ))}
    </div>
  );
}

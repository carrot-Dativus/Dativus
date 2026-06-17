import { useState, useCallback, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import AgentDashboard from './AgentDashboard';

const TAB_LABELS = { PRIVATE: '개인 공간', TEAM: '팀 워크스페이스', LOG: '워크플로우' };

export default function FloatingPanel({
  panel,
  privateMessages, messages, agentLogs, agentList,
  handleShareToTeam, handleFeedback,
  isStreaming, currentTrace,
  onClose, onChangeTab,
}) {
  const posRef = useRef({ x: panel.x, y: panel.y });
  const [pos, setPos] = useState({ x: panel.x, y: panel.y });
  const [size, setSize] = useState({ w: panel.w, h: panel.h });
  const sizeRef = useRef(size);
  useEffect(() => { sizeRef.current = size; }, [size]);

  const handleTitleMouseDown = useCallback((e) => {
    if (e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    const startX = e.clientX - posRef.current.x;
    const startY = e.clientY - posRef.current.y;
    const onMove = (ev) => {
      const newPos = { x: ev.clientX - startX, y: ev.clientY - startY };
      posRef.current = newPos;
      setPos(newPos);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const startResize = useCallback((dir) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = sizeRef.current.w;
    const startH = sizeRef.current.h;
    const cursors = { e: 'e-resize', s: 's-resize', se: 'se-resize', sw: 'sw-resize' };
    const startPosX = posRef.current.x;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (dir === 'e') {
        setSize({ w: Math.max(280, startW + dx), h: startH });
      } else if (dir === 's') {
        setSize({ w: startW, h: Math.max(200, startH + dy) });
      } else if (dir === 'se') {
        setSize({ w: Math.max(280, startW + dx), h: Math.max(200, startH + dy) });
      } else if (dir === 'sw') {
        const newW = Math.max(280, startW - dx);
        setSize({ w: newW, h: Math.max(200, startH + dy) });
        const newPos = { x: startPosX + (startW - newW), y: posRef.current.y };
        posRef.current = newPos;
        setPos(newPos);
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = cursors[dir];
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const { id, tab } = panel;
  const isPrivate = tab === 'PRIVATE';
  const msgList = isPrivate ? privateMessages : messages;

  return (
    <div style={{
      position: 'fixed', left: pos.x, top: pos.y,
      width: size.w, height: size.h,
      backgroundColor: '#fff', borderRadius: '10px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      border: '1px solid #e0e0e0',
      display: 'flex', flexDirection: 'column',
      zIndex: 1000, overflow: 'hidden',
    }}>

      {/* Title bar (drag) */}
      <div
        onMouseDown={handleTitleMouseDown}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 14px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #eee',
          cursor: 'grab', userSelect: 'none', flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: '4px' }}>
          {Object.entries(TAB_LABELS).map(([t, label]) => (
            <button key={t} onClick={() => onChangeTab(id, t)} style={{
              fontSize: '12px', padding: '3px 10px', borderRadius: '4px', cursor: 'pointer',
              border: 'none', background: tab === t ? '#111' : 'transparent',
              color: tab === t ? '#fff' : '#777', fontWeight: tab === t ? '700' : 'normal',
            }}>{label}</button>
          ))}
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', fontSize: '15px',
          cursor: 'pointer', color: '#999', padding: '0 4px', lineHeight: 1,
        }}>✕</button>
      </div>

      {/* Content */}
      {tab === 'LOG' ? (
        <div className="dark-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <AgentDashboard
            agentLogs={agentLogs}
            isStreaming={isStreaming}
            currentTrace={currentTrace}
            logEndRef={null}
            customAgentList={agentList.filter(a => !a._builtin)}
          />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
          {msgList.length === 0 && (
            <div style={{ textAlign: 'center', color: '#aaa', marginTop: '60px', fontSize: '13px' }}>
              {isPrivate ? '개인 공간 메시지가 없습니다.' : '팀 워크스페이스 메시지가 없습니다.'}
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
        </div>
      )}

      {/* Resize handles */}
      <div onMouseDown={startResize('e')} style={{
        position: 'absolute', right: 0, top: 40, bottom: 10,
        width: '5px', cursor: 'e-resize', zIndex: 10,
      }} />
      <div onMouseDown={startResize('s')} style={{
        position: 'absolute', bottom: 0, left: 10, right: 10,
        height: '5px', cursor: 's-resize', zIndex: 10,
      }} />
      <div onMouseDown={startResize('se')} style={{
        position: 'absolute', right: 0, bottom: 0,
        width: '14px', height: '14px', cursor: 'se-resize', zIndex: 11,
        background: 'linear-gradient(135deg, transparent 50%, #ccc 50%)',
        borderRadius: '0 0 10px 0',
      }} />
      <div onMouseDown={startResize('sw')} style={{
        position: 'absolute', left: 0, bottom: 0,
        width: '14px', height: '14px', cursor: 'sw-resize', zIndex: 11,
        background: 'linear-gradient(225deg, transparent 50%, #ccc 50%)',
        borderRadius: '0 0 0 10px',
      }} />
    </div>
  );
}

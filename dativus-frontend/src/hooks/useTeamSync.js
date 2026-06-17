import { useEffect, useRef } from 'react';

const WS_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/^http/, 'ws')
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

function sendBrowserNotification(msg) {
  if (document.visibilityState === 'visible') return;
  if (Notification.permission !== 'granted') return;
  if (msg.type === 'canvas_update') return;
  if (msg.sender === 'ai') return; // AI 응답은 알림 없음

  const senderName = msg.senderName || '팀원';
  const body = (msg.text || '').slice(0, 80);
  const n = new Notification('Dati에게 온 메시지', {
    body: `${senderName}: ${body}`,
    icon: '/DATI.png',
    badge: '/DATI.png',
  });
  n.onclick = () => { window.focus(); n.close(); };
}

export function useTeamSync(workspaceId, currentUserId, onTeamMessage) {
  const wsRef = useRef(null);
  const timerRef = useRef(null);
  const callbackRef = useRef(onTeamMessage);

  useEffect(() => { callbackRef.current = onTeamMessage; }, [onTeamMessage]);

  // 알림 권한 요청 (한 번만)
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!workspaceId || workspaceId === 'null') return;

    let destroyed = false;

    const connect = () => {
      if (destroyed) return;
      const token = localStorage.getItem('token');
      const ws = new WebSocket(`${WS_BASE_URL}/ws/chat/${workspaceId}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => console.log('[WS] 팀 탭 연결됨');

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.sourceUserId && msg.sourceUserId === currentUserId) return;
          sendBrowserNotification(msg);
          callbackRef.current?.(msg);
        } catch {}
      };

      ws.onclose = () => {
        // destroyed면 재연결 안 함 (StrictMode 이중 실행 방지)
        if (!destroyed) timerRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      destroyed = true;
      clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [workspaceId, currentUserId]);
}

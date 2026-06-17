import { useEffect, useRef, useState, useCallback } from 'react';

const AI_BASE_URL = import.meta.env.VITE_AI_BASE_URL || '';

const PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];

function runForce(nodes, edges, canvas, simState) {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  nodes.forEach(n => { n.fx = 0; n.fy = 0; });

  // 반발력
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = (nodes[j].x - nodes[i].x) || 0.01;
      const dy = (nodes[j].y - nodes[i].y) || 0.01;
      const d2 = dx * dx + dy * dy;
      const d = Math.sqrt(d2) || 0.01;
      const f = Math.min(4000 / d2, 120);
      nodes[i].fx -= (dx / d) * f;
      nodes[i].fy -= (dy / d) * f;
      nodes[j].fx += (dx / d) * f;
      nodes[j].fy += (dy / d) * f;
    }
  }

  // 엣지 스프링 인력
  edges.forEach(e => {
    if (!e.src || !e.tgt) return;
    const dx = e.tgt.x - e.src.x;
    const dy = e.tgt.y - e.src.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const spring = (d - 130) * 0.04;
    const fx = (dx / d) * spring;
    const fy = (dy / d) * spring;
    e.src.fx += fx; e.src.fy += fy;
    e.tgt.fx -= fx; e.tgt.fy -= fy;
  });

  // 중심 인력
  nodes.forEach(n => {
    n.fx += (cx - n.x) * 0.025;
    n.fy += (cy - n.y) * 0.025;
  });

  // 속도 + 위치 업데이트
  nodes.forEach(n => {
    if (simState.dragging === n) return;
    n.vx = (n.vx + n.fx) * 0.68;
    n.vy = (n.vy + n.fy) * 0.68;
    n.x += n.vx;
    n.y += n.vy;
    n.x = Math.max(52, Math.min(canvas.width - 52, n.x));
    n.y = Math.max(36, Math.min(canvas.height - 36, n.y));
  });
}

function drawArrow(ctx, sx, sy, tx, ty, color) {
  const angle = Math.atan2(ty - sy, tx - sx);
  const r = 18; // 노드 반지름 + 여백
  const ax = tx - Math.cos(angle) * r;
  const ay = ty - Math.sin(angle) * r;
  ctx.beginPath();
  ctx.moveTo(sx + Math.cos(angle) * 18, sy + Math.sin(angle) * 18);
  ctx.lineTo(ax, ay);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 화살촉
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax - 9 * Math.cos(angle - 0.45), ay - 9 * Math.sin(angle - 0.45));
  ctx.lineTo(ax - 9 * Math.cos(angle + 0.45), ay - 9 * Math.sin(angle + 0.45));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export default function GraphPanel({ isOpen, width = 380, onClose, hitNodes = [] }) {
  const canvasRef = useRef(null);
  const simRef = useRef({ nodes: [], edges: [], dragging: null, hovered: null });
  const rafRef = useRef(null);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const hitSetRef = useRef(new Set());

  const fetchData = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${AI_BASE_URL}/api/v1/graph/data`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      setGraphData(data);
    } catch {
      setError('그래프 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // hitNodes가 바뀔 때마다 Set 갱신 (렌더 루프에서 참조)
  useEffect(() => {
    hitSetRef.current = new Set(hitNodes);
  }, [hitNodes]);

  // 시뮬레이션 + 렌더링
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graphData.nodes.length) return;

    const ctx = canvas.getContext('2d');

    // 노드 초기화 (랜덤 위치)
    const nodes = graphData.nodes.map((n, i) => ({
      id: n.id,
      name: n.name,
      x: canvas.width / 2 + (Math.random() - 0.5) * 180,
      y: canvas.height / 2 + (Math.random() - 0.5) * 180,
      vx: 0, vy: 0,
      color: PALETTE[i % PALETTE.length],
    }));

    const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
    const edges = graphData.edges.map(e => ({
      ...e,
      src: nodeMap[e.source],
      tgt: nodeMap[e.target],
    })).filter(e => e.src && e.tgt);

    simRef.current = { nodes, edges, dragging: null, hovered: null };

    const render = () => {
      const { nodes, edges, hovered } = simRef.current;
      runForce(nodes, edges, canvas, simRef.current);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 배경
      ctx.fillStyle = '#0d0d10';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const hitSet = hitSetRef.current;

      // 엣지
      edges.forEach(e => {
        if (!e.src || !e.tgt) return;
        const isHov = hovered && (hovered === e.src || hovered === e.tgt);
        const isHit = hitSet.size > 0 && (hitSet.has(e.src.name) || hitSet.has(e.tgt.name));
        const edgeColor = isHov ? '#6366f1' : isHit ? '#f59e0b' : '#2a2a35';
        drawArrow(ctx, e.src.x, e.src.y, e.tgt.x, e.tgt.y, edgeColor);

        // 엣지 레이블
        const mx = (e.src.x + e.tgt.x) / 2;
        const my = (e.src.y + e.tgt.y) / 2;
        if (isHov) {
          ctx.fillStyle = '#a5b4fc';
          ctx.font = 'bold 10px sans-serif';
        } else if (isHit) {
          ctx.fillStyle = '#fcd34d';
          ctx.font = 'bold 10px sans-serif';
        } else {
          ctx.fillStyle = '#444';
          ctx.font = '9px sans-serif';
        }
        ctx.textAlign = 'center';
        const label = e.label.length > 10 ? e.label.slice(0, 10) + '…' : e.label;
        ctx.fillText(label, mx, my - 5);
      });

      // 노드
      nodes.forEach(n => {
        const isHov = hovered === n;
        const isHit = hitSet.has(n.name);
        const r = isHov ? 20 : isHit ? 19 : 16;

        // 외곽 링 — 히트 노드 (amber glow)
        if (isHit) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 7, 0, Math.PI * 2);
          ctx.strokeStyle = '#f59e0b66';
          ctx.lineWidth = 4;
          ctx.stroke();
        }

        // 그림자 (호버)
        if (isHov) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
          ctx.fillStyle = n.color + '30';
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isHov ? n.color : isHit ? n.color : n.color + 'bb';
        ctx.fill();
        ctx.strokeStyle = isHov ? '#fff' : isHit ? '#f59e0b' : '#1a1a20';
        ctx.lineWidth = isHov ? 2.5 : isHit ? 2.5 : 1.5;
        ctx.stroke();

        // 노드 레이블
        const label = n.name.length > 7 ? n.name.slice(0, 7) + '…' : n.name;
        ctx.fillStyle = isHov ? '#fff' : isHit ? '#fcd34d' : '#ccc';
        ctx.font = (isHov || isHit) ? 'bold 11px sans-serif' : '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, n.x, n.y + r + 14);
      });

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    // 마우스 이벤트
    const getNodeAt = (mx, my) =>
      simRef.current.nodes.find(n => Math.hypot(n.x - mx, n.y - my) < 22) || null;

    const toCanvasXY = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
    };

    const onMouseDown = (e) => {
      const [mx, my] = toCanvasXY(e);
      simRef.current.dragging = getNodeAt(mx, my);
    };
    const onMouseMove = (e) => {
      const [mx, my] = toCanvasXY(e);
      simRef.current.hovered = getNodeAt(mx, my);
      canvas.style.cursor = simRef.current.hovered ? 'grab' : 'default';
      if (simRef.current.dragging) {
        simRef.current.dragging.x = mx;
        simRef.current.dragging.y = my;
        simRef.current.dragging.vx = 0;
        simRef.current.dragging.vy = 0;
        canvas.style.cursor = 'grabbing';
      }
    };
    const onMouseUp = () => { simRef.current.dragging = null; };
    const onMouseLeave = () => { simRef.current.hovered = null; simRef.current.dragging = null; };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [graphData]);

  // 캔버스 크기 동기화
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isOpen) return;
    const parent = canvas.parentElement;
    const sync = () => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [isOpen]);

  const nodeCount = graphData.nodes.length;
  const edgeCount = graphData.edges.length;

  return (
    <div style={{
      width: isOpen ? `${width}px` : '0px',
      flexShrink: 0,
      opacity: isOpen ? 1 : 0,
      pointerEvents: isOpen ? 'auto' : 'none',
      transition: 'width 0.25s ease, opacity 0.25s ease',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0d0d10',
      overflow: 'hidden',
      borderLeft: isOpen ? '1px solid #1e1e28' : 'none',
      zIndex: 1, position: 'relative',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', flexShrink: 0,
        background: 'linear-gradient(135deg, #0d0d10 0%, #13131f 100%)',
        borderBottom: '1px solid #1e1e28', minWidth: '300px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #10b981, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', flexShrink: 0,
          }}>🕸️</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', letterSpacing: '-0.01em' }}>
              지식 그래프
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '1px' }}>
              {nodeCount}개 개체 · {edgeCount}개 관계
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={fetchData}
            title="새로고침"
            style={{
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)', borderRadius: '6px',
              width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
          >↺</button>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.07)', border: 'none',
              color: 'rgba(255,255,255,0.45)', borderRadius: '6px',
              width: '28px', height: '28px', cursor: 'pointer', fontSize: '13px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
          >✕</button>
        </div>
      </div>

      {/* 바디 — Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: '300px' }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#555',
          }}>
            <div style={{ fontSize: '28px', animation: 'spin 1s linear infinite' }}>🕸️</div>
            <span style={{ fontSize: '12px' }}>그래프 로딩 중…</span>
          </div>
        )}
        {!loading && error && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#ef4444', fontSize: '12px', padding: '20px', textAlign: 'center',
          }}>
            {error}
          </div>
        )}
        {!loading && !error && nodeCount === 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '24px',
          }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '18px',
              background: 'linear-gradient(135deg, #10b98115, #6366f115)',
              border: '1px solid #10b98120',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px',
            }}>🕸️</div>
            <p style={{ color: '#444', fontSize: '12px', textAlign: 'center', lineHeight: '1.8', margin: 0 }}>
              아직 지식 그래프 데이터가 없습니다.<br />
              AI와 대화하면 자동으로 쌓입니다.
            </p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
        {/* 범례 */}
        {!loading && nodeCount > 0 && (
          <div style={{
            position: 'absolute', bottom: '12px', left: '12px',
            background: 'rgba(13,13,16,0.85)', borderRadius: '8px',
            padding: '7px 10px', fontSize: '10px', color: '#666',
            border: '1px solid #1e1e28', lineHeight: '1.6',
            backdropFilter: 'blur(4px)',
          }}>
            <div>● 개체 (드래그 가능)</div>
            <div>→ 관계 (호버 시 강조)</div>
            {hitNodes.length > 0 && (
              <div style={{ color: '#f59e0b', marginTop: '3px' }}>◎ 이번 질문에서 활성화됨</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

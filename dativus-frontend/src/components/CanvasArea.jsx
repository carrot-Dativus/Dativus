import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const PALETTE = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#a78bfa'];

function ChartWrapper({ accentColor, title, children }) {
  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '14px',
      marginBottom: '14px',
      boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
      border: '1px solid #f0f0f0',
      overflow: 'hidden',
    }}>
      <div style={{
        height: '3px',
        background: accentColor || `linear-gradient(90deg, ${PALETTE[0]}, ${PALETTE[1]})`,
      }} />
      <div style={{ padding: '16px 18px 18px' }}>
        <p style={{ fontSize: '13px', fontWeight: '700', color: '#111', marginBottom: '10px', letterSpacing: '-0.01em' }}>{title}</p>
        {children}
      </div>
    </div>
  );
}

function PieChartCard({ chart }) {
  const data = chart.data.map((d, i) => ({ ...d, color: d.color || PALETTE[i % PALETTE.length] }));
  return (
    <ChartWrapper accentColor={data[0]?.color} title={chart.title}>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} cx="50%" cy="42%" innerRadius={46} outerRadius={76} dataKey="value"
            label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
            {data.map((e, i) => <Cell key={i} fill={e.color} />)}
          </Pie>
          <Tooltip formatter={(v, name) => [v, name]} />
          <Legend iconSize={9} wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

function BarChartCard({ chart }) {
  return (
    <ChartWrapper accentColor={PALETTE[2]} title={chart.title}>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chart.data} margin={{ top: 4, right: 8, left: -22, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f4" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: '12px' }} />
          <Bar dataKey="value" radius={[5, 5, 0, 0]}>
            {chart.data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

function ProgressCard({ chart }) {
  return (
    <ChartWrapper accentColor={PALETTE[3]} title={chart.title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
        {chart.data.map((item, i) => {
          const color = item.color || PALETTE[i % PALETTE.length];
          const pct = Math.min(Math.max(Number(item.value) || 0, 0), 100);
          return (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontSize: '12px', color: '#555', fontWeight: '500' }}>{item.name}</span>
                <span style={{ fontSize: '12px', fontWeight: '700', color }}>{pct}%</span>
              </div>
              <div style={{ background: '#f3f4f6', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}cc, ${color})`, height: '100%', borderRadius: '999px', transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)' }} />
              </div>
            </div>
          );
        })}
      </div>
    </ChartWrapper>
  );
}

function ScorecardCard({ chart }) {
  return (
    <ChartWrapper accentColor={`linear-gradient(90deg, ${PALETTE[0]}, ${PALETTE[2]})`} title={chart.title}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px' }}>
        {chart.data.map((item, i) => {
          const color = PALETTE[i % PALETTE.length];
          return (
            <div key={i} style={{
              borderRadius: '12px', padding: '14px 10px', textAlign: 'center',
              background: `linear-gradient(135deg, ${color}10, ${color}06)`,
              border: `1px solid ${color}25`,
            }}>
              <div style={{ fontSize: '22px', fontWeight: '800', color, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{item.value}</div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '5px', fontWeight: '500' }}>{item.name}</div>
            </div>
          );
        })}
      </div>
    </ChartWrapper>
  );
}

function renderChart(chart) {
  switch (chart.chartType) {
    case 'pie':       return <PieChartCard key={chart.id} chart={chart} />;
    case 'bar':       return <BarChartCard key={chart.id} chart={chart} />;
    case 'progress':  return <ProgressCard key={chart.id} chart={chart} />;
    case 'scorecard': return <ScorecardCard key={chart.id} chart={chart} />;
    default:          return null;
  }
}

export default function CanvasArea({ isCanvasOpen, setIsCanvasOpen, canvasData, canvasWidth = 420, onReset }) {
  const [localData, setLocalData] = useState(canvasData);

  useEffect(() => { setLocalData(canvasData); }, [canvasData]);

  const handleReset = () => { setLocalData(null); onReset(); };

  return (
    <div style={{
      width: isCanvasOpen ? `${canvasWidth}px` : '0px',
      flexShrink: 0,
      opacity: isCanvasOpen ? 1 : 0,
      transition: 'width 0.25s ease, opacity 0.25s ease',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f7f8fc',
      overflow: 'hidden',
      borderLeft: isCanvasOpen ? '1px solid #e8e8ef' : 'none',
      zIndex: 1, position: 'relative',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px',
        background: 'linear-gradient(135deg, #0f0f12 0%, #1a1a2e 100%)',
        minWidth: '300px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', flexShrink: 0,
          }}>✦</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', letterSpacing: '-0.01em' }}>
              {localData ? (localData.title || '데이터 대시보드') : 'Dativus 캔버스'}
            </div>
            {localData?.description && (
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginTop: '1px' }}>
                {localData.description.slice(0, 40)}{localData.description.length > 40 ? '…' : ''}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {localData && (
            <button onClick={handleReset} style={{
              fontSize: '11px', padding: '4px 10px',
              background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px',
              cursor: 'pointer', fontWeight: '600', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            >초기화</button>
          )}
          <button onClick={() => setIsCanvasOpen(false)} style={{
            background: 'rgba(255,255,255,0.08)', border: 'none',
            color: 'rgba(255,255,255,0.5)', borderRadius: '6px',
            width: '28px', height: '28px', cursor: 'pointer', fontSize: '13px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.16)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
          >✕</button>
        </div>
      </div>

      {/* 바디 */}
      <div style={{ flex: 1, padding: '16px 16px', overflowY: 'auto', minWidth: '300px' }}>
        {!localData ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', gap: '0' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '20px',
              background: 'linear-gradient(135deg, #6366f110, #8b5cf610)',
              border: '1px solid #6366f120',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px', marginBottom: '16px',
            }}>✦</div>
            <p style={{ color: '#333', fontSize: '15px', fontWeight: '700', marginBottom: '8px' }}>대시보드가 여기에 생성됩니다</p>
            <p style={{ color: '#aaa', fontSize: '12px', lineHeight: '1.7', maxWidth: '220px' }}>목표 설정, 기술 비교, 계획 수립 등을 AI에게 물어보세요</p>
          </div>
        ) : (
          <div>
            {(localData.charts || []).map(chart => renderChart(chart))}
          </div>
        )}
      </div>
    </div>
  );
}

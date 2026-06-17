import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#6366f1', '#4caf50', '#f59e0b', '#2196f3', '#ef4444', '#e91e63'];

const cardStyle = {
  backgroundColor: '#fff', borderRadius: '16px',
  border: '1px solid #ebebeb', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
};

function buildFallbackLineData(lastScore) {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return {
      name: i === 6 ? '오늘' : `${d.getMonth() + 1}/${d.getDate()}`,
      score: i === 6 ? lastScore : null,
    };
  });
}

function buildPieData(agentUsage) {
  const entries = Object.entries(agentUsage || {});
  if (entries.length === 0) return [{ name: '데이터 없음', value: 1 }];
  return entries.map(([name, value]) => ({ name, value }));
}

export default function QualityDashboard({ stats, docList = [], agentList = [], agentUsage = {}, dailyStats = [] }) {
  const lineData = dailyStats.length > 0 ? dailyStats : buildFallbackLineData(stats.csatScore);
  const pieData = buildPieData(agentUsage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* 섹션 제목 */}
      <div style={{ fontSize: '15px', fontWeight: '700', color: '#111', paddingLeft: '2px' }}>AI 품질 리포트</div>

      {/* KPI 카드 3개 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        <div style={{ ...cardStyle, padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#999', marginBottom: '12px', letterSpacing: '0.5px' }}>AI 응답 만족도 (CSAT)</div>
          <div style={{ fontSize: '36px', fontWeight: '900', color: stats.csatScore >= 70 ? '#4caf50' : '#ff9800' }}>{stats.csatScore}%</div>
        </div>
        <div style={{ ...cardStyle, padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#999', marginBottom: '12px', letterSpacing: '0.5px' }}>총 대화 상호작용</div>
          <div style={{ fontSize: '36px', fontWeight: '900', color: '#111' }}>{stats.totalInteractions}<span style={{ fontSize: '16px', fontWeight: '600', marginLeft: '4px' }}>회</span></div>
        </div>
        <div style={{ ...cardStyle, padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#999', marginBottom: '12px', letterSpacing: '0.5px' }}>오답 자산화 수</div>
          <div style={{ fontSize: '36px', fontWeight: '900', color: '#f44336' }}>{stats.failureLogs.length}<span style={{ fontSize: '16px', fontWeight: '600', marginLeft: '4px' }}>건</span></div>
        </div>
      </div>

      {/* 차트 2개 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ ...cardStyle, padding: '28px' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#111', marginBottom: '20px' }}>만족도 추이 (Quality Drift)</div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#aaa' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#aaa' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '13px' }}
                  cursor={{ stroke: '#eee' }}
                />
                <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3.5, fill: '#6366f1' }} activeDot={{ r: 5, fill: '#4caf50' }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: '28px' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#111', marginBottom: '20px' }}>에이전트별 수행 비율</div>
          <div style={{ width: '100%', height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', flex: 1 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '13px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '12px', color: '#666' }}>
              {pieData.map((d, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[i], display: 'inline-block' }} />
                  {d.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 지식 베이스 + 커스텀 에이전트 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* 지식 베이스 현황 */}
        <div style={{ ...cardStyle, padding: '28px' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#111', marginBottom: '6px' }}>지식 베이스 현황</div>
          <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '20px' }}>팀 워크스페이스에 업로드된 문서 목록입니다.</div>
          {docList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#ccc', fontSize: '13px' }}>업로드된 문서가 없습니다.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: '#4caf50', fontWeight: '600' }}>학습 완료 {docList.filter(d => d.status === 'DONE').length}건</span>
                <span style={{ fontSize: '12px', color: '#aaa', fontWeight: '600' }}>전체 {docList.length}건</span>
              </div>
              {docList.map(doc => (
                <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
                  <span style={{ fontSize: '13px', color: '#333', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '12px' }}>
                    {doc.fileName.endsWith('.pdf') ? '📄 ' : '📝 '}{doc.fileName}
                  </span>
                  <span style={{
                    fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '12px', flexShrink: 0,
                    backgroundColor: doc.status === 'DONE' ? '#111' : '#f0f0f0',
                    color: doc.status === 'DONE' ? '#fff' : '#888',
                  }}>
                    {doc.status === 'DONE' ? '학습 완료' : '처리 중'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 커스텀 에이전트 현황 */}
        <div style={{ ...cardStyle, padding: '28px' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#111', marginBottom: '6px' }}>커스텀 에이전트 현황</div>
          <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '20px' }}>등록된 나의 에이전트 목록입니다.</div>
          {agentList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#ccc', fontSize: '13px' }}>등록된 에이전트가 없습니다.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ textAlign: 'right', fontSize: '12px', color: '#aaa', fontWeight: '600', marginBottom: '4px' }}>전체 {agentList.length}개</div>
              {agentList.map(agent => (
                <div key={agent.id} style={{ padding: '10px 12px', backgroundColor: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#111' }}>{agent.name}</span>
                    <span style={{ fontSize: '11px', color: '#888', backgroundColor: '#f0f0f0', padding: '2px 8px', borderRadius: '10px' }}>
                      임계값 {(agent.threshold ?? 0.38).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {agent.description}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* 오답 노트 */}
      <div style={{ ...cardStyle, padding: '28px' }}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: '#111', marginBottom: '6px' }}>집중 개선 필요 항목</div>
        <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '20px' }}>👎 싫어요를 선택한 대화 로그입니다. 프롬프트 개선의 핵심 자산으로 활용됩니다.</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
              <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: '700', color: '#888', textAlign: 'left' }}>사용자 질문</th>
              <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: '700', color: '#888', textAlign: 'left' }}>AI 답변</th>
              <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: '700', color: '#888', textAlign: 'left', width: '100px' }}>일시</th>
            </tr>
          </thead>
          <tbody>
            {stats.failureLogs.length === 0 ? (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', padding: '48px', color: '#bbb', fontSize: '14px' }}>
                  수집된 오답 데이터가 없습니다. 완벽한 지휘입니다!
                </td>
              </tr>
            ) : (
              stats.failureLogs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={{ padding: '12px', fontSize: '13px', fontWeight: '500', color: '#111' }}>{log.query}</td>
                  <td style={{ padding: '12px', fontSize: '13px', color: '#666', lineHeight: '1.5' }}>{log.answer}</td>
                  <td style={{ padding: '12px', fontSize: '11px', color: '#aaa' }}>{new Date(log.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}

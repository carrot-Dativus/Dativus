import { useState, useEffect, useMemo } from 'react';

const DEPARTMENTS = [
  {
    id: 'supervisor',
    name: '지휘본부',
    desc: '의도 파악 · 라우팅',
    agents: [{ name: '최고 관리자' }],
    fullWidth: true,
  },
  {
    id: 'general',
    name: '일반 대화팀',
    desc: '일상 대화 · 일반 질문',
    agents: [
      { name: '대화 기억병' },
      { name: '일반 대화병' },
    ],
  },
  {
    id: 'expert',
    name: '전문 분석팀',
    desc: 'RAG·웹 검색 · ReAct 분석',
    agents: [
      { name: '쿼리 재작성' },
      { name: '선택적 검색' },
      { name: '검색 품질 평가' },
      { name: '전문 추론병(ReAct)' },
      { name: '도구 실행' },
    ],
  },
  {
    id: 'coding',
    name: '코딩 / 수학팀',
    desc: '코드 작성 · 수학 풀이',
    agents: [
      { name: '레퍼런스 검색병' },
      { name: '코딩/수학 전문병' },
    ],
  },
  {
    id: 'review',
    name: '검수팀',
    desc: '품질 검수 · 최종 승인',
    agents: [
      { name: '대시보드 분석' },
      { name: '문서 요약병' },
      { name: '개인화 적용 중' },
      { name: '품질 검수 요원' },
      { name: '재작성 요원' },
    ],
    fullWidth: true,
  },
];

const AGENT_TO_DEPT = {
  '최고 관리자':          'supervisor',
  '역질문 처리':          'supervisor',
  '대화 기억병':          'general',
  '일반 대화병':          'general',
  '레퍼런스 검색병':      'coding',
  '코딩/수학 전문병':     'coding',
  // expert 경로 — Phase 1 검색 인텔리전스 + ReAct
  '쿼리 재작성':          'expert',
  '선택적 검색':          'expert',
  '검색 품질 평가':       'expert',
  '전문 추론병(ReAct)':   'expert',
  '도구 실행':            'expert',
  // review
  '커스텀 에이전트':      'review',
  '대시보드 분석':        'review',
  '문서 요약병':          'review',
  '개인화 적용 중':       'review',
  '품질 검수 요원':       'review',
  '재작성 요원':          'review',
};

const DEPT_STYLE = {
  idle:     { border: '#ffffff',  bg: '#12121e', titleColor: '#888',    badgeColor: '#555',    badge: '대기'    },
  active:   { border: '#3b82f6', bg: '#0d1f3c', titleColor: '#90caf9', badgeColor: '#3b82f6', badge: '진행 중' },
  done:     { border: '#22c55e', bg: '#0d2818', titleColor: '#4ade80', badgeColor: '#22c55e', badge: '완료'    },
  rejected: { border: '#ef4444', bg: '#2c0b0e', titleColor: '#f87171', badgeColor: '#ef4444', badge: '반려'    },
};

const AGENT_STYLE = {
  idle:     { border: '#ffffff',  bg: '#0e0e1a', text: '#666'    },
  active:   { border: '#3b82f6', bg: '#071529', text: '#93c5fd' },
  done:     { border: '#22c55e', bg: '#050d08', text: '#4ade80' },
  rejected: { border: '#ef4444', bg: '#110404', text: '#f87171' },
};

function PulseDot({ color = '#3b82f6', size = 6 }) {
  const [bright, setBright] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setBright(b => !b), 550);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
      backgroundColor: bright ? color : color + '44',
      transition: 'background-color 0.45s ease',
    }} />
  );
}

function AgentMiniCard({ agent, agentStatus }) {
  const s = AGENT_STYLE[agentStatus] || AGENT_STYLE.idle;
  return (
    <div style={{
      border: `1.5px solid ${s.border}`,
      borderRadius: '6px',
      backgroundColor: s.bg,
      padding: '4px 10px',
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      transition: 'border-color 0.3s, background-color 0.3s',
      whiteSpace: 'nowrap',
    }}>
      {agentStatus === 'active'   && <PulseDot color="#3b82f6" size={5} />}
      {agentStatus === 'done'     && <span style={{ color: '#22c55e', fontSize: '10px', lineHeight: 1 }}>✓</span>}
      {agentStatus === 'rejected' && <span style={{ color: '#ef4444', fontSize: '10px', lineHeight: 1 }}>✗</span>}
      {agentStatus === 'idle'     && <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#d1d5db', display: 'inline-block', flexShrink: 0 }} />}
      <span style={{ fontSize: '12px', color: s.text, fontWeight: agentStatus !== 'idle' ? '600' : '400' }}>
        {agent.name}
      </span>
    </div>
  );
}

function DeptCard({ dept, deptStatus, completedAgentNames, isCurrentlyActive }) {
  const s = DEPT_STYLE[deptStatus] || DEPT_STYLE.idle;
  return (
    <div style={{
      border: `1.5px solid ${s.border}`,
      borderRadius: '10px',
      backgroundColor: s.bg,
      padding: '10px 14px',
      flex: dept.fullWidth ? undefined : 1,
      transition: 'border-color 0.4s, background-color 0.4s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: '700', color: s.titleColor }}>{dept.name}</span>
          <span style={{ fontSize: '11px', color: s.titleColor + 'aa', marginLeft: '8px' }}>{dept.desc}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {deptStatus === 'active' && <PulseDot color="#3b82f6" size={6} />}
          <span style={{ fontSize: '10px', color: s.badgeColor, fontWeight: '600' }}>{s.badge}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
        {dept.agents.map((agent, i) => {
          let agentStatus = 'idle';
          if (completedAgentNames.has(agent.name)) {
            agentStatus = 'done';
          } else if (isCurrentlyActive) {
            if (agent.parallel) {
              // 병렬 에이전트: 모두 동시에 active 표시
              agentStatus = 'active';
            } else {
              // 순차 에이전트: 병렬 그룹이 전부 완료된 후에만 active
              const parallelAgents = dept.agents.filter(a => a.parallel);
              const allParallelDone = parallelAgents.length === 0 ||
                parallelAgents.every(a => completedAgentNames.has(a.name));
              const seqAgents = dept.agents.filter(a => !a.parallel);
              const seqDone = seqAgents.filter(a => completedAgentNames.has(a.name));
              if (allParallelDone && seqAgents.indexOf(agent) === seqDone.length) {
                agentStatus = 'active';
              }
            }
          }

          // 병렬 에이전트 사이에는 → 대신 | 구분자, 마지막 병렬→순차 경계에는 →
          const nextAgent = dept.agents[i + 1];
          const isLastInDept = i === dept.agents.length - 1;
          const showArrow = !isLastInDept && (!agent.parallel || !nextAgent?.parallel);
          const showParallelSep = !isLastInDept && agent.parallel && nextAgent?.parallel;

          return (
            <span key={agent.name} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <AgentMiniCard agent={agent} agentStatus={agentStatus} />
              {showParallelSep && <span style={{ color: '#555', fontSize: '10px' }}>‖</span>}
              {showArrow && <span style={{ color: '#d1d5db', fontSize: '11px' }}>→</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function FlowArrow({ active }) {
  return (
    <div style={{ textAlign: 'center', margin: '3px 0', color: active ? '#3b82f6' : '#222232', fontSize: '14px', transition: 'color 0.4s' }}>
      ↓
    </div>
  );
}

export default function AgentDashboard({ agentLogs, isStreaming, currentTrace, logEndRef, customAgentList = [] }) {
  // 커스텀 에이전트 부서 — 등록된 에이전트가 있을 때만 표시
  const customDept = customAgentList.length > 0 ? {
    id: 'custom',
    name: '커스텀 에이전트팀',
    desc: '자동 매칭 · 관점 추가',
    agents: customAgentList.map(a => ({ name: a.name })),
  } : null;

  const { completedAgentNames, deptStatus, stats } = useMemo(() => {
    const names = new Set();
    let lastDept = null;
    let hasRejection = false;

    // 커스텀 에이전트 이름 → 'custom' 부서 동적 매핑
    const customNameSet = new Set(customAgentList.map(a => a.name));

    for (const log of agentLogs) {
      // 일반 로그: [에이전트명] 형식
      const match = log.match(/\[([^\]]+)\]/);
      if (match) {
        const name = match[1];
        names.add(name);
        const deptId = customNameSet.has(name) ? 'custom' : AGENT_TO_DEPT[name];
        if (deptId) lastDept = deptId;
      }
      // 다중 에이전트 로그: "다중 에이전트 활성화: A, B, C" (대괄호 없음)
      const multiMatch = log.match(/다중 에이전트 활성화: (.+)/);
      if (multiMatch) {
        for (const name of multiMatch[1].split(', ').map(n => n.trim())) {
          names.add(name);
          if (customNameSet.has(name)) lastDept = 'custom';
        }
      }
      if (log.includes('반려')) hasRejection = true;
    }

    const status = {};
    for (const dept of DEPARTMENTS) {
      const anyDone = dept.agents.some(a => names.has(a.name)) ||
        [...names].some(n => AGENT_TO_DEPT[n] === dept.id);
      if (!anyDone) {
        status[dept.id] = 'idle';
      } else if (isStreaming && dept.id === lastDept && dept.id !== 'supervisor') {
        status[dept.id] = 'active';
      } else if (dept.id === 'review' && hasRejection && names.has('재작성 요원')) {
        status[dept.id] = 'rejected';
      } else {
        status[dept.id] = 'done';
      }
    }

    // 커스텀 에이전트 부서 상태
    if (customAgentList.length > 0) {
      const anyCustomDone = customAgentList.some(a => names.has(a.name));
      if (!anyCustomDone) {
        status['custom'] = 'idle';
      } else if (isStreaming && lastDept === 'custom') {
        status['custom'] = 'active';
      } else {
        status['custom'] = 'done';
      }
    }

    const latencyLog = [...agentLogs].reverse().find(l => l.includes('소요 시간'));
    let stats = null;
    if (latencyLog) {
      const latency = latencyLog.match(/소요 시간:\s*([\d.]+)초/)?.[1];
      const tokens = latencyLog.match(/소모 토큰:\s*(\d+)/)?.[1];
      if (latency) stats = { latency, tokens };
    }

    return { completedAgentNames: names, deptStatus: status, stats };
  }, [agentLogs, isStreaming, customAgentList]);

  const isFlowActive = isStreaming || agentLogs.length > 0;
  const reviewActive = deptStatus['review'] === 'active' || deptStatus['review'] === 'done' || deptStatus['review'] === 'rejected';

  return (
    <div style={{ padding: '20px', backgroundColor: '#09090f', borderRadius: '8px', fontFamily: "'Consolas', 'D2Coding', 'Malgun Gothic', monospace" }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '16px', borderBottom: '1px solid #1a1a2e', paddingBottom: '12px',
      }}>
        <span style={{ fontWeight: '700', fontSize: '13px', color: '#e2e8f0', letterSpacing: '0.5px' }}>
          워크플로우 모니터
        </span>
        {isStreaming ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#f59e0b' }}>
            <PulseDot color="#f59e0b" size={6} /> 진행 중
          </span>
        ) : agentLogs.length > 0 ? (
          <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: '600' }}>완료</span>
        ) : (
          <span style={{ fontSize: '11px', color: '#d1d5db' }}>대기</span>
        )}
      </div>

      {/* 파이프라인 */}
      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>
        <DeptCard dept={DEPARTMENTS[0]} deptStatus={deptStatus['supervisor']}
          completedAgentNames={completedAgentNames} isCurrentlyActive={deptStatus['supervisor'] === 'active'} />

        <FlowArrow active={isFlowActive} />

        <div style={{ display: 'flex', gap: '8px' }}>
          {DEPARTMENTS.slice(1, 4).map(dept => (
            <DeptCard key={dept.id} dept={dept} deptStatus={deptStatus[dept.id]}
              completedAgentNames={completedAgentNames} isCurrentlyActive={deptStatus[dept.id] === 'active'} />
          ))}
        </div>

        {customDept && (
          <>
            <FlowArrow active={deptStatus['custom'] === 'active' || deptStatus['custom'] === 'done'} />
            <DeptCard dept={customDept} deptStatus={deptStatus['custom'] || 'idle'}
              completedAgentNames={completedAgentNames} isCurrentlyActive={deptStatus['custom'] === 'active'} />
          </>
        )}

        <FlowArrow active={reviewActive} />

        <DeptCard dept={DEPARTMENTS[4]} deptStatus={deptStatus['review']}
          completedAgentNames={completedAgentNames} isCurrentlyActive={deptStatus['review'] === 'active'} />
      </div>

      {/* 통계 */}
      {stats && !isStreaming && (
        <div style={{
          display: 'flex', gap: '16px', marginBottom: '14px',
          padding: '8px 14px', backgroundColor: '#0f0f1a', borderRadius: '6px',
          border: '1px solid #1a1a2e', fontSize: '12px', color: '#888',
        }}>
          <span>{stats.latency}s</span>
          {stats.tokens && <span>{stats.tokens} tokens</span>}
          <span>{completedAgentNames.size} nodes</span>
        </div>
      )}

      {/* 로그 */}
      <div style={{ borderTop: '1px solid #1a1a2e', paddingTop: '12px' }}>
        <div style={{ fontSize: '10px', color: '#333', marginBottom: '8px', letterSpacing: '1.5px', fontWeight: '600' }}>LOG</div>
        <div className="dark-scroll" style={{ maxHeight: '160px', overflowY: 'auto' }}>
          {agentLogs.length === 0 && (
            <div style={{ color: '#333', fontSize: '12px' }}>
              {isStreaming ? '초기화 중...' : '질문을 입력하면 워크플로우가 시작됩니다.'}
            </div>
          )}
          {agentLogs.map((log, idx) => {
            let color = '#3a3a5a';
            if (log.includes('✅') || log.includes('통과')) color = '#22c55e';
            else if (log.includes('❌') || log.includes('반려')) color = '#ef4444';
            else if (log.includes('소요 시간') || log.includes('모든 에이전트')) color = '#f59e0b';
            return (
              <div key={idx} style={{ margin: '3px 0', fontSize: '11px', color, paddingBottom: '3px', borderBottom: '1px solid #0f0f18' }}>
                <span style={{ color: '#2a2a40', marginRight: '6px' }}>▶</span>{log}
              </div>
            );
          })}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosInstance';

export function useMyPage() {
  const navigate = useNavigate();
  const currentUserId = localStorage.getItem('user_id');

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('로딩 중...');
  const [decisionStyle, setDecisionStyle] = useState('일반적인');
  const [expertise, setExpertise] = useState('기본');
  const [tone, setTone] = useState('친절한');
  // Phase 1: 자유 입력형 개인화 지시문
  // TODO Phase 2: 피드백 기반 자동 학습 + 개인화 대시보드 시각화
  const [personaMemo, setPersonaMemo] = useState('');
  const [stats, setStats] = useState({ totalInteractions: 0, csatScore: 0, failureLogs: [] });
  const [docList, setDocList] = useState([]);
  const [agentList, setAgentList] = useState([]);
  const [agentUsage, setAgentUsage] = useState({});
  const [dailyStats, setDailyStats] = useState([]);

  useEffect(() => {
    if (!currentUserId) {
      alert('비정상적인 접근입니다.');
      navigate('/');
      return;
    }

    const fetchData = async () => {
      try {
        const profileRes = await apiClient.get(`/api/v1/users/${currentUserId}`);
        if (profileRes.ok) {
          const data = await profileRes.json();
          setEmail(data.email);
          setUsername(data.username);
          setDecisionStyle(data.decisionStyle);
          setExpertise(data.expertise);
          setTone(data.tone);
          const memo = data.personaMemo || '';
          setPersonaMemo(memo);
          // 채팅에서 API 호출 없이 바로 사용할 수 있도록 최신값 동기화
          localStorage.setItem('persona_memo', memo);
          localStorage.setItem('persona_expertise', data.expertise || '');
          localStorage.setItem('persona_tone', data.tone || '');
          localStorage.setItem('persona_decision_style', data.decisionStyle || '');
        }

        const statsRes = await apiClient.get(`/api/v1/feedback/stats/${currentUserId}`);
        if (statsRes.ok) setStats(await statsRes.json());

        const workspaceId = localStorage.getItem('workspace_id');
        if (workspaceId && workspaceId !== 'null') {
          const docsRes = await apiClient.get(`/api/v1/documents/workspace/${workspaceId}`);
          if (docsRes.ok) setDocList(await docsRes.json());
        }

        const agentsRes = await apiClient.get(`/api/v1/agents/user/${currentUserId}`);
        if (agentsRes.ok) setAgentList(await agentsRes.json());

        const usageRes = await apiClient.get(`/api/v1/agents/usage/user/${currentUserId}`);
        if (usageRes.ok) setAgentUsage(await usageRes.json());

        const dailyRes = await apiClient.get(`/api/v1/feedback/stats/daily/${currentUserId}`);
        if (dailyRes.ok) setDailyStats(await dailyRes.json());
      } catch (error) {
        console.error('데이터 동기화 실패:', error);
      }
    };

    fetchData();
  }, [currentUserId, navigate]);

  const handleSavePersona = async () => {
    if (!currentUserId) return;
    try {
      // ✅ apiClient.put 사용 (axiosInstance.js에 put 추가 후 사용 가능)
      const response = await apiClient.put(`/api/v1/users/${currentUserId}/persona`, {
        decisionStyle, expertise, tone, personaMemo,
      });
      if (response.ok) {
        // 채팅에서 매번 API 호출 없이 바로 사용할 수 있도록 로컬 캐싱
        localStorage.setItem('persona_memo', personaMemo);
        localStorage.setItem('persona_expertise', expertise);
        localStorage.setItem('persona_tone', tone);
        localStorage.setItem('persona_decision_style', decisionStyle);
        alert('AI 어시스턴트의 성향이 업데이트되었습니다.');
      }
    } catch {
      alert('서버와 연결할 수 없습니다.');
    }
  };

  return {
    email,
    username,
    decisionStyle, setDecisionStyle,
    expertise, setExpertise,
    tone, setTone,
    personaMemo, setPersonaMemo,
    stats,
    docList,
    agentList,
    agentUsage,
    dailyStats,
    handleSavePersona,
  };
}

import { useState } from 'react';
import { apiClient } from '../api/axiosInstance';

// 빌트인 에이전트 — DB 저장 없이 force_agent로 처리
const BUILTIN_AGENTS = [
  { id: 'general_agent',      name: '일반 대화',   description: '', _builtin: true },
  { id: 'expert_agent',       name: '전문 분석',   description: '', _builtin: true },
  { id: 'coding_math_agent',  name: '코딩 / 수학', description: '', _builtin: true },
  { id: 'local_test',         name: '로컬 테스트', description: '', _builtin: true },
  { id: 'pure_llm',           name: '순수 LLM',   description: '', _builtin: true },
];

export function useAgents(currentUserId) {
  const [agentList, setAgentList] = useState([]);
  const [agentForm, setAgentForm] = useState({ name: '', description: '', agentType: 'LOCAL', threshold: 0.38 });
  const [selectedAgentId, setSelectedAgentId] = useState('');

  const fetchAgents = async () => {
    if (!currentUserId) return;
    try {
      const res = await apiClient.get(`/api/v1/agents/user/${currentUserId}`);
      if (res.ok) setAgentList(await res.json());
    } catch {
      console.error('자아 목록 로드 실패');
    }
  };

  const [editingAgent, setEditingAgent] = useState(null); // { id, name, description, agentType, threshold }

  const handleCreateAgent = async (onSuccess) => {
    if (!agentForm.name.trim() || !agentForm.description.trim()) {
      alert('요원의 이름과 성격을 모두 입력해 주십시오!');
      return;
    }
    try {
      const res = await apiClient.post('/api/v1/agents', {
        userId: currentUserId,
        name: agentForm.name,
        description: agentForm.description,
        agentType: agentForm.agentType,
        threshold: agentForm.threshold,
      });
      if (res.ok) {
        alert('새로운 자아가 각인되었습니다!');
        setAgentForm({ name: '', description: '', agentType: 'LOCAL', threshold: 0.38 });
        fetchAgents();
        onSuccess?.();
      } else {
        alert('자아 생성 실패!');
      }
    } catch {
      alert('통신 오류 발생!');
    }
  };

  const handleUpdateAgent = async (onSuccess) => {
    if (!editingAgent?.name?.trim() || !editingAgent?.description?.trim()) {
      alert('이름과 성격을 모두 입력해 주십시오!');
      return;
    }
    try {
      const res = await apiClient.put(`/api/v1/agents/${editingAgent.id}`, {
        name: editingAgent.name,
        description: editingAgent.description,
        agentType: editingAgent.agentType,
        threshold: editingAgent.threshold,
      });
      if (res.ok) {
        setEditingAgent(null);
        fetchAgents();
        onSuccess?.();
      } else {
        alert('수정 실패!');
      }
    } catch {
      alert('통신 오류 발생!');
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (!window.confirm('이 에이전트를 삭제하시겠습니까?')) return;
    try {
      const res = await apiClient.delete(`/api/v1/agents/${agentId}`);
      if (res.ok) {
        if (selectedAgentId === agentId) setSelectedAgentId('');
        fetchAgents();
      } else {
        alert('삭제 실패!');
      }
    } catch {
      alert('통신 오류 발생!');
    }
  };

  // 빌트인 + 커스텀 전체에서 선택된 에이전트 객체 반환
  const allAgents = [...BUILTIN_AGENTS, ...agentList];
  const selectedAgent = allAgents.find(a => a.id === selectedAgentId) || null;

  return {
    agentList,
    agentForm, setAgentForm,
    editingAgent, setEditingAgent,
    selectedAgentId, setSelectedAgentId,
    selectedAgent,
    fetchAgents,
    handleCreateAgent,
    handleUpdateAgent,
    handleDeleteAgent,
  };
}

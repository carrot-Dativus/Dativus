import { useState, useEffect } from 'react';
import { apiClient } from '../api/axiosInstance';

export function useWorkspace(currentUserId) {
  const [workspaces, setWorkspaces] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    if (!currentUserId) return;
    apiClient.get(`/api/v1/workspaces/user/${currentUserId}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setWorkspaces(data))
      .catch(() => console.error('방 목록 통신 실패'));
  }, [currentUserId]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) { alert('팀 이름을 입력하세요!'); return; }
    try {
      const res = await apiClient.post('/api/v1/workspaces', { name: newTeamName });
      const data = await res.json();
      await handleJoinTeam(data.inviteCode);
    } catch {
      alert('팀 생성 실패!');
    }
  };

  const handleJoinTeam = async (codeToJoin) => {
    const code = codeToJoin || inviteCode;
    if (!code.trim()) { alert('초대 코드를 입력하세요!'); return; }
    try {
      const res = await apiClient.post('/api/v1/workspaces/join', {
        userId: currentUserId,
        inviteCode: code,
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('workspace_id', data.workspace_id);
        alert('팀 배정 완료!');
        window.location.reload();
      } else {
        alert('유효하지 않은 코드입니다.');
      }
    } catch {
      alert('팀 합류 실패!');
    }
  };

  return {
    workspaces,
    newTeamName, setNewTeamName,
    inviteCode, setInviteCode,
    handleCreateTeam,
    handleJoinTeam,
  };
}

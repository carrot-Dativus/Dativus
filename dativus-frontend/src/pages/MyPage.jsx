import { useNavigate } from 'react-router-dom';
import { useMyPage } from '../hooks/useMyPage';
import { apiClient } from '../api/axiosInstance';
import dativusLogo from '../assets/Dativus_logo.png';
import PersonaCard from '../components/mypage/PersonaCard';
import QualityDashboard from '../components/mypage/QualityDashboard';

export default function MyPage() {
  const navigate = useNavigate();
  const {
    email, username,
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
  } = useMyPage();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 50px', borderBottom: '1px solid #eee', backgroundColor: '#fff' }}>
        <img src={dativusLogo} alt="Dativus" onClick={() => navigate('/')} style={{ height: '30px', objectFit: 'contain', cursor: 'pointer' }} />
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => navigate('/chat')}
            style={{ padding: '7px 16px', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#555' }}
          >
            채팅방으로
          </button>
          <button
            onClick={() => apiClient.logout()}
            style={{ padding: '7px 16px', border: 'none', borderRadius: '8px', background: '#111', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#fff' }}
          >
            로그아웃
          </button>
        </div>
      </header>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ marginBottom: '36px' }}>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#111', letterSpacing: '1px' }}>마이페이지</div>
          <div style={{ fontSize: '13px', color: '#999', marginTop: '4px' }}>계정 정보 및 AI 성향을 관리합니다</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <PersonaCard
            email={email}
            username={username}
            decisionStyle={decisionStyle} setDecisionStyle={setDecisionStyle}
            expertise={expertise} setExpertise={setExpertise}
            tone={tone} setTone={setTone}
            personaMemo={personaMemo} setPersonaMemo={setPersonaMemo}
            onSave={handleSavePersona}
          />
          <QualityDashboard stats={stats} docList={docList} agentList={agentList} agentUsage={agentUsage} dailyStats={dailyStats} />
        </div>
      </div>

    </div>
  );
}

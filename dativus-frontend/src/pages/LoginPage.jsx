import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosInstance';
import dativusLogo from '../assets/Dativus_logo.png';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('token') && localStorage.getItem('workspace_id')) {
      navigate('/chat');
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await apiClient.post('/api/v1/auth/login', { email, password });
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        localStorage.setItem('user_id', data.user_id);
        localStorage.setItem('workspace_id', data.workspace_id);
        if (data.username) localStorage.setItem('username', data.username);
        navigate('/chat');
      } else {
        alert('로그인 실패: 이메일이나 비밀번호를 확인하세요.');
      }
    } catch {
      alert('서버와 연결할 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>

      {/* 헤더 */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 50px', backgroundColor: '#fff', borderBottom: '1px solid #eee' }}>
        <img src={dativusLogo} alt="Dativus" onClick={() => navigate('/')} style={{ height: '30px', objectFit: 'contain', cursor: 'pointer' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: '#888', cursor: 'pointer' }} onClick={() => navigate('/register')}>
            계정이 없으신가요?
          </span>
          <button
            onClick={() => navigate('/register')}
            style={{ padding: '7px 16px', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#555' }}
          >
            회원가입
          </button>
        </div>
      </header>

      {/* 본문 */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>

          {/* 카드 */}
          <div style={{ backgroundColor: '#fff', borderRadius: '20px', border: '1px solid #ebebeb', boxShadow: '0 4px 24px rgba(0,0,0,0.07)', padding: '48px 40px' }}>

            {/* 로고 + 타이틀 */}
            <div style={{ textAlign: 'center', marginBottom: '36px' }}>
              <img src={dativusLogo} alt="Dativus" style={{ height: '28px', objectFit: 'contain', marginBottom: '20px' }} />
              <div style={{ fontSize: '22px', fontWeight: '700', color: '#111', letterSpacing: '-0.3px' }}>다시 만나서 반가워요</div>
              <div style={{ fontSize: '13px', color: '#999', marginTop: '6px' }}>계정에 로그인하세요</div>
            </div>

            {/* 폼 */}
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#555', letterSpacing: '0.3px' }}>이메일</label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    padding: '12px 14px', border: '1px solid #e0e0e0', borderRadius: '10px',
                    fontSize: '14px', color: '#111', outline: 'none', boxSizing: 'border-box', width: '100%',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#111'}
                  onBlur={e => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#555', letterSpacing: '0.3px' }}>비밀번호</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    padding: '12px 14px', border: '1px solid #e0e0e0', borderRadius: '10px',
                    fontSize: '14px', color: '#111', outline: 'none', boxSizing: 'border-box', width: '100%',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#111'}
                  onBlur={e => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  marginTop: '8px', width: '100%', padding: '13px',
                  backgroundColor: isLoading ? '#555' : '#111', color: '#fff',
                  border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700',
                  cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s',
                }}
              >
                {isLoading ? '로그인 중...' : '로그인'}
              </button>
            </form>

            {/* 하단 링크 */}
            <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: '#999' }}>
              계정이 없으신가요?{' '}
              <span
                onClick={() => navigate('/register')}
                style={{ color: '#111', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' }}
              >
                회원가입
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

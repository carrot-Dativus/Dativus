import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosInstance';
import dativusLogo from '../assets/Dativus_logo.png';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordCheck, setPasswordCheck] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== passwordCheck) {
      alert('비밀번호와 비밀번호 확인이 다릅니다!');
      return;
    }
    setIsLoading(true);
    try {
      const response = await apiClient.post('/api/v1/users/register', { email, password, username });
      if (response.ok) {
        alert('회원가입 성공! 로그인해 주세요.');
        navigate('/login');
      } else {
        alert('회원가입 실패');
      }
    } catch {
      alert('서버 연결 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = {
    padding: '12px 14px', border: '1px solid #e0e0e0', borderRadius: '10px',
    fontSize: '14px', color: '#111', outline: 'none', boxSizing: 'border-box', width: '100%',
    transition: 'border-color 0.2s',
  };
  const labelStyle = { fontSize: '12px', fontWeight: '600', color: '#555', letterSpacing: '0.3px' };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>

      {/* 헤더 */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 50px', backgroundColor: '#fff', borderBottom: '1px solid #eee' }}>
        <img src={dativusLogo} alt="Dativus" onClick={() => navigate('/')} style={{ height: '30px', objectFit: 'contain', cursor: 'pointer' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: '#888' }}>이미 계정이 있으신가요?</span>
          <button
            onClick={() => navigate('/login')}
            style={{ padding: '7px 16px', border: 'none', borderRadius: '8px', background: '#111', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#fff' }}
          >
            로그인
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
              <div style={{ fontSize: '22px', fontWeight: '700', color: '#111', letterSpacing: '-0.3px' }}>Dativus 시작하기</div>
              <div style={{ fontSize: '13px', color: '#999', marginTop: '6px' }}>무료로 계정을 만들어보세요</div>
            </div>

            {/* 폼 */}
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>이름</label>
                <input
                  type="text"
                  placeholder="홍길동"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#111'}
                  onBlur={e => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>이메일</label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#111'}
                  onBlur={e => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>비밀번호</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#111'}
                  onBlur={e => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>비밀번호 확인</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={passwordCheck}
                  onChange={(e) => setPasswordCheck(e.target.value)}
                  required
                  style={inputStyle}
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
                {isLoading ? '가입 중...' : '가입하기'}
              </button>
            </form>

            {/* 하단 링크 */}
            <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: '#999' }}>
              이미 계정이 있으신가요?{' '}
              <span
                onClick={() => navigate('/login')}
                style={{ color: '#111', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' }}
              >
                로그인
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

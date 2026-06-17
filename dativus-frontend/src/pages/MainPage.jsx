import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function MainPage() {
  const navigate = useNavigate();

  // 💡 메인 화면에 들어왔는데 금고에 출입증이 없으면? 쫓아냅니다!
  useEffect(() => {
    if (!localStorage.getItem('token')) {
      alert("비정상적인 접근입니다. 로그인해 주세요.");
      navigate('/'); 
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token'); // 토큰 파쇄
    navigate('/'); // 쫓아내기
  };

  return (
    <div style={{ textAlign: 'center', padding: '100px', fontFamily: "'Noto Sans KR', sans-serif" }}>
      <h1 style={{ fontSize: '40px', color: '#333' }}>Dativus 메인 지휘소</h1>
      <p>환영합니다, 지휘관님! 출입증이 완벽하게 확인되었습니다.</p>
      <button onClick={handleLogout} style={{ padding: '15px 30px', backgroundColor: '#ff3b3b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
        로그아웃
      </button>
    </div>
  );
}
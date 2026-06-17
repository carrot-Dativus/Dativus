import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import MyPage from './pages/MyPage';
import ProtectedRoute from './components/ProtectedRoute'; // 💡 인가 검문소(방어막) 요원 호출!
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 🔓 누구나 접근 가능한 일반 공개 구역 */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* 🔒 출입증(토큰)이 있어야만 입장이 허가되는 철통 보안 구역 */}
        <Route 
          path="/chat" 
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/mypage" 
          element={
            <ProtectedRoute>
              <MyPage />
            </ProtectedRoute>
          } 
        />
        
        {/* 🚨 그 외 존재하지 않는 모든 구역은 즉시 로그인 화면으로 이송 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
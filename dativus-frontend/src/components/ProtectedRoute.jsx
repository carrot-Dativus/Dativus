import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
    // 1. 유저의 로컬 스토리지에서 토큰(출입증)을 검사합니다.
    const token = localStorage.getItem('token');

    // 2. 토큰이 없다면? 경고를 띄우고 로그인 페이지('/')로 강제 이송합니다.
    if (!token) {
        alert("인가되지 않은 접근입니다. 로그인 후 이용해 주십시오.");
        return <Navigate to="/login" replace />;
    }

    // 3. 토큰이 있다면? 무사히 원하는 컴포넌트(children)를 렌더링해 줍니다.
    return children;
}
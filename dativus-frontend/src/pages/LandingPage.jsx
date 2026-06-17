import { useNavigate } from 'react-router-dom';
import dativusLogo from '../assets/Dativus_logo.png';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();

  const goToChat = () => {
    const token = localStorage.getItem('token');
    const workspaceId = localStorage.getItem('workspace_id');
    if (token && workspaceId) {
      navigate('/chat');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="landing-body">
      <div className="dativus-container">
        <nav className="navbar">
          <div className="logo-container">
            <img src={dativusLogo} alt="Dativus" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ height: '36px', objectFit: 'contain', cursor: 'pointer' }} />
          </div>
          <div className="nav-actions">
            <button className="nav-link" onClick={() => navigate('/register')}>회원가입</button>
            <button className="btn-login" onClick={() => navigate('/login')}>로그인</button>
          </div>
        </nav>

        <section className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">
              파편화된 팀의 기억을<br />통합하는 제3의 AI 팀원
            </h1>
            <p className="hero-subtitle">
              카카오톡, 노션, 깃허브에 흩어진 데이터를 하나의 집단 지성으로.<br />
              데이터 유출 걱정 없는 Zero-Trust 하이브리드 RAG 플랫폼, 다티부스입니다.
            </p>
            <div className="hero-buttons">
              <button className="btn-primary" onClick={() => navigate('/register')}>지금 무료로 시작하기</button>
              <button className="btn-secondary" onClick={goToChat}>다티와 채팅해보기</button>
            </div>
          </div>

          <div className="hero-gallery">
            <div className="gallery-item">
              <div className="mockup-container chat-mockup">
                <div className="chat-bubble bubble-user">다티, 최신 깃허브 PR 내용 요약해줘.</div>
                <div className="chat-bubble bubble-ai-typing">
                  <div className="typing-dot"></div><div className="typing-dot"></div><div className="typing-dot"></div>
                </div>
                <div className="chat-bubble bubble-ai-content">
                  최근 3개의 PR을 분석했습니다.<br />
                  - 데이터 파이프라인 최적화<br />
                  - ChromaDB 인덱싱 개선
                </div>
              </div>
            </div>

            <div className="img-stack">
              <div className="gallery-item code-mockup">
                <div className="code-line line-1">&gt; Connecting to local node...</div>
                <div className="code-line line-2">&gt; Fetching vector embeddings...</div>
                <div className="code-line line-3">&gt; Status: 100% Secure</div>
              </div>
              <div className="gallery-item network-mockup">
                <div className="pulse-dot"></div>
                <div className="pulse-ring"></div>
                <div className="pulse-ring"></div>
              </div>
            </div>
          </div>
        </section>

        <section className="features-section">
          <div className="section-header">
            <h2 className="section-title">왜 Dativus인가?</h2>
            <p className="section-subtitle">팀의 집단 지성을 데이터 유출 걱정 없이 활용하세요</p>
          </div>
          <div className="features-grid">
            <div className="feature-card card-small">
              <div className="feature-text">
                <h3>완벽한 데이터 주권과 제로 비용</h3>
                <p>48GB 분리 볼륨의 독립 ChromaDB와 물리적 로컬 망을 활용해 상용 API 비용 없이 완벽한 보안을 실현합니다.</p>
              </div>
              <div className="deco-security"></div>
            </div>

            <div className="feature-card card-tall">
              <div className="feature-text">
                <h3>멈추지 않는 멀티 에이전트 토론</h3>
                <p>LangGraph 기반 워크플로우를 통해 로컬 AI와 외부 AI가 상호 비판하며 환각(Hallucination)을 제어하는 과정을 실시간으로 지켜보세요.</p>
              </div>
              <div className="deco-network">
                <div className="network-nodes"></div>
              </div>
            </div>

            <div className="feature-card card-small">
              <div className="feature-text">
                <h3>실시간 Ego-Dashboard</h3>
                <p>GPU 로드율, DB 지연 시간, 벡터 밀집도를 프론트엔드에서 실시간 그래프로 모니터링하세요.</p>
              </div>
              <div className="deco-chart">
                <div className="chart-bar"></div>
                <div className="chart-bar"></div>
                <div className="chart-bar"></div>
                <div className="chart-bar"></div>
              </div>
            </div>
          </div>
        </section>

        <section className="pricing-section">
          <div className="section-header">
            <h2 className="section-title">심플한 요금제</h2>
            <p className="section-subtitle">팀 규모에 맞는 플랜을 선택하세요</p>
          </div>
          <div className="pricing-grid">
            <div className="pricing-card">
              <div className="plan-header">
                <h4>무료 플랜</h4>
                <p className="plan-type">Local Hybrid · 2인 팀</p>
              </div>
              <div className="plan-price">
                <h2>$0</h2><span>/ month</span>
              </div>
              <ul className="plan-features">
                <li>✓ 로컬 자원 활용</li>
                <li>✓ 팀원 2명까지 무료</li>
                <li>✓ 기본 ChromaDB 지원</li>
              </ul>
              <button className="btn-plan-outline" onClick={() => navigate('/register')}>시작하기</button>
            </div>

            <div className="pricing-card pricing-card-featured">
              <div className="plan-badge">추천</div>
              <div className="plan-header">
                <h4>스타트업 플랜</h4>
                <p className="plan-type">Cloud Scale · 10인 팀</p>
              </div>
              <div className="plan-price">
                <h2>$19</h2><span>/ month</span>
              </div>
              <ul className="plan-features">
                <li>✓ 클라우드 혼합형 인프라</li>
                <li>✓ 팀원 10명까지 확장</li>
                <li>✓ 고급 대시보드 메트릭 제공</li>
              </ul>
              <button className="btn-plan-solid" onClick={() => navigate('/register')}>시작하기</button>
            </div>

            <div className="pricing-card">
              <div className="plan-header">
                <h4>엔터프라이즈</h4>
                <p className="plan-type">Zero-Trust 온프레미스</p>
              </div>
              <div className="plan-price">
                <h2>문의</h2>
              </div>
              <ul className="plan-features">
                <li>✓ 기업 내부망 완벽 독립 구축</li>
                <li>✓ 커스텀 AI 에이전트 튜닝 지원</li>
                <li>✓ 전담 기술 지원</li>
              </ul>
              <button className="btn-plan-outline" onClick={() => navigate('/register')}>문의하기</button>
            </div>
          </div>
        </section>

        <footer className="landing-footer">
          <img src={dativusLogo} alt="Dativus" style={{ height: '24px', objectFit: 'contain', opacity: 0.5 }} />
          <p>© 2026 Dativus. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}

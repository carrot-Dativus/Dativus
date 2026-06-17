# 🥕 Dativus (다티부스)

> **LangGraph 기반 멀티 에이전트 AI 챗봇 시스템**
> 사용자의 맥락을 이해하고 최적의 답변을 생성하는 개인화된 '제2의 뇌' AI 워크스페이스

---

## 💡 프로젝트 개요

다티부스(Dativus)는 단순한 단일 LLM 호출을 넘어, LangGraph를 활용한 다중 에이전트(Multi-Agent) 협업 및 라우팅 구조를 통해 할루시네이션을 최소화하고 응답 품질을 극대화하는 AI 챗봇 시스템입니다.

팀/개인 워크스페이스, 실시간 캔버스(대시보드), 멀티 패널 UI, RAG 기반 도메인 지식 검색, 단/장기 메모리 분리, 에이전트 트레이싱 등의 기능을 제공합니다.

---

## 🏗 시스템 아키텍처

```
[React Frontend] ──→ [Spring Boot Backend] ──→ [FastAPI AI Core]
       ↑                      ↓                        ↓
   Nginx (80)           PostgreSQL              LangGraph 라우터
                         Neo4j               ┌─ General Agent    (Groq llama-3.1-8b)
                        ChromaDB             ├─ Expert Agent     (Groq llama-3.3-70b)
                                             └─ Coding/Math Agent(Groq llama-3.3-70b)
                                                     ↓ 폴백
                                             Ollama qwen2.5:14b (로컬)
```

| 서비스 | 역할 | 기술 스택 |
|---|---|---|
| `dativus-frontend/` | UI/UX, 실시간 채팅 워크스페이스 | React, Vite, Nginx |
| `server/` | 인증(JWT), 세션/워크스페이스 관리, API 게이트웨이 | Spring Boot 3, Java 21, PostgreSQL |
| `Dativus_Ai/` | LangGraph 라우팅, LLM 추론, RAG, 메모리 | FastAPI, Python 3.11, LangGraph, ChromaDB, Neo4j |

---

## ✨ 주요 기능

- **지능형 에이전트 라우팅** — 사용자 의도를 파악해 최적의 에이전트에 동적 할당
- **팀/개인 워크스페이스** — 팀 공유 채팅 + 개인 AI 채팅 분리 운영
- **실시간 캔버스** — AI가 자동 생성하는 대시보드 (차트, 표 등)
- **RAG 기반 도메인 검색** — ChromaDB 벡터 DB + Neo4j 그래프 메모리
- **단/장기 메모리 분리** — 에피소딕(JSONL) + 시맨틱(Neo4j SemanticFact) 이중 구조
- **멀티 패널 UI** — VS Code 스타일 분할/플로팅 패널
- **팀 실시간 채팅** — WebSocket 기반 팀 전용 채널 (AI 있는/없는 모드)
- **에이전트 트레이싱** — 요청별 trace_id, 노드 타이밍, 라우팅 이력 JSONL 저장

---

## ⚠️ 실행 전 필수 요구사항

이 프로젝트는 **외부 API + 로컬 LLM**을 함께 사용합니다. `docker compose up -d` 만으로는 동작하지 않으며, 아래 사항을 반드시 준비해야 합니다.

### 1. Groq API Key (필수)

메인 LLM 엔진으로 Groq API를 사용합니다.

- [console.groq.com](https://console.groq.com/) 에서 무료 계정 생성 후 API Key 발급
- 사용 모델: `llama-3.1-8b-instant` (라우팅/일반), `llama-3.3-70b-versatile` (전문/코딩)
- 무료 플랜 사용량 제한 있음 (분당 토큰 제한)

### 2. Ollama + qwen2.5:14b (필수)

역질문 생성 및 Groq API 한도 초과 시 폴백 LLM으로 사용합니다.
Docker 컨테이너가 아닌 **Host 머신에서 직접 실행**해야 합니다.

```bash
# Ollama 설치: https://ollama.com/
ollama pull qwen2.5:14b   # 약 9GB, 최초 1회만
ollama serve               # 11434 포트로 실행 (보통 설치 시 자동 실행)
```

> **주의:** Ollama 없이 실행하면 역질문 기능이 동작하지 않으며, Groq API 한도 초과 시 에러가 발생합니다.

### 3. Neo4j 비밀번호 설정

장기 메모리 저장에 사용하는 그래프 DB입니다. Docker가 자동으로 컨테이너를 실행하므로 별도 설치는 불필요합니다.
`.env` 파일에 비밀번호만 지정하면 됩니다 (아무 값이나 가능).

```env
NEO4J_PASSWORD=your_neo4j_password
```

### 4. BAAI/bge-m3 임베딩 모델 (자동 다운로드)

시맨틱 검색에 사용하는 SentenceTransformer 모델입니다.
FastAPI 컨테이너 최초 실행 시 자동으로 다운로드됩니다 **(약 1.5GB, 인터넷 필요)**.

> 최초 실행 시 FastAPI 서버가 뜨는 데 수 분이 걸릴 수 있습니다.

---

## 🚀 실행 방법

### 1. 저장소 클론

```bash
git clone https://github.com/carrot-Dativus/Dativus.git
cd Dativus
```

### 2. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열어 아래 값을 채워주세요:

```env
DB_PASSWORD=your_db_password
NEO4J_PASSWORD=your_neo4j_password
JWT_SECRET=your_jwt_secret_key
JWT_SECRET_KEY=your_jwt_secret_key   # Spring과 동일한 값
GROQ_API_KEY=your_groq_api_key       # Groq Console에서 발급
CORS_ALLOWED_ORIGINS=http://localhost
```

### 3. Ollama 실행 확인

```bash
ollama list   # qwen2.5:14b 가 목록에 있는지 확인
```

없으면:

```bash
ollama pull qwen2.5:14b
```

### 4. 실행

```bash
docker compose up -d
```

**최초 실행 시** BAAI/bge-m3 모델 다운로드(~1.5GB)로 인해 FastAPI 서비스가 준비되기까지 수 분이 소요됩니다.

### 5. 접속

| 서비스 | 주소 |
|---|---|
| 프론트엔드 | http://localhost |
| Spring Boot API | http://localhost:8080 |
| FastAPI AI | http://localhost:8000 |
| Neo4j Browser | http://localhost:7474 |

### 6. 종료

```bash
docker compose down
```

---

## ⚙️ 환경변수 설명

| 변수 | 필수 | 설명 |
|---|---|---|
| `DB_PASSWORD` | ✅ | PostgreSQL 비밀번호 |
| `NEO4J_PASSWORD` | ✅ | Neo4j 비밀번호 |
| `JWT_SECRET` | ✅ | Spring Boot JWT 서명 키 |
| `JWT_SECRET_KEY` | ✅ | FastAPI JWT 서명 키 (Spring과 동일하게) |
| `GROQ_API_KEY` | ✅ | [Groq Console](https://console.groq.com/)에서 발급 |
| `CORS_ALLOWED_ORIGINS` | - | 허용할 프론트엔드 주소 (기본값: `http://localhost`) |

---

## 🧱 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | React 18, Vite, Nginx |
| Backend | Spring Boot 3, Java 21, Spring Security (JWT) |
| AI Core | FastAPI, Python 3.11, LangGraph, LangChain |
| LLM (외부) | Groq API — llama-3.1-8b-instant, llama-3.3-70b-versatile |
| LLM (로컬) | Ollama — qwen2.5:14b |
| 임베딩 | SentenceTransformer — BAAI/bge-m3 |
| 벡터 DB | ChromaDB |
| 그래프 DB | Neo4j |
| RDB | PostgreSQL 16 |

---

## 🎬 영상

| 구분 | 링크 |
|---|---|
| 시연 영상 | [▶ YouTube 링크](https://www.youtube.com/watch?v=Gxvgw_I2xRk) |
| 강동균 발표 영상 | [▶ YouTube 링크](https://www.youtube.com/watch?v=4pIQlegI13A) |
| 김성원 발표 영상 | [▶ YouTube 링크](https://youtube.com/링크를_여기에_입력) |
| 고결 발표 영상 | [▶ YouTube 링크](https://youtube.com/링크를_여기에_입력) |

---

## 👥 팀 멤버

| 역할 | 이름 | 담당 |
|---|---|---|
| Team Leader | 강동균 | AI 코어, 인프라, 3-Tier 라우팅, 메모리 시스템 |
| Backend | 김성원 | Spring Boot 인증, DB 스키마, 세션/워크스페이스 관리 |
| Frontend | 고결 | React UI/UX, 대시보드, 채팅 워크스페이스 |

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
                         Neo4j               ┌─ General Agent
                        ChromaDB             ├─ Expert Agent (RAG)
                                             └─ Coding/Math Agent
```

| 서비스 | 역할 | 기술 스택 |
|---|---|---|
| `dativus-frontend/` | UI/UX, 실시간 채팅 워크스페이스 | React, Vite, Nginx |
| `server/` | 인증(Zero-Trust), 세션/워크스페이스 관리 | Spring Boot 3, Java 21, PostgreSQL |
| `Dativus_Ai/` | LangGraph 라우팅, LLM 추론, RAG | FastAPI, Python 3.11, LangGraph, ChromaDB, Neo4j |

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

## 🚀 실행 방법

### 사전 준비

1. [Docker Desktop](https://www.docker.com/products/docker-desktop/) 설치
2. [Ollama](https://ollama.com/) 설치 후 로컬 모델 실행:
   ```bash
   ollama pull llama3
   ```
3. `.env` 파일 생성 (`.env.example` 참고):
   ```bash
   cp .env.example .env
   # .env 파일을 열어 각 값을 채워넣으세요
   ```

### 실행

```bash
docker compose up -d
```

| 서비스 | 주소 |
|---|---|
| 프론트엔드 | http://localhost |
| Spring Boot API | http://localhost:8080 |
| FastAPI AI | http://localhost:8000 |
| Neo4j Browser | http://localhost:7474 |

### 종료

```bash
docker compose down
```

---

## ⚙️ 환경 변수

`.env.example`을 복사해 `.env`로 만든 뒤 아래 값을 채워주세요.

| 변수 | 설명 |
|---|---|
| `DB_PASSWORD` | PostgreSQL 비밀번호 |
| `NEO4J_PASSWORD` | Neo4j 비밀번호 |
| `JWT_SECRET` | Spring Boot JWT 서명 키 |
| `JWT_SECRET_KEY` | FastAPI JWT 서명 키 (Spring과 동일하게) |
| `GROQ_API_KEY` | [Groq Console](https://console.groq.com/)에서 발급 |
| `CORS_ALLOWED_ORIGINS` | 허용할 프론트엔드 주소 (기본: `http://localhost`) |

---

## 👥 팀 멤버

| 역할 | 이름 | 담당 |
|---|---|---|
| Team Leader | 강동균 | AI 코어, 인프라, 3-Tier 라우팅 |
| Backend | 김성원 | Spring Boot 인증, DB 스키마, 세션 관리 |
| Frontend | 고결 | React UI/UX, 대시보드, 페르소나 화면 |

# Dativus — 설치 및 실행 가이드

> 캡스톤 디자인 프로젝트 제출용 실행 가이드입니다.  
> 교수님께서 로컬 환경에서 직접 테스트하실 수 있도록 모든 단계를 상세히 기술하였습니다.

---

## 목차

1. [전체 아키텍처 개요](#1-전체-아키텍처-개요)
2. [필수 프로그램 설치](#2-필수-프로그램-설치)
3. [Groq API 키 발급](#3-groq-api-키-발급)
4. [로컬 LLM 설치 (Ollama + llama3)](#4-로컬-llm-설치-ollama--llama3)
5. [PostgreSQL 데이터베이스 생성](#5-postgresql-데이터베이스-생성)
6. [소스코드 구조 및 환경변수 설정](#6-소스코드-구조-및-환경변수-설정)
7. [서비스별 실행 방법](#7-서비스별-실행-방법)
   - [① Spring Boot 서버 (IntelliJ IDEA)](#-spring-boot-서버--intellij-idea)
   - [② FastAPI AI 서버 (PyCharm)](#-fastapi-ai-서버--pycharm)
   - [③ React 프론트엔드 (VS Code)](#-react-프론트엔드--vs-code)
8. [실행 순서 및 접속 주소](#8-실행-순서-및-접속-주소)
9. [주요 기능 테스트 방법](#9-주요-기능-테스트-방법)
10. [자주 발생하는 오류 및 해결법](#10-자주-발생하는-오류-및-해결법)

---

## 1. 전체 아키텍처 개요

```
[브라우저]
    │
    ├─── REST API ────────────► [Spring Boot 서버 :8080]
    │                               │  인증 / 채팅 세션 / 에이전트 관리
    │                               │
    │                               └─ PostgreSQL :5432
    │
    └─── SSE 스트리밍 ────────► [FastAPI AI 서버 :8000]
                                    │  LangGraph 멀티 에이전트
                                    │
                                    ├─ Groq API (클라우드 LLM)
                                    │   ├─ llama-3.1-8b-instant  (속도 우선 · 라우팅/판단)
                                    │   └─ llama-3.3-70b-versatile (품질 우선 · 전문 분석)
                                    │
                                    ├─ Ollama llama3 (로컬 LLM · Groq 한도 초과 시 자동 폴백)
                                    │
                                    ├─ BAAI/bge-m3 (로컬 임베딩 모델 · 벡터 검색)
                                    └─ ChromaDB (벡터 저장소 · 지식망)
```

| 서비스 | 언어 / 프레임워크 | 포트 |
|--------|-----------------|------|
| Spring Boot | Java 21 + Spring Boot 3.4 | 8080 |
| FastAPI | Python 3.11 + FastAPI | 8000 |
| React 프론트엔드 | Node.js 22 + Vite + React 19 | 5173 (개발) |
| PostgreSQL | PostgreSQL 16 | 5432 |

---

## 2. 필수 프로그램 설치

아래 프로그램이 모두 설치되어 있어야 합니다.

### Java 21 (JDK)
- 다운로드: https://adoptium.net/temurin/releases/?version=21
- **Windows**: `.msi` 설치 파일 실행
- 설치 확인:
  ```
  java -version
  ```
  → `openjdk version "21.x.x"` 출력되면 정상

### Python 3.11
- 다운로드: https://www.python.org/downloads/release/python-3110/
- **Windows**: `Windows installer (64-bit)` 다운로드, 설치 시 **"Add Python to PATH"** 반드시 체크
- 설치 확인:
  ```
  python --version
  ```
  → `Python 3.11.x` 출력되면 정상

### Node.js 22
- 다운로드: https://nodejs.org/en (LTS 버전 선택)
- 설치 확인:
  ```
  node -v
  npm -v
  ```

### PostgreSQL 16
- 다운로드: https://www.postgresql.org/download/windows/
- 설치 시 설정:
  - 포트: `5432` (기본값 유지)
  - 관리자 계정: `postgres`
  - **비밀번호: `1234`** (프로젝트 기본 설정과 일치해야 합니다)
- pgAdmin 4 함께 설치 권장 (GUI로 DB 관리 가능)

### Git
- 다운로드: https://git-scm.com/download/win

---

## 3. Groq API 키 발급

Dativus의 메인 LLM은 Groq 클라우드 API를 사용합니다. **무료 플랜**으로도 충분히 테스트 가능합니다.

**① Groq 계정 생성**
1. https://console.groq.com 접속
2. `Sign Up` → Google 계정 또는 이메일로 가입

**② API 키 발급**
1. 로그인 후 왼쪽 메뉴에서 **API Keys** 클릭
2. `Create API Key` 버튼 클릭
3. 이름 입력 (예: `dativus-test`) → `Submit`
4. 생성된 키(`gsk_...` 형식)를 **반드시 복사해 보관** (이후 재확인 불가)

**③ 무료 플랜 한도**
- llama-3.1-8b-instant: 분당 30회 / 일 14,400회
- llama-3.3-70b-versatile: 분당 30회 / 일 1,000회
- 한도 초과 시 **로컬 Ollama(llama3)로 자동 전환**되므로 정상 동작합니다

---

## 4. 로컬 LLM 설치 (Ollama + llama3)

Ollama는 Groq API 한도 초과 시 자동 폴백 역할을 합니다. 설치하지 않아도 Groq API 한도 내에서는 정상 작동하지만, **안정적인 테스트를 위해 설치를 권장**합니다.

**① Ollama 설치**
1. https://ollama.com 접속 → `Download` 클릭 → Windows 설치 파일 실행
2. 설치 완료 후 터미널에서 확인:
   ```
   ollama --version
   ```

**② llama3 모델 다운로드** (약 4.7GB, 최초 1회)
```
ollama pull llama3
```
- 다운로드 완료 후 확인:
  ```
  ollama list
  ```
  → `llama3` 항목이 보이면 정상

**③ Ollama 서버 실행 확인**
- Windows에서 Ollama를 설치하면 백그라운드에서 자동 실행됩니다
- 트레이 아이콘에서 확인 가능
- 수동 실행이 필요한 경우: `ollama serve`

---

## 5. PostgreSQL 데이터베이스 생성

**pgAdmin 4 사용 시 (GUI)**
1. pgAdmin 4 실행 → 왼쪽 트리에서 `Servers` → `PostgreSQL 16` → 비밀번호(`1234`) 입력
2. `Databases` 우클릭 → `Create` → `Database...`
3. Database 이름에 `dativus_db` 입력 → `Save`

**psql 터미널 사용 시**
```sql
psql -U postgres -W
-- 비밀번호 입력: 1234

CREATE DATABASE dativus_db;
\q
```

> **참고**: 테이블은 Spring Boot 첫 실행 시 자동으로 생성됩니다 (JPA 자동 스키마 관리).

---

## 6. 소스코드 구조 및 환경변수 설정

### 폴더 구조
```
Dativus/
├── server/              ← Spring Boot (Java)
├── Dativus_Ai/          ← FastAPI (Python)
├── dativus-frontend/    ← React (Node.js)
└── docker-compose.yml
```

### ① Spring Boot 환경변수 — `server/.env`

`server/` 폴더 안에 `.env` 파일을 생성하고 아래 내용을 입력합니다:

```
DB_PASSWORD=1234
JWT_SECRET=DativusCapstoneProjectSuperSecretMasterKey2026ForJwtAuthentication
```

### ② FastAPI 환경변수 — `Dativus_Ai/.env`

`Dativus_Ai/` 폴더 안에 이미 `.env` 파일이 존재합니다. 아래 항목을 확인하고 `GROQ_API_KEY`를 **3번에서 발급받은 키**로 교체합니다:

```
JWT_SECRET_KEY=DativusCapstoneProjectSuperSecretMasterKey2026ForJwtAuthentication
JWT_ALGORITHM=HS512
GROQ_API_KEY=여기에_발급받은_Groq_API_키_입력
DB_PASSWORD=1234
HF_HUB_OFFLINE=1
TRANSFORMERS_OFFLINE=1
```

> **⚠️ 중요 — BAAI/bge-m3 임베딩 모델 최초 다운로드**  
> 처음 실행하는 경우 `HF_HUB_OFFLINE=1` 와 `TRANSFORMERS_OFFLINE=1` 두 줄을 **주석 처리**하거나 **삭제**한 뒤 FastAPI를 실행해야 합니다.  
> 모델(약 1.5GB)이 자동으로 다운로드됩니다. 완료 후 다시 두 줄을 복원하면 이후에는 오프라인에서도 빠르게 로드됩니다.
>
> ```
> # 최초 실행 시 아래 두 줄 임시 비활성화
> # HF_HUB_OFFLINE=1
> # TRANSFORMERS_OFFLINE=1
> ```

### ③ 프론트엔드 환경변수 — `dativus-frontend/.env.local` (선택사항)

기본값이 `localhost`로 설정되어 있으므로 별도 설정 없이도 로컬 실행 가능합니다.  
만약 포트가 다르다면 `dativus-frontend/` 안에 `.env.local` 파일을 생성하세요:

```
VITE_API_BASE_URL=http://127.0.0.1:8080
VITE_AI_BASE_URL=http://127.0.0.1:8000
```

---

## 7. 서비스별 실행 방법

> **실행 순서**: PostgreSQL → Spring Boot → FastAPI → React 프론트엔드

---

### ① Spring Boot 서버 — IntelliJ IDEA

**IntelliJ IDEA 설치 및 열기**
1. https://www.jetbrains.com/idea/download/ → Community Edition(무료) 다운로드
2. IntelliJ IDEA 실행 → `Open` → `Dativus/server` 폴더 선택

**JDK 설정**
1. 상단 메뉴 `File` → `Project Structure` (단축키: `Ctrl+Alt+Shift+S`)
2. `Project` 탭 → SDK 항목에서 `Java 21` 선택
3. 없으면 `Add SDK` → `Download JDK` → Version `21` 선택 → `Download`

**Gradle 동기화**
- 우측 `Gradle` 패널 클릭 → 새로고침(🔄) 아이콘 클릭
- 또는 `File` → `Sync Project with Gradle Files`
- 의존성 다운로드가 완료될 때까지 대기 (최초 3~5분 소요)

**실행**
1. `src/main/java/com/dativus/server/ServerApplication.java` 파일 열기
2. 파일 좌측의 초록색 ▶ 아이콘 클릭 → `Run 'ServerApplication'`
3. 콘솔에 `Started ServerApplication in X seconds` 메시지가 나오면 정상 실행

**터미널로 실행 시 (IntelliJ 불필요)**
```bash
cd Dativus/server
./gradlew bootRun
```
또는 Windows:
```cmd
cd Dativus\server
gradlew.bat bootRun
```

---

### ② FastAPI AI 서버 — PyCharm

**PyCharm 설치 및 열기**
1. https://www.jetbrains.com/pycharm/download/ → Community Edition(무료) 다운로드
2. PyCharm 실행 → `Open` → `Dativus/Dativus_Ai` 폴더 선택

**Python 인터프리터 및 가상환경 설정**
1. `File` → `Settings` (단축키: `Ctrl+Alt+S`)
2. `Project: Dativus_Ai` → `Python Interpreter` 클릭
3. 우측 상단 기어 아이콘(⚙) → `Add Interpreter` → `Add Local Interpreter`
4. `Virtualenv Environment` 선택 → `New environment` → 위치 기본값 유지 → `OK`

**의존성 설치**
1. PyCharm 하단 `Terminal` 탭 클릭
2. 가상환경이 활성화된 상태(`(venv)` 프롬프트)에서:
   ```
   pip install -r requirements.txt
   ```
   > ⚠️ 패키지 수가 많아 최초 설치에 **5~15분** 소요됩니다.

**터미널에서 직접 설치 시**
```bash
cd Dativus/Dativus_Ai
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

**실행 설정 (Run Configuration)**
1. 우측 상단 `Add Configuration` (또는 `Edit Configurations`) 클릭
2. `+` → `Python` 선택
3. 다음과 같이 입력:
   - **Name**: `FastAPI`
   - **Script path**: `uvicorn` 실행 대신 아래 Module 방식 사용
   - **Module**: `uvicorn`
   - **Parameters**: `main:app --host 0.0.0.0 --port 8000 --reload`
   - **Working directory**: `Dativus/Dativus_Ai` 경로로 설정
4. `OK` → ▶ 실행

**터미널로 실행 시 (PyCharm 불필요)**
```bash
cd Dativus/Dativus_Ai
# 가상환경 활성화 후
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

> **첫 실행 시 주의사항**: BAAI/bge-m3 모델 로딩 메시지가 출력되며 **30초~2분** 소요됩니다.  
> `모델 로딩 완료!` 메시지가 나온 뒤에야 API 요청을 처리할 수 있습니다.

---

### ③ React 프론트엔드 — VS Code

**VS Code 설치 및 열기**
1. https://code.visualstudio.com 다운로드 및 설치
2. VS Code 실행 → `File` → `Open Folder` → `Dativus/dativus-frontend` 폴더 선택

**권장 확장 프로그램 (선택사항)**
- `ES7+ React/Redux/React-Native snippets`
- `Prettier - Code formatter`
- `ESLint`

**의존성 설치 및 실행**

VS Code 상단 메뉴 `Terminal` → `New Terminal` (단축키: `` Ctrl+` ``):

```bash
npm install
npm run dev
```

실행 후 터미널에:
```
  VITE v8.x.x  ready in XXX ms
  ➜  Local:   http://localhost:5173/
```
메시지가 나오면 정상입니다.

**터미널로 실행 시 (VS Code 불필요)**
```bash
cd Dativus/dativus-frontend
npm install
npm run dev
```

---

## 8. 실행 순서 및 접속 주소

서비스는 반드시 아래 순서대로 실행해야 합니다.

```
1. PostgreSQL    ← 설치 시 자동 실행 (Windows 서비스로 등록됨)
2. Spring Boot   ← http://localhost:8080
3. FastAPI       ← http://localhost:8000
4. React         ← http://localhost:5173
```

| 서비스 | 주소 | 확인 방법 |
|--------|------|-----------|
| Spring Boot | http://localhost:8080 | 브라우저 접속 → Spring Whitelabel Error Page 나오면 정상 |
| FastAPI | http://localhost:8000 | 브라우저 접속 → `{"message":"Dativus AI Core (FastAPI)가 정상 작동 중입니다!"}` |
| FastAPI 문서 | http://localhost:8000/docs | Swagger UI 자동 생성 문서 |
| React | http://localhost:5173 | 브라우저 접속 → 로그인 화면 |

---

## 9. 주요 기능 테스트 방법

### 회원가입 및 로그인
1. http://localhost:5173 접속
2. `회원가입` 클릭 → 이름, 이메일, 비밀번호 입력
3. 로그인 → 메인 채팅 화면 진입

### AI 채팅 (Groq API 연동)
- 입력창에 질문 입력 → AI가 에이전트 파이프라인을 거쳐 스트리밍으로 응답
- 좌측 상단 에이전트 선택 드롭다운에서 `일반 대화`, `전문가 분석`, `코딩/수학` 선택 가능
- 에이전트 로그(🟢 표시)가 실시간으로 우측에 표시됨

### 팀 채팅방 생성
- 사이드바 `팀 채널` → `›` 버튼 클릭 → `+` 버튼 → 채널명 입력 → 생성
- 팀원과 같은 워크스페이스에 접속하면 채팅방 공유됨

### 개인 채팅방
- 사이드바 `개인 채널` → `›` → `+` → 개인용 채팅방 생성 (다른 팀원에게 비공개)

### 커스텀 AI 에이전트 생성
- 우측 상단 `에이전트 관리` → `새 에이전트 추가` → 이름 · 역할 설명 입력
- 이후 채팅 시 해당 에이전트 선택 가능

### 문서 업로드 (지식망)
- 채팅 입력창 좌측 📎 아이콘 → PDF 또는 TXT 업로드
- 업로드 완료 후 AI가 해당 문서 내용을 기반으로 답변

### 대시보드 시각화
- "우리 팀 기술 스택을 파이 차트로 보여줘" 등의 질문 입력
- 우측 캔버스 패널에 차트가 자동 생성됨

### 피드백 (👍/👎)
- AI 답변 아래 엄지 버튼 클릭 → 피드백 기록 저장

---

## 10. 자주 발생하는 오류 및 해결법

### Spring Boot가 실행되지 않는 경우

**오류**: `Failed to configure a DataSource`
- **원인**: PostgreSQL 미실행 또는 .env 파일 없음
- **해결**: PostgreSQL 서비스 실행 확인, `server/.env` 파일 생성 확인

**오류**: `SchemaManagementException: Schema-validation: missing table`
- **원인**: DB는 생성됐지만 테이블이 없음
- **해결**: `application.yml`의 `ddl-auto: validate`를 임시로 `update`로 변경 후 한 번 실행, 이후 다시 `validate`로 복원

### FastAPI가 실행되지 않는 경우

**오류**: `RuntimeError: JWT_SECRET_KEY, JWT_ALGORITHM 환경변수가 설정되지 않았습니다`
- **원인**: `Dativus_Ai/.env` 파일 없음 또는 키 누락
- **해결**: `.env` 파일의 `JWT_SECRET_KEY`, `JWT_ALGORITHM` 항목 확인

**오류**: `OSError: [BAAI/bge-m3] not found`
- **원인**: 임베딩 모델 미다운로드 상태에서 `HF_HUB_OFFLINE=1` 설정됨
- **해결**: `.env`에서 `HF_HUB_OFFLINE=1` 줄을 주석 처리(`#`)하고 재실행하면 자동 다운로드됨

**오류**: `pip install` 중 `Microsoft Visual C++ required`
- **원인**: Windows에서 일부 패키지 컴파일에 C++ 빌드 도구 필요
- **해결**: https://visualstudio.microsoft.com/visual-cpp-build-tools/ 에서 Build Tools 설치

### AI 응답이 느리거나 오류가 나는 경우

**오류**: `rate_limit_exceeded` 또는 응답이 없음
- **원인**: Groq 무료 플랜 분당 한도 초과
- **해결**: 자동으로 로컬 Ollama로 전환됩니다. Ollama와 llama3가 설치되어 있어야 합니다 (4번 항목 참조)

### 프론트엔드가 API에 연결되지 않는 경우

**오류**: 로그인 시 `네트워크 오류` 또는 응답 없음
- **원인**: Spring Boot 미실행 또는 포트 충돌
- **해결**: Spring Boot가 8080 포트에서 실행 중인지 확인. 다른 프로그램이 8080을 사용 중이라면 `application.yml`의 `server.port` 변경

---

## 환경변수 요약표

| 파일 위치 | 변수명 | 값 | 설명 |
|-----------|--------|----|------|
| `server/.env` | `DB_PASSWORD` | `1234` | PostgreSQL 비밀번호 |
| `server/.env` | `JWT_SECRET` | (기본값 사용) | JWT 서명 키 |
| `Dativus_Ai/.env` | `GROQ_API_KEY` | **직접 발급** | Groq 클라우드 API 키 |
| `Dativus_Ai/.env` | `JWT_SECRET_KEY` | (Spring과 동일) | JWT 검증 키 |
| `Dativus_Ai/.env` | `JWT_ALGORITHM` | `HS512` | JWT 알고리즘 |
| `Dativus_Ai/.env` | `DB_PASSWORD` | `1234` | PostgreSQL 비밀번호 |

---

*본 프로젝트는 Dativus 팀이 2026년 캡스톤 디자인 과목을 위해 개발하였습니다.*

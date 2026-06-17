# Dativus 팀원 환경 설정 가이드

> 이 프로젝트는 **3개의 서버**가 동시에 실행되어야 합니다.
> - `server/` — Spring Boot (포트 8080, 인증 & DB)
> - `Dativus_Ai/` — FastAPI AI Core (포트 8000, LLM 파이프라인)
> - `dativus-frontend/` — React/Vite (포트 5173, UI)

---

## 1. 사전 필수 설치 프로그램

아래 프로그램들을 **순서대로** 설치하세요.

| 프로그램 | 버전 | 다운로드 |
|---------|------|---------|
| Python | 3.11 이상 | https://www.python.org/downloads/ |
| Node.js | 18 이상 (LTS 권장) | https://nodejs.org/ |
| Java JDK | 21 | https://adoptium.net/ |
| PostgreSQL | 최신 | https://www.postgresql.org/download/ |
| Ollama | 최신 | https://ollama.com/download |
| Git | 최신 | https://git-scm.com/ |

> **설치 확인** (CMD 또는 PowerShell에서):
> ```
> python --version
> node --version
> java --version
> psql --version
> ollama --version
> ```

---

## 2. 프로젝트 파일 받기

```bash
git clone [레포지토리 주소]
cd Dativus
```

> **주의**: 아래 폴더들은 Git에 포함되지 않으며 각 단계에서 직접 생성합니다.
> `node_modules/`, `venv/`, `__pycache__/`, `chroma_storage/`, `build/`, `dist/`

---

## 3. HuggingFace 모델 파일 복사 (필수)

이 프로젝트는 임베딩 모델을 **로컬 오프라인**으로 사용합니다.  
인터넷 없이 동작하므로 모델 파일을 수동으로 복사해야 합니다.

### 원본 PC에서 복사할 경로:
```
C:\Users\[원본PC_사용자명]\.cache\huggingface\hub\
```

위 폴더 전체를 내 PC의 동일한 경로에 붙여넣기:
```
C:\Users\[내_사용자명]\.cache\huggingface\hub\
```

> 폴더가 없으면 직접 생성: `C:\Users\[내_사용자명]\.cache\huggingface\hub\`

---

## 4. LLM 모델 설치 (Ollama)

커스텀 에이전트 및 AI 응답에 사용하는 로컬 LLM 모델입니다.

```bash
# 전문 분석용 70B 모델 (약 40GB) — GPU 권장
ollama pull llama3.1:70b-instruct-q4_K_M

# 일반/fallback용 8B 모델 (약 5GB)
ollama pull llama3.1:8b-instruct-q4_K_M
```

> GPU 없이 CPU만 있는 환경이라면 8B 모델만 받고,  
> `Dativus_Ai/ai_core/llms.py` 에서 `expert_llm` 을 8B 모델로 임시 교체하세요.

---

## 5. PostgreSQL 데이터베이스 설정

```sql
-- pgAdmin 또는 psql에서 실행
CREATE DATABASE dativus_db;
```

> - 기본 접속 유저: `postgres`
> - 포트: `5432` (기본값)
> - 비밀번호: 설치 시 직접 설정한 값 (아래 `.env` 에 입력)

---

## 6. Spring Boot 서버 설정 (`server/`)

### 6-1. `.env` 파일 생성

`server/` 폴더 안에 `.env` 파일을 생성하고 아래 내용을 입력:

```env
DB_PASSWORD=여기에_PostgreSQL_비밀번호_입력
JWT_SECRET=DativusCapstoneProjectSuperSecretMasterKey2026ForJwtAuthentication
```

### 6-2. 빌드 & 실행

```powershell
cd server
.\gradlew.bat bootRun
```

> - 처음 실행 시 Gradle 의존성 자동 다운로드 (수 분 소요)
> - `Started DativusApplication` 메시지가 나오면 성공 ✅
> - 테이블은 `ddl-auto: update` 로 인해 **자동 생성**됩니다

---

## 7. AI Core (FastAPI) 설정 (`Dativus_Ai/`)

### 7-1. 가상환경 생성 & 활성화

```powershell
cd Dativus_Ai

# 가상환경 생성
python -m venv venv

# 가상환경 활성화 (Windows PowerShell)
.\venv\Scripts\Activate.ps1
```

> PowerShell 실행 정책 오류가 나면 아래 명령어 실행 후 재시도:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

### 7-2. 패키지 설치

```powershell
# 가상환경이 활성화된 상태에서
pip install -r requirements.txt
```

> `torch`, `sentence-transformers` 포함으로 설치에 **10~20분** 소요될 수 있습니다.  
> SSL 인증 오류 발생 시:
> ```powershell
> pip install -r requirements.txt --trusted-host pypi.org --trusted-host files.pythonhosted.org
> ```

### 7-3. `.env` 파일 생성

`Dativus_Ai/` 폴더 안에 `.env` 파일을 생성:

```env
JWT_SECRET_KEY=DativusCapstoneProjectSuperSecretMasterKey2026ForJwtAuthentication
JWT_ALGORITHM=HS512
GROQ_API_KEY=gsk_XXXXXXXXXXXXXXXXXXXXXXXX
HF_HUB_OFFLINE=1
TRANSFORMERS_OFFLINE=1
```

> - `GROQ_API_KEY` 는 팀장에게 문의하거나 https://console.groq.com 에서 무료 발급
> - `HF_HUB_OFFLINE=1` / `TRANSFORMERS_OFFLINE=1` 은 모델을 인터넷 없이 로컬에서만 사용하도록 강제하는 설정 (반드시 포함)

### 7-4. 서버 실행

```powershell
# Dativus_Ai/ 에서, 가상환경 활성화 상태로 실행
.\venv\Scripts\uvicorn.exe main:app --host 127.0.0.1 --port 8000 --reload
```

> `[ChromaDB] 초기화 완료` 메시지가 나오면 성공 ✅

---

## 8. 프론트엔드 설정 (`dativus-frontend/`)

### 8-1. 패키지 설치

```powershell
cd dativus-frontend
npm install
```

> SSL 인증 오류 발생 시:
> ```powershell
> npm install --strict-ssl=false
> ```

### 8-2. 개발 서버 실행

```powershell
npm run dev
```

> 브라우저에서 `http://localhost:5173` 접속 ✅

---

## 9. 전체 실행 순서 요약

PowerShell 창을 **3개** 열고 순서대로 실행하세요.

| 순서 | 폴더 | 명령어 |
|------|------|--------|
| ① | `server/` | `.\gradlew.bat bootRun` |
| ② | `Dativus_Ai/` | `.\venv\Scripts\Activate.ps1` → `.\venv\Scripts\uvicorn.exe main:app --host 127.0.0.1 --port 8000 --reload` |
| ③ | `dativus-frontend/` | `npm run dev` |

| 서비스 | 접속 주소 |
|--------|----------|
| 프론트엔드 | http://localhost:5173 |
| Spring API | http://localhost:8080 |
| FastAPI (AI) | http://localhost:8000 |
| FastAPI Swagger | http://localhost:8000/docs |

---

## 10. 자주 발생하는 문제

### `pip install` 중 SSL 오류
```powershell
pip install -r requirements.txt --trusted-host pypi.org --trusted-host files.pythonhosted.org
```

### `npm install` 중 `UNABLE_TO_VERIFY_LEAF_SIGNATURE` 오류
```powershell
npm install --strict-ssl=false
```

### Vite 캐시 오류 (흰 화면)
```powershell
# dativus-frontend/ 에서
Remove-Item -Recurse -Force node_modules\.vite
npm run dev
```

### `torch` 설치가 너무 오래 걸려요
정상입니다. PyTorch 패키지 크기가 2GB 이상이므로 네트워크 속도에 따라 시간이 걸립니다.

### `FATAL: password authentication failed for user "postgres"`
`server/.env` 의 `DB_PASSWORD` 가 PostgreSQL 설치 시 설정한 비밀번호와 다른 경우입니다.

### `CORS policy` 오류 (브라우저 콘솔)
Spring Boot(8080)와 AI Core(8000)가 **모두** 실행 중인지 확인하세요.

### `PowerShell: Activate.ps1 실행 안됨`
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### AI 서버 — 모델 로딩 실패
- Ollama 실행 중인지 확인: `ollama list`
- `ollama serve` 로 Ollama 백그라운드 실행 후 재시도

---

## 11. 폴더 구조 참고

```
Dativus/
├── SETUP.md             # 이 파일
│
├── server/              # Spring Boot (Java 21, Gradle)
│   ├── src/
│   ├── .env             # ⚠️ DB 비밀번호, JWT 시크릿 (직접 생성)
│   └── build.gradle
│
├── Dativus_Ai/          # FastAPI AI Core (Python)
│   ├── ai_core/
│   │   ├── nodes.py     # LangGraph 노드 (에이전트 로직)
│   │   ├── router.py    # 워크플로우 라우팅
│   │   ├── state.py     # 상태 정의
│   │   ├── llms.py      # LLM 인스턴스
│   │   └── prompts.py   # 프롬프트 템플릿
│   ├── database/        # ChromaDB, PostgreSQL 연결
│   ├── chroma_storage/  # 벡터 DB (자동 생성됨)
│   ├── venv/            # Python 가상환경 (직접 생성)
│   ├── main.py          # FastAPI 진입점
│   ├── .env             # ⚠️ Groq API 키, JWT 시크릿 (직접 생성)
│   └── requirements.txt
│
└── dativus-frontend/    # React + Vite (Node.js)
    ├── src/
    │   ├── components/  # ChatArea, Sidebar, AgentDashboard 등
    │   ├── hooks/       # useChatSession, useAgents 등
    │   └── api/
    ├── node_modules/    # npm install 로 자동 생성
    └── package.json
```

---

> `.env` 파일 2개 (server, Dativus_Ai)는 Git에 포함되지 않으므로 **반드시 직접 생성**해야 합니다.  
> 키 값은 팀장에게 문의하세요.

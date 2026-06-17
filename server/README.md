# 🥕 Dativus (다티부스) - Main Backend Server

> **LangGraph 기반 멀티 에이전트 라우팅 챗봇 시스템**
> 본 저장소는 다티부스 프로젝트의 `인증(Zero-Trust), 세션 관리 및 비즈니스 로직`을 담당하는 메인 백엔드 파트입니다.

## 📖 목차
1. [프로젝트 개요](#-프로젝트-개요)
2. [시스템 아키텍처](#-시스템-아키텍처)
3. [주요 기능](#-주요-기능)
4. [기술 스택](#-기술-스택)
5. [시작하기 (Getting Started)](#-시작하기-getting-started)
6. [팀 멤버 (Team)](#-팀-멤버-team)

---

## 💡 프로젝트 개요
다티부스(Dativus)는 사용자의 맥락을 이해하고 최적의 답변을 생성하는 개인화된 '제2의 뇌' AI 챗봇 시스템입니다. 
본 메인 백엔드 서버는 안전한 사용자 인증 및 데이터베이스 적재를 수행하며, 프론트엔드와 AI 코어 서버 사이의 안정적인 데이터 파이프라인 역할을 합니다.

## 🏗 시스템 아키텍처
*(추후 아키텍처 다이어그램 업데이트 예정)*
* **Frontend:** React 기반 UI/UX 및 실시간 채팅 워크스페이스
* **Main Backend (현재 저장소):** Spring Boot 기반 인증(Zero-Trust) 및 비즈니스 로직, PostgreSQL DB
* **AI Core:** FastAPI 기반 LangGraph 라우팅, 외부 도메인 데이터 연동 및 프롬프트 처리

## ✨ 주요 기능
* **Zero-Trust 기반 인증:** JWT(JSON Web Token) 및 시큐리티 설정을 통한 안전한 사용자 권한 검증 및 터널링.
* **워크스페이스 및 세션 관리:** 사용자별 독립적인 채팅 세션과 페르소나 설정 데이터를 관리 및 DB에 적재.
* **API 게이트웨이 역할:** 클라이언트의 요청을 받아 AI 코어 서버로 전달하고, 생성된 답변을 반환하는 3-Tier 로직 구현.

## 🛠 기술 스택
### Main Backend
* **Framework:** Spring Boot 3.x
* **Language:** Java 17
* **Database:** PostgreSQL
* **Security:** Spring Security, JWT

## 🚀 시작하기 (Getting Started)
본 프로젝트를 로컬 환경에서 실행하기 위한 가이드입니다.

### 1. 환경 설정 및 복제
```bash
$git clone [https://github.com/Team-Carrot/dativus-main-server.git$](https://github.com/Team-Carrot/dativus-main-server.git$) cd dativus-main-server
```

### 2. 프로젝트 빌드
```bash
# Windows
$ gradlew build

# Mac/Linux
$ ./gradlew build
```

### 3. 환경 변수 설정 (application.yml)
`src/main/resources/application.yml` 파일에 데이터베이스 접속 정보를 설정하세요.

### 4. 서버 실행
```bash
# Windows
$ gradlew bootRun

# Mac/Linux
$ ./gradlew bootRun
```

## 👥 팀 멤버 (Team)
| 역할 | 이름 | 담당 업무 | GitHub |
| --- | --- | --- | --- |
| **Team Leader** | 강동균 | AI 코어 개발, 인프라 구축, 3-Tier 라우팅 로직 | [@GitHub아이디](링크) |
| **Backend** | 김성원 | Spring Boot 인증 로직, DB 스키마 및 세션 관리 | [@GitHub아이디](링크) |
| **Frontend** | 고결 | React UI/UX, 대시보드 및 페르소나 설정 화면 구현 | [@GitHub아이디](링크) |

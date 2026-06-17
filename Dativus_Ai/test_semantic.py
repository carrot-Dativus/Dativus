import sys
sys.path.insert(0, '.')

ws = sys.argv[1] if len(sys.argv) > 1 else input("워크스페이스 ID 입력: ").strip()

from database.memory_store import save_episode, count_episodes, format_episodic_context
from database.graph_store import consolidate_to_semantic, load_semantic_facts, _last_consolidate
from langchain_ollama import ChatOllama

pairs = [
    ("React 컴포넌트 설계 어떻게 해?", "Atomic Design 패턴 추천. 재사용 가능한 단위로 분리하세요."),
    ("TypeScript interface랑 type 차이가 뭐야?", "interface는 선언 병합 가능, type은 유니온/교차 타입에 유리합니다."),
    ("React Query 캐싱 전략은?", "staleTime과 cacheTime을 상황에 맞게 조절하세요."),
    ("Zustand 쓸만해?", "Redux보다 가볍고 React와 잘 맞습니다. 소규모 상태에 추천."),
    ("Spring Boot CORS 설정 방법?", "WebMvcConfigurer에서 addCorsMappings로 허용 도메인 등록하세요."),
    ("useMemo 언제 써?", "무거운 계산 결과를 캐싱할 때 사용합니다."),
    ("TypeScript generic 예제 알려줘", "function identity<T>(arg: T): T { return arg; } 형태로 씁니다."),
    ("React 폴더 구조 어떻게 잡아?", "features 기반 구조 추천. 도메인별로 컴포넌트/훅/API 묶기."),
    ("커스텀 훅 만드는 기준이 뭐야?", "로직 재사용이 필요하거나 컴포넌트에서 상태 로직이 복잡해질 때."),
    ("백엔드 REST API TypeScript 타입 자동 생성?", "openapi-typescript 또는 swagger-typescript-api 사용하세요."),
    ("React 성능 최적화 체크리스트?", "memo, lazy, Suspense, 번들 스플리팅 순서로 점검하세요."),
    ("useCallback 언제 필요해?", "자식 컴포넌트에 함수를 props로 넘길 때 불필요한 재렌더 방지용."),
    ("React에서 전역 상태 어떻게 관리해?", "Zustand 또는 React Query로 서버/클라이언트 상태 분리 추천."),
    ("TypeScript strict 모드 켜도 돼?", "신규 프로젝트면 무조건 켜는 게 맞습니다."),
    ("Spring Boot JPA N+1 문제 해결?", "fetch join 또는 @EntityGraph로 해결합니다."),
    ("React Query mutation optimistic update?", "onMutate에서 캐시 먼저 업데이트, onError에서 롤백하면 됩니다."),
    ("PostgreSQL 인덱스 전략?", "조회 빈도 높은 컬럼 위주로, 복합 인덱스는 카디널리티 높은 순서로."),
    ("CI/CD 어떻게 구성해?", "GitHub Actions로 빌드/테스트/배포 파이프라인 구성 추천."),
    ("Docker 컨테이너 구성?", "docker-compose로 Spring Boot + PostgreSQL + React 묶어서 개발환경 구성."),
    ("팀 코드 리뷰 기준이 뭐야?", "가독성, 테스트 커버리지, 성능 영향도 순으로 체크합니다."),
]

for user, ai in pairs:
    save_episode(ws, user, ai)

print(f"에피소드 {count_episodes(ws)}개 저장 완료")

llm = ChatOllama(model="qwen2.5:14b", temperature=0, num_predict=500)
_last_consolidate.pop(ws, None)
ep_text = format_episodic_context(ws, limit=20)
count = consolidate_to_semantic(ws, ep_text, llm)
print(f"시맨틱 사실 {count}개 추출 완료")
print(load_semantic_facts(ws, limit=10))

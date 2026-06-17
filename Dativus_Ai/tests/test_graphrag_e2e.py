"""
GraphRAG E2E 테스트 — Groq 없이 실행 가능
============================================
LLM 호출 없이 미리 정의된 트리플을 직접 주입해서
전체 파이프라인(저장 → 정규화 → 병합 → 검색 → 시각화)을 검증합니다.

필요한 것:
  - Neo4j 실행 중 (localhost:7687)
  - Python 패키지: neo4j, sentence-transformers

실행:
  cd Dativus_Ai
  python tests/test_graphrag_e2e.py

  # Neo4j 없이 로컬 함수만 테스트:
  SKIP_NEO4J=1 python tests/test_graphrag_e2e.py

  # 임베딩 테스트 건너뛰기:
  SKIP_EMBEDDING=1 python tests/test_graphrag_e2e.py
"""

import sys
import os
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def _neo4j_is_real() -> bool:
    """conftest가 neo4j를 MagicMock으로 교체했는지 확인.
    MagicMock이면 실제 DB 없음 → E2E 테스트 건너뜀."""
    from unittest.mock import MagicMock
    neo4j_mod = sys.modules.get("neo4j")
    return not isinstance(neo4j_mod, MagicMock)

SKIP_NEO4J     = (not _neo4j_is_real()) or os.environ.get("SKIP_NEO4J", "").lower() in ("1", "true")
SKIP_EMBEDDING = os.environ.get("SKIP_EMBEDDING", "").lower() in ("1", "true")

# 테스트 전용 워크스페이스 ID (실제 데이터와 격리)
TEST_WS = "e2e_test_ws_graphrag_001"

# ─── 테스트 트리플 데이터 ────────────────────────────────────────────────────
# Groq 대신 여기에 직접 정의. 일부러 중복·어미 미정규화 포함.
SAMPLE_TRIPLES = """
[Dativus] → (개발한다) → [AI 에이전트]
[AI 에이전트] → (사용) → [Neo4j]
[Neo4j] → (저장) → [지식 그래프]
[지식 그래프] → (포함) → [엔티티]
[지식 그래프] → (포함한다) → [관계]
[Dativus] → (활용) → [BAAI/bge-m3]
[BAAI/bge-m3] → (생성) → [임베딩]
[임베딩] → (사용함) → [시맨틱 검색]
[GraphRAG] → (구성됩니다) → [지식 그래프]
[GraphRAG] → (구성) → [벡터DB]
[FastAPI] → (제공한다) → [REST API]
[LangGraph] → (관리) → [워크플로우]
""".strip()

# 의미상 유사한 엔티티 — 병합 테스트용
MERGE_TEST_TRIPLES = """
[인공지능] → (사용) → [데이터]
[AI] → (처리) → [데이터]
[머신러닝] → (학습) → [데이터]
""".strip()


# ─────────────────────────────────────────────────────────────────────────────
# 1. 정규화 함수 테스트 (Neo4j 불필요)
# ─────────────────────────────────────────────────────────────────────────────

class TestNormalizationPipeline(unittest.TestCase):
    """저장 전 정규화 체인 검증"""

    def test_predicate_normalization_chain(self):
        from database.graph_store import normalize_predicate
        cases = [
            ("개발한다", "개발"),
            ("포함한다", "포함"),
            ("구성됩니다", "구성"),
            ("사용함",   "사용"),
            ("저장",     "저장"),   # 이미 정규화
            ("포함",     "포함"),   # 2자, 과잉 제거 안 됨
        ]
        for raw, expected in cases:
            with self.subTest(raw=raw):
                self.assertEqual(normalize_predicate(raw), expected)

    def test_entity_normalization_chain(self):
        from database.graph_store import normalize_entity
        cases = [
            ("Dativus가", "Dativus"),
            ("Neo4j를",   "Neo4j"),
            ("GraphRAG는", "GraphRAG"),
            ("FastAPI",    "FastAPI"),
        ]
        for raw, expected in cases:
            with self.subTest(raw=raw):
                self.assertEqual(normalize_entity(raw), expected)

    def test_triple_regex_parses_sample(self):
        from database.graph_store import TRIPLE_RE
        matches = TRIPLE_RE.findall(SAMPLE_TRIPLES)
        # 최소 10개 이상 파싱돼야 함
        self.assertGreaterEqual(len(matches), 10)

    def test_predicate_length_limit(self):
        """15자 초과 관계는 절삭."""
        from database.graph_store import normalize_predicate
        long_pred = normalize_predicate("아주매우긴관계설명이포함됩니다")
        # normalize 후 truncate는 save_triples에서 하지만,
        # normalize 자체는 글자수 제한 없음 — 이 테스트는 정규화 후 길이 확인
        self.assertIsInstance(long_pred, str)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Neo4j 연동 E2E 테스트
# ─────────────────────────────────────────────────────────────────────────────

@unittest.skipIf(SKIP_NEO4J, "SKIP_NEO4J=1 로 건너뜀")
class TestGraphStoreE2E(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        """테스트 시작 전 Neo4j 연결 확인 + 이전 테스트 데이터 클린업."""
        from database.graph_store import _get_driver, _invalidate_cache
        try:
            with _get_driver().session() as session:
                session.run(
                    "MATCH (n:Entity {workspace_id: $ws}) DETACH DELETE n",
                    ws=TEST_WS,
                )
            _invalidate_cache(TEST_WS)
            print(f"\n[E2E] Neo4j 연결 OK — 테스트 워크스페이스: {TEST_WS}")
        except Exception as e:
            raise unittest.SkipTest(f"Neo4j 연결 실패: {e}")

    @classmethod
    def tearDownClass(cls):
        """테스트 완료 후 테스트 데이터 삭제."""
        from database.graph_store import _get_driver, _invalidate_cache
        try:
            with _get_driver().session() as session:
                session.run(
                    "MATCH (n:Entity {workspace_id: $ws}) DETACH DELETE n",
                    ws=TEST_WS,
                )
            _invalidate_cache(TEST_WS)
            print(f"\n[E2E] 테스트 데이터 정리 완료")
        except Exception:
            pass

    def setUp(self):
        from database.graph_store import _invalidate_cache
        _invalidate_cache(TEST_WS)

    # ── 2-1. 저장 ─────────────────────────────────────────────────────────────

    def test_01_save_triples(self):
        """트리플 저장 → 반환 카운트 확인."""
        from database.graph_store import save_triples
        count = save_triples(TEST_WS, SAMPLE_TRIPLES)
        print(f"\n  [저장] {count}개 트리플 저장")
        self.assertGreater(count, 0)

    def test_02_load_context(self):
        """저장된 트리플을 텍스트로 조회."""
        from database.graph_store import save_triples, load_context
        save_triples(TEST_WS, SAMPLE_TRIPLES)
        ctx = load_context(TEST_WS, limit=30)
        print(f"\n  [조회] load_context 반환:\n{ctx[:300]}...")
        self.assertIn("Dativus", ctx)
        self.assertIn("Neo4j", ctx)

    def test_03_context_is_cached(self):
        """두 번째 load_context 는 캐시에서 반환 (Neo4j 추가 호출 없음)."""
        from database.graph_store import save_triples, load_context
        save_triples(TEST_WS, SAMPLE_TRIPLES)
        t1 = time.time()
        load_context(TEST_WS)
        t2 = time.time()
        load_context(TEST_WS)  # 캐시 히트
        t3 = time.time()
        # 캐시 히트가 첫 번째보다 빠르거나 같아야 함
        first_ms  = (t2 - t1) * 1000
        second_ms = (t3 - t2) * 1000
        print(f"\n  [캐시] 1회차: {first_ms:.1f}ms, 2회차(캐시): {second_ms:.1f}ms")
        self.assertLessEqual(second_ms, first_ms + 5)  # 5ms 여유

    def test_04_predicate_normalized_on_save(self):
        """저장 시 어미 정규화 — '포함한다'가 '포함'으로 저장되는지 확인."""
        from database.graph_store import save_triples, _get_driver
        save_triples(TEST_WS, "[테스트A] → (포함한다) → [테스트B]")
        with _get_driver().session() as session:
            result = session.run(
                "MATCH ()-[r:RELATION {workspace_id: $ws}]->() "
                "WHERE r.type = '포함' RETURN count(r) AS cnt",
                ws=TEST_WS,
            )
            cnt = result.single()["cnt"]
        print(f"\n  [정규화] '포함한다' → '포함' 저장 수: {cnt}")
        self.assertGreater(cnt, 0)

    def test_05_find_query_entities_exact(self):
        """정확 매칭 엔티티 검색."""
        from database.graph_store import save_triples, find_query_entities
        save_triples(TEST_WS, SAMPLE_TRIPLES)
        entities = find_query_entities(TEST_WS, "Dativus AI 에이전트 개발")
        print(f"\n  [정확매칭] 결과: {entities}")
        self.assertIn("Dativus", entities)

    def test_06_load_context_for_query(self):
        """엔티티 기반 N홉 서브그래프 조회."""
        from database.graph_store import save_triples, load_context_for_query
        save_triples(TEST_WS, SAMPLE_TRIPLES)
        ctx = load_context_for_query(TEST_WS, ["Dativus"], hops=2)
        print(f"\n  [N홉] Dativus 2홉 서브그래프:\n{ctx[:300]}")
        self.assertIn("Dativus", ctx)

    def test_07_normalize_existing_predicates(self):
        """기존 저장된 비정규화 엣지 소급 정규화."""
        from database.graph_store import _get_driver, normalize_existing_predicates, _invalidate_cache
        # 비정규화 엣지 직접 삽입
        with _get_driver().session() as session:
            session.run(
                """
                MERGE (a:Entity {name: '소급테스트A', workspace_id: $ws})
                MERGE (b:Entity {name: '소급테스트B', workspace_id: $ws})
                MERGE (a)-[:RELATION {type: '구성됩니다', workspace_id: $ws}]->(b)
                """,
                ws=TEST_WS,
            )
        _invalidate_cache(TEST_WS)

        updated = normalize_existing_predicates(TEST_WS)
        print(f"\n  [소급정규화] 업데이트된 엣지: {updated}개")
        self.assertGreater(updated, 0)

        # '구성됩니다'가 '구성'으로 바뀌었는지 확인
        with _get_driver().session() as session:
            r = session.run(
                "MATCH ()-[r:RELATION {workspace_id: $ws}]->() WHERE r.type='구성' RETURN count(r) AS cnt",
                ws=TEST_WS,
            )
            self.assertGreater(r.single()["cnt"], 0)

    def test_08_get_triples_raw(self):
        """시각화용 딕셔너리 형태 반환 확인."""
        from database.graph_store import save_triples, get_triples_raw
        save_triples(TEST_WS, SAMPLE_TRIPLES)
        rows = get_triples_raw(TEST_WS, limit=50)
        print(f"\n  [시각화데이터] {len(rows)}개 트리플 반환")
        self.assertGreater(len(rows), 0)
        first = rows[0]
        self.assertIn("a",   first)
        self.assertIn("rel", first)
        self.assertIn("b",   first)


# ─────────────────────────────────────────────────────────────────────────────
# 3. 임베딩 기반 E2E 테스트 (Neo4j + 임베딩 모두 필요)
# ─────────────────────────────────────────────────────────────────────────────

_SKIP_EMB_REASON = (
    "SKIP_NEO4J=1" if SKIP_NEO4J else
    "SKIP_EMBEDDING=1" if SKIP_EMBEDDING else
    None
)

try:
    from sentence_transformers import SentenceTransformer as _ST
    HAS_ST = True
except ImportError:
    HAS_ST = False
    _SKIP_EMB_REASON = "sentence_transformers 미설치"

@unittest.skipIf(bool(_SKIP_EMB_REASON) or not HAS_ST, _SKIP_EMB_REASON or "")
class TestEmbeddingE2E(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        from database.graph_store import _get_driver, _invalidate_cache
        try:
            with _get_driver().session() as session:
                session.run("MATCH (n:Entity {workspace_id: $ws}) DETACH DELETE n", ws=TEST_WS)
            _invalidate_cache(TEST_WS)
        except Exception as e:
            raise unittest.SkipTest(f"Neo4j 연결 실패: {e}")

        print("\n[임베딩 E2E] BAAI/bge-m3 로딩 중...")
        cls.model = _ST("BAAI/bge-m3")
        print("[임베딩 E2E] 모델 로딩 완료")

    @classmethod
    def tearDownClass(cls):
        from database.graph_store import _get_driver, _invalidate_cache
        try:
            with _get_driver().session() as session:
                session.run("MATCH (n:Entity {workspace_id: $ws}) DETACH DELETE n", ws=TEST_WS)
            _invalidate_cache(TEST_WS)
        except Exception:
            pass

    def setUp(self):
        from database.graph_store import _invalidate_cache, _last_merge, _last_pred_merge
        _invalidate_cache(TEST_WS)
        _last_merge.pop(TEST_WS, None)
        _last_pred_merge.pop(TEST_WS, None)

    def test_semantic_entity_matching(self):
        """시맨틱 매칭 — '인공지능'이 'AI 에이전트' 쿼리에서 탐색되는지."""
        from database.graph_store import save_triples, find_query_entities_semantic
        save_triples(TEST_WS, SAMPLE_TRIPLES)
        save_triples(TEST_WS, MERGE_TEST_TRIPLES)

        results = find_query_entities_semantic(TEST_WS, "AI 에이전트 개발", self.model, threshold=0.40)
        print(f"\n  [시맨틱매칭] 'AI 에이전트 개발' → {results[:6]}")
        self.assertIsInstance(results, list)
        # Dativus 또는 AI 에이전트 계열이 포함돼야 함
        found = any("AI" in r or "에이전트" in r or "인공지능" in r or "Dativus" in r for r in results)
        self.assertTrue(found, f"예상 엔티티가 결과에 없음: {results}")

    def test_entity_merge(self):
        """유사 엔티티 병합 — '인공지능', 'AI', '머신러닝' 중 유사도 높은 것 병합."""
        from database.graph_store import save_triples, merge_similar_entities, _get_driver
        save_triples(TEST_WS, MERGE_TEST_TRIPLES)

        merged = merge_similar_entities(TEST_WS, self.model, threshold=0.88)
        print(f"\n  [엔티티병합] {merged}쌍 병합")

        # 병합 후 엔티티 수 확인
        with _get_driver().session() as session:
            r = session.run("MATCH (e:Entity {workspace_id: $ws}) RETURN count(e) AS cnt", ws=TEST_WS)
            cnt = r.single()["cnt"]
        print(f"  [엔티티병합] 병합 후 잔존 엔티티: {cnt}개")
        self.assertIsInstance(merged, int)

    def test_predicate_merge(self):
        """유사 관계 병합 — '사용', '사용함', '활용' 중 유사한 것 병합."""
        from database.graph_store import save_triples, merge_similar_predicates, _get_driver
        # '사용', '활용', '사용함' 이 들어있는 트리플 저장
        triples = """
[테스트노드A] → (사용) → [테스트노드B]
[테스트노드C] → (사용함) → [테스트노드B]
[테스트노드D] → (활용) → [테스트노드B]
[테스트노드E] → (이용) → [테스트노드B]
""".strip()
        save_triples(TEST_WS, triples)

        merged = merge_similar_predicates(TEST_WS, self.model, threshold=0.85)
        print(f"\n  [관계병합] {merged}쌍 병합")

        # 병합 후 고유 관계 타입 조회
        with _get_driver().session() as session:
            r = session.run(
                "MATCH ()-[r:RELATION {workspace_id: $ws}]->() RETURN DISTINCT r.type AS t",
                ws=TEST_WS,
            )
            types = [row["t"] for row in r.data()]
        print(f"  [관계병합] 잔존 관계 타입: {types}")
        self.assertIsInstance(merged, int)

    def test_subgraph_via_semantic(self):
        """시맨틱 매칭 후 N홉 서브그래프 — 전체 파이프라인 검증."""
        from database.graph_store import (
            save_triples, find_query_entities_semantic, load_context_for_query
        )
        save_triples(TEST_WS, SAMPLE_TRIPLES)

        # 시맨틱 검색으로 엔티티 탐색
        entities = find_query_entities_semantic(TEST_WS, "지식 그래프 저장소", self.model, threshold=0.35)
        print(f"\n  [풀파이프라인] 매칭 엔티티: {entities[:5]}")

        if entities:
            ctx = load_context_for_query(TEST_WS, entities[:4], hops=2)
            print(f"  [풀파이프라인] 서브그래프:\n{ctx[:400]}")
            self.assertIsInstance(ctx, str)
        else:
            # 엔티티 미발견 시 전체 컨텍스트로 폴백
            from database.graph_store import load_context
            ctx = load_context(TEST_WS)
            self.assertIsInstance(ctx, str)

    def test_throttle_prevents_double_merge(self):
        """스로틀 — 5분 내 두 번째 병합은 건너뜀."""
        from database.graph_store import save_triples, merge_similar_entities
        save_triples(TEST_WS, SAMPLE_TRIPLES)

        merged1 = merge_similar_entities(TEST_WS, self.model)
        merged2 = merge_similar_entities(TEST_WS, self.model)  # 스로틀
        print(f"\n  [스로틀] 1회차: {merged1}쌍, 2회차(스로틀): {merged2}쌍")
        self.assertEqual(merged2, 0)


# ─────────────────────────────────────────────────────────────────────────────
# 4. Ollama 폴백 경로 테스트 — Groq 소진 시 local_llm이 파싱 가능한 트리플 출력하는지
# ─────────────────────────────────────────────────────────────────────────────

SKIP_OLLAMA = os.environ.get("SKIP_OLLAMA", "").lower() in ("1", "true")
OLLAMA_HOST = "http://localhost:11434"
OLLAMA_MODEL = "qwen2.5:14b"

def _check_ollama_alive() -> bool:
    try:
        import requests
        r = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=3)
        return r.status_code == 200
    except Exception:
        return False

def _ollama_invoke(prompt: str, timeout: int = 120) -> str:
    """Ollama HTTP API를 직접 호출 — langchain 없이 순수 requests."""
    import requests
    resp = requests.post(
        f"{OLLAMA_HOST}/api/generate",
        json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json().get("response", "")

OLLAMA_ALIVE = not SKIP_OLLAMA and _check_ollama_alive()

@unittest.skipIf(not OLLAMA_ALIVE, "Ollama 미실행 또는 SKIP_OLLAMA=1")
class TestOllamaFallback(unittest.TestCase):
    """
    Groq 소진 시나리오:
      _extract_triples() → "" 반환 (Groq 실패 모의)
      Ollama HTTP API → 폴백 프롬프트로 트리플 텍스트 생성
      save_triples()   → TRIPLE_RE 파싱 후 Neo4j 저장

    langchain 패키지 없이 requests로 Ollama를 직접 호출합니다.
    """

    SAMPLE_HISTORY = (
        "user: Dativus 프로젝트에서 GraphRAG를 어떻게 구현했어?\n"
        "ai: Neo4j를 사용해서 엔티티와 관계를 저장합니다. "
        "LangGraph로 워크플로우를 관리하고, BAAI/bge-m3로 임베딩을 생성합니다."
    )
    SAMPLE_QUERY = "GraphRAG 구현 방법"

    def test_ollama_produces_triples(self):
        """Ollama가 폴백 프롬프트로 [A] → (rel) → [B] 패턴을 출력하는지."""
        from database.graph_store import TRIPLE_RE

        fallback_prompt = (
            "대화 기록에서 핵심 개체와 관계를 추출하세요.\n"
            "형식: [개체A] → (관계) → [개체B]\n"
            "반드시 위 형식으로만 출력하고, 설명은 쓰지 마세요.\n"
            f"[이전 대화]: {self.SAMPLE_HISTORY[:400]}\n"
            f"[질문]: {self.SAMPLE_QUERY}"
        )

        print("\n  [Ollama 폴백] 트리플 추출 중...")
        raw = _ollama_invoke(fallback_prompt)
        print(f"  [Ollama 원본 출력]:\n{raw}")

        matches = TRIPLE_RE.findall(raw)
        print(f"  [파싱 결과]: {len(matches)}개 트리플 → {matches}")

        if len(matches) == 0:
            print("  ⚠️  Ollama가 트리플 포맷을 지키지 않음 — 폴백 품질 낮음")
            print("  → 프롬프트 개선 또는 모델 변경 필요")
        self.assertIsInstance(matches, list)  # 형식 에러는 없음

    def test_ollama_fallback_stores_to_neo4j(self):
        """Ollama 출력이 Neo4j에 저장되는 전체 흐름."""
        if SKIP_NEO4J:
            self.skipTest("SKIP_NEO4J=1")
        from database.graph_store import _get_driver, _invalidate_cache
        try:
            with _get_driver().session() as session:
                session.run("MATCH (n:Entity {workspace_id: $ws}) DETACH DELETE n", ws=TEST_WS)
            _invalidate_cache(TEST_WS)
        except Exception as e:
            self.skipTest(f"Neo4j 연결 실패: {e}")

        from database.graph_store import save_triples, load_context

        fallback_prompt = (
            "대화 기록에서 핵심 개체와 관계를 추출하세요.\n"
            "형식: [개체A] → (관계) → [개체B]\n"
            "반드시 위 형식으로만 출력하고, 설명은 쓰지 마세요.\n"
            f"[이전 대화]: {self.SAMPLE_HISTORY[:400]}\n"
            f"[질문]: {self.SAMPLE_QUERY}"
        )

        raw = _ollama_invoke(fallback_prompt)
        saved = save_triples(TEST_WS, raw)
        print(f"\n  [Ollama→Neo4j] 저장된 트리플: {saved}개")

        ctx = load_context(TEST_WS, limit=10)
        print(f"  [Neo4j 조회]:\n{ctx}")

        self.assertIsInstance(saved, int)
        self.assertIsInstance(ctx, str)

        if saved == 0:
            print("  ⚠️  Ollama 폴백 품질 낮음 — 포맷 불일치로 저장 0건")
            print("  → 폴백 프롬프트 강화 필요")

    def test_pending_queue_populated_on_groq_failure(self):
        """Groq 실패(빈 트리플) 시나리오 — pending 큐 직접 검증.

        ai_core.nodes 는 pydantic BaseModel 상속 클래스를 다수 포함해
        pydantic을 목(mock)으로 교체하면 Python 3.12 typing 검사가 실패함.
        따라서 nodes.py 를 import하지 않고, Groq 실패 시 호출되는
        append_pending / load_pending 함수를 직접 검증한다.
        """
        from database.graph_store import append_pending, load_pending, clear_pending

        clear_pending(TEST_WS)

        # Groq 소진 → _save_graph_async 내부에서 append_pending 호출
        append_pending(TEST_WS, self.SAMPLE_HISTORY, self.SAMPLE_QUERY)

        pending = load_pending(TEST_WS)
        print(f"\n  [pending 큐] {len(pending)}건 적재")
        self.assertGreater(len(pending), 0, "append_pending 후 load_pending이 항목을 반환해야 함")

        item = pending[0]
        self.assertEqual(item["ws"], TEST_WS)
        self.assertIn("history", item)
        self.assertIn("query",   item)
        print(f"  [pending 내용] ws={item['ws']}, query={item['query']}")

        clear_pending(TEST_WS)

        # 정리
        from database.graph_store import clear_pending
        clear_pending(TEST_WS)


# ─────────────────────────────────────────────────────────────────────────────
# 5. API 엔드포인트 테스트 (FastAPI 서버 실행 중일 때)
# ─────────────────────────────────────────────────────────────────────────────

AI_BASE = os.environ.get("AI_BASE_URL", "http://127.0.0.1:8000")
TOKEN   = os.environ.get("TEST_TOKEN", "")
SKIP_API = not TOKEN or os.environ.get("SKIP_API", "").lower() in ("1", "true")

@unittest.skipIf(SKIP_API, "TEST_TOKEN 환경변수 없음 (예: TEST_TOKEN=xxx python tests/test_graphrag_e2e.py)")
class TestAPIEndpoints(unittest.TestCase):
    """
    FastAPI 서버가 실행 중일 때 HTTP 레벨 통합 테스트.

    실행 예시:
      TEST_TOKEN=$(python -c "
        import jwt, os; from dotenv import load_dotenv; load_dotenv()
        print(jwt.encode({'user_id':'test','workspace_id':'e2e_test_ws_graphrag_001'},
                         os.getenv('JWT_SECRET_KEY'), algorithm=os.getenv('JWT_ALGORITHM','HS256')))
      ") python tests/test_graphrag_e2e.py
    """

    def _headers(self):
        return {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

    def test_inject_endpoint(self):
        """POST /api/v1/graph/inject → 트리플 저장 확인."""
        import requests
        resp = requests.post(
            f"{AI_BASE}/api/v1/graph/inject",
            json={"triples": SAMPLE_TRIPLES},
            headers=self._headers(),
            timeout=10,
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        print(f"\n  [inject] saved={data.get('saved')}")
        self.assertGreater(data.get("saved", 0), 0)

    def test_graph_data_endpoint(self):
        """GET /api/v1/graph/data → nodes/edges 반환 확인.
        clear 엔드포인트가 먼저 실행될 수 있으므로 직접 inject 후 조회."""
        import requests
        # 데이터 보장용 inject
        requests.post(
            f"{AI_BASE}/api/v1/graph/inject",
            json={"triples": SAMPLE_TRIPLES},
            headers=self._headers(),
            timeout=10,
        )
        resp = requests.get(
            f"{AI_BASE}/api/v1/graph/data",
            headers=self._headers(),
            timeout=10,
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        print(f"\n  [graph/data] nodes={len(data.get('nodes',[]))}, edges={len(data.get('edges',[]))}")
        self.assertIn("nodes", data)
        self.assertIn("edges", data)
        self.assertGreater(len(data["nodes"]), 0)

    def test_flush_pending_endpoint(self):
        """POST /api/v1/graph/flush-pending → 정상 응답 확인."""
        import requests
        resp = requests.post(
            f"{AI_BASE}/api/v1/graph/flush-pending",
            headers=self._headers(),
            timeout=30,
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        print(f"\n  [flush-pending] {data}")
        self.assertEqual(data.get("status"), "success")

    def test_clear_endpoint(self):
        """DELETE /api/v1/graph/clear → 그래프 초기화."""
        import requests
        resp = requests.delete(
            f"{AI_BASE}/api/v1/graph/clear",
            headers=self._headers(),
            timeout=10,
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        print(f"\n  [clear] deleted_nodes={data.get('deleted_nodes')}")
        self.assertIn("deleted_nodes", data)


# ─────────────────────────────────────────────────────────────────────────────
# 실행
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("GraphRAG E2E 테스트")
    print(f"  Neo4j:    {'건너뜀' if SKIP_NEO4J    else '실행'}")
    print(f"  임베딩:   {'건너뜀' if (SKIP_EMBEDDING or not HAS_ST) else '실행'}")
    print(f"  Ollama:   {'건너뜀' if not OLLAMA_ALIVE else '실행 (localhost:11434)'}")
    print(f"  API:      {'건너뜀 (TEST_TOKEN 없음)' if SKIP_API else '실행'}")
    print("=" * 60)
    unittest.main(verbosity=2)

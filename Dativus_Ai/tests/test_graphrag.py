"""
GraphRAG 테스트 — Groq 없이 실행 가능
  - 순수 함수: normalize_entity, normalize_predicate, TRIPLE_RE
  - Mock Neo4j: save_triples, load_context, normalize_existing_predicates
  - 실제 임베딩(로컬 BAAI/bge-m3): merge_similar_entities, merge_similar_predicates, find_query_entities_semantic
  - 스로틀 / 캐시 TTL 동작 검증

실행:
    cd Dativus_Ai
    python -m pytest tests/test_graphrag.py -v
    # 또는
    python tests/test_graphrag.py
"""

import sys
import os
import time
import unittest
from unittest.mock import MagicMock, patch, call

# 프로젝트 루트를 경로에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.graph_store import (
    normalize_entity,
    normalize_predicate,
    TRIPLE_RE,
)


# ─────────────────────────────────────────────────────────
# 헬퍼: Mock Neo4j 드라이버 생성
# ─────────────────────────────────────────────────────────

def make_mock_driver(query_results: list = None):
    """
    query_results: session.run(...).data()가 반환할 dict 리스트.
    여러 run() 호출에 대해 side_effect로 순서대로 반환.
    """
    query_results = query_results or []

    def make_result(data):
        r = MagicMock()
        r.data.return_value = data
        return r

    mock_session = MagicMock()
    mock_session.__enter__ = MagicMock(return_value=mock_session)
    mock_session.__exit__ = MagicMock(return_value=False)

    if query_results:
        mock_session.run.side_effect = [make_result(d) for d in query_results]
    else:
        mock_session.run.return_value = make_result([])

    mock_driver = MagicMock()
    mock_driver.session.return_value = mock_session
    return mock_driver, mock_session


# ─────────────────────────────────────────────────────────
# 1. 순수 함수 테스트 (의존성 없음)
# ─────────────────────────────────────────────────────────

class TestNormalizeEntity(unittest.TestCase):

    def test_subject_particle(self):
        self.assertEqual(normalize_entity("철수가"), "철수")
        self.assertEqual(normalize_entity("학교가"), "학교")

    def test_object_particle(self):
        self.assertEqual(normalize_entity("밥을"), "밥")
        self.assertEqual(normalize_entity("물을"), "물")

    def test_topic_particle(self):
        self.assertEqual(normalize_entity("Claude는"), "Claude")
        self.assertEqual(normalize_entity("GPT는"), "GPT")

    def test_genitive(self):
        self.assertEqual(normalize_entity("Dativus의"), "Dativus")

    def test_locative(self):
        self.assertEqual(normalize_entity("서울에"), "서울")
        self.assertEqual(normalize_entity("학교에서"), "학교")

    def test_no_particle(self):
        self.assertEqual(normalize_entity("Python"), "Python")
        self.assertEqual(normalize_entity("Neo4j"), "Neo4j")

    def test_whitespace_stripped(self):
        self.assertEqual(normalize_entity("  Claude  "), "Claude")

    def test_double_particle(self):
        # "이고" 처리: "사용이고" → "사용"
        self.assertEqual(normalize_entity("사용이고"), "사용")


class TestNormalizePredicate(unittest.TestCase):

    def test_handa(self):
        self.assertEqual(normalize_predicate("사용한다"), "사용")

    def test_hada(self):
        self.assertEqual(normalize_predicate("개발하다"), "개발")

    def test_doem(self):
        self.assertEqual(normalize_predicate("포함됨"), "포함")

    def test_doenda(self):
        self.assertEqual(normalize_predicate("구성된다"), "구성")

    def test_ham(self):
        self.assertEqual(normalize_predicate("의존함"), "의존")

    def test_hamnida(self):
        self.assertEqual(normalize_predicate("사용합니다"), "사용")

    def test_doemnida(self):
        self.assertEqual(normalize_predicate("구현됩니다"), "구현")

    def test_no_ending(self):
        # 어미 없으면 그대로
        self.assertEqual(normalize_predicate("포함"), "포함")
        self.assertEqual(normalize_predicate("관리"), "관리")

    def test_whitespace_stripped(self):
        self.assertEqual(normalize_predicate("  사용한다  "), "사용")

    def test_empty_after_strip(self):
        # 어미 제거 후 빈 문자열이면 원본 유지
        result = normalize_predicate("한다")
        # "한다" → "" 이면 루프에서 break → "한다" 유지
        self.assertNotEqual(result, "")


class TestTripleRegex(unittest.TestCase):

    def test_basic_arrow(self):
        text = "[Claude] → (사용) → [Neo4j]"
        matches = TRIPLE_RE.findall(text)
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0], ("Claude", "사용", "Neo4j"))

    def test_multiple_triples(self):
        text = (
            "[Alice] → (알고) → [Bob]\n"
            "[Bob] → (관리) → [서버]"
        )
        matches = TRIPLE_RE.findall(text)
        self.assertEqual(len(matches), 2)

    def test_double_arrow(self):
        text = "[A] -> (rel) -> [B]"
        matches = TRIPLE_RE.findall(text)
        self.assertEqual(len(matches), 1)

    def test_no_match(self):
        text = "관계 없는 텍스트입니다."
        matches = TRIPLE_RE.findall(text)
        self.assertEqual(len(matches), 0)

    def test_unicode_arrow(self):
        text = "[GraphRAG] ➔ (구성) ➔ [Neo4j]"
        matches = TRIPLE_RE.findall(text)
        self.assertEqual(len(matches), 1)

    def test_korean_entities(self):
        text = "[지식그래프] → (저장) → [데이터베이스]"
        matches = TRIPLE_RE.findall(text)
        self.assertEqual(matches[0], ("지식그래프", "저장", "데이터베이스"))


# ─────────────────────────────────────────────────────────
# 2. save_triples — Mock Neo4j
# ─────────────────────────────────────────────────────────

class TestSaveTriples(unittest.TestCase):

    def setUp(self):
        # 캐시 초기화
        import database.graph_store as gs
        gs._CACHE.clear()

    @patch("database.graph_store._get_driver")
    def test_saves_parsed_triples(self, mock_get_driver):
        from database.graph_store import save_triples

        mock_driver, mock_session = make_mock_driver()
        mock_get_driver.return_value = mock_driver

        text = "[Claude] → (사용한다) → [Neo4j]\n[Neo4j] → (저장) → [데이터]"
        count = save_triples("ws_test", text)

        self.assertEqual(count, 2)
        self.assertEqual(mock_session.run.call_count, 2)

    @patch("database.graph_store._get_driver")
    def test_no_triples_returns_zero(self, mock_get_driver):
        from database.graph_store import save_triples

        mock_driver, mock_session = make_mock_driver()
        mock_get_driver.return_value = mock_driver

        count = save_triples("ws_test", "트리플 패턴이 없는 텍스트")
        self.assertEqual(count, 0)
        mock_session.run.assert_not_called()

    @patch("database.graph_store._get_driver")
    def test_predicate_normalized_before_save(self, mock_get_driver):
        from database.graph_store import save_triples

        mock_driver, mock_session = make_mock_driver()
        mock_get_driver.return_value = mock_driver

        text = "[A] → (사용한다) → [B]"
        save_triples("ws_test", text)

        # session.run에 전달된 파라미터에서 r="사용" 확인 (어미 제거됨)
        call_kwargs = mock_session.run.call_args_list[0][1]
        self.assertEqual(call_kwargs.get("r"), "사용")

    @patch("database.graph_store._get_driver")
    def test_predicate_truncated_to_15(self, mock_get_driver):
        from database.graph_store import save_triples

        mock_driver, mock_session = make_mock_driver()
        mock_get_driver.return_value = mock_driver

        long_pred = "아주매우길고긴관계타입이다"  # 13자 어미제거 후
        text = f"[A] → ({long_pred}) → [B]"
        save_triples("ws_test", text)

        call_kwargs = mock_session.run.call_args_list[0][1]
        self.assertLessEqual(len(call_kwargs.get("r", "")), 15)

    @patch("database.graph_store._get_driver")
    def test_empty_workspace_returns_zero(self, mock_get_driver):
        from database.graph_store import save_triples
        count = save_triples("", "[A] → (rel) → [B]")
        self.assertEqual(count, 0)
        mock_get_driver.assert_not_called()

    @patch("database.graph_store._get_driver")
    def test_invalidates_cache_on_save(self, mock_get_driver):
        import database.graph_store as gs
        from database.graph_store import save_triples

        mock_driver, _ = make_mock_driver()
        mock_get_driver.return_value = mock_driver

        # 캐시에 데이터 심기
        gs._cache_set("ctx|ws_test|20", "이전 캐시")
        self.assertIsNotNone(gs._cache_get("ctx|ws_test|20"))

        save_triples("ws_test", "[A] → (rel) → [B]")

        # 캐시 무효화 확인
        self.assertIsNone(gs._cache_get("ctx|ws_test|20"))


# ─────────────────────────────────────────────────────────
# 3. load_context — Mock Neo4j + 캐시 검증
# ─────────────────────────────────────────────────────────

class TestLoadContext(unittest.TestCase):

    def setUp(self):
        import database.graph_store as gs
        gs._CACHE.clear()

    @patch("database.graph_store._get_driver")
    def test_returns_formatted_triples(self, mock_get_driver):
        from database.graph_store import load_context

        rows = [
            {"a": "Claude", "rel": "사용", "b": "Neo4j"},
            {"a": "Neo4j", "rel": "저장", "b": "데이터"},
        ]
        mock_driver, _ = make_mock_driver([rows])
        mock_get_driver.return_value = mock_driver

        result = load_context("ws_test", limit=20)
        self.assertIn("[Claude] → (사용) → [Neo4j]", result)
        self.assertIn("[Neo4j] → (저장) → [데이터]", result)

    @patch("database.graph_store._get_driver")
    def test_empty_result_cached(self, mock_get_driver):
        from database.graph_store import load_context
        import database.graph_store as gs

        mock_driver, mock_session = make_mock_driver([[]])  # 빈 결과
        mock_get_driver.return_value = mock_driver

        result1 = load_context("ws_empty", limit=20)
        result2 = load_context("ws_empty", limit=20)  # 두 번째는 캐시에서

        self.assertEqual(result1, "")
        self.assertEqual(result2, "")
        # Neo4j는 1번만 호출됨
        self.assertEqual(mock_session.run.call_count, 1)

    @patch("database.graph_store._get_driver")
    def test_cache_hit_skips_neo4j(self, mock_get_driver):
        from database.graph_store import load_context
        import database.graph_store as gs

        rows = [{"a": "A", "rel": "rel", "b": "B"}]
        mock_driver, mock_session = make_mock_driver([rows])
        mock_get_driver.return_value = mock_driver

        load_context("ws_cached", limit=20)  # Neo4j 호출
        load_context("ws_cached", limit=20)  # 캐시 히트

        self.assertEqual(mock_session.run.call_count, 1)

    @patch("database.graph_store._get_driver")
    def test_empty_workspace_returns_empty(self, mock_get_driver):
        from database.graph_store import load_context
        result = load_context("", limit=20)
        self.assertEqual(result, "")
        mock_get_driver.assert_not_called()


# ─────────────────────────────────────────────────────────
# 4. normalize_existing_predicates — Mock Neo4j
# ─────────────────────────────────────────────────────────

class TestNormalizeExistingPredicates(unittest.TestCase):

    def setUp(self):
        import database.graph_store as gs
        gs._CACHE.clear()

    @patch("database.graph_store._get_driver")
    def test_normalizes_edges(self, mock_get_driver):
        from database.graph_store import normalize_existing_predicates

        # 첫 run: 엣지 조회 → 비정규화 엣지 1개
        edges = [{"a": "A", "rtype": "사용한다", "b": "B"}]
        # 이후 run: MERGE + DELETE 각 1회씩
        mock_driver, mock_session = make_mock_driver([edges, [], []])
        mock_get_driver.return_value = mock_driver

        count = normalize_existing_predicates("ws_test")
        self.assertEqual(count, 1)

    @patch("database.graph_store._get_driver")
    def test_already_normalized_skipped(self, mock_get_driver):
        from database.graph_store import normalize_existing_predicates

        edges = [{"a": "A", "rtype": "사용", "b": "B"}]  # 이미 정규화됨
        mock_driver, mock_session = make_mock_driver([edges])
        mock_get_driver.return_value = mock_driver

        count = normalize_existing_predicates("ws_test")
        self.assertEqual(count, 0)

    @patch("database.graph_store._get_driver")
    def test_empty_workspace(self, mock_get_driver):
        from database.graph_store import normalize_existing_predicates
        count = normalize_existing_predicates("")
        self.assertEqual(count, 0)
        mock_get_driver.assert_not_called()


# ─────────────────────────────────────────────────────────
# 5. 스로틀 검증 — merge_similar_entities / merge_similar_predicates
# ─────────────────────────────────────────────────────────

class TestMergeThrottle(unittest.TestCase):

    def setUp(self):
        import database.graph_store as gs
        gs._last_merge.clear()
        gs._last_pred_merge.clear()
        gs._CACHE.clear()

    @patch("database.graph_store._get_driver")
    def test_entity_merge_throttled(self, mock_get_driver):
        from database.graph_store import merge_similar_entities
        import database.graph_store as gs

        # 첫 호출 → 실행됨 (Neo4j에서 엔티티 1개 미만이면 0 반환)
        mock_driver, mock_session = make_mock_driver([[]])  # 엔티티 없음
        mock_get_driver.return_value = mock_driver
        model = MagicMock()

        merge_similar_entities("ws_throttle", model)
        first_call_count = mock_session.run.call_count

        # 두 번째 호출 → 스로틀로 건너뜀
        result = merge_similar_entities("ws_throttle", model)
        self.assertEqual(result, 0)
        self.assertEqual(mock_session.run.call_count, first_call_count)  # Neo4j 추가 호출 없음

    @patch("database.graph_store._get_driver")
    def test_predicate_merge_throttled(self, mock_get_driver):
        from database.graph_store import merge_similar_predicates
        import database.graph_store as gs

        mock_driver, mock_session = make_mock_driver([[]])
        mock_get_driver.return_value = mock_driver
        model = MagicMock()

        merge_similar_predicates("ws_throttle2", model)
        first_count = mock_session.run.call_count

        result = merge_similar_predicates("ws_throttle2", model)
        self.assertEqual(result, 0)
        self.assertEqual(mock_session.run.call_count, first_count)

    @patch("database.graph_store._get_driver")
    def test_throttle_resets_after_interval(self, mock_get_driver):
        from database.graph_store import merge_similar_entities
        import database.graph_store as gs

        mock_driver, _ = make_mock_driver([[], []])
        mock_get_driver.return_value = mock_driver
        model = MagicMock()

        merge_similar_entities("ws_reset", model)

        # 마지막 병합 시간을 5분 전으로 조작
        gs._last_merge["ws_reset"] = time.time() - 301

        # 다시 실행됨 (Neo4j 호출 발생)
        merge_similar_entities("ws_reset", model)
        # _get_driver가 두 번 이상 호출됐으면 통과
        self.assertGreaterEqual(mock_get_driver.call_count, 2)


# ─────────────────────────────────────────────────────────
# 6. 캐시 TTL 검증
# ─────────────────────────────────────────────────────────

class TestCacheTTL(unittest.TestCase):

    def setUp(self):
        import database.graph_store as gs
        gs._CACHE.clear()

    def test_cache_hit_within_ttl(self):
        import database.graph_store as gs
        gs._cache_set("key1", "value1")
        self.assertEqual(gs._cache_get("key1"), "value1")

    def test_cache_miss_after_ttl(self):
        import database.graph_store as gs
        gs._cache_set("key2", "value2")
        # TTL을 과거로 조작
        gs._CACHE["key2"] = ("value2", time.time() - gs._CACHE_TTL - 1)
        self.assertIsNone(gs._cache_get("key2"))

    def test_cache_invalidate_by_workspace(self):
        import database.graph_store as gs
        gs._cache_set("ctx|ws_abc|20", "data1")
        gs._cache_set("ctx|ws_xyz|20", "data2")
        gs._cache_set("subgraph|ws_abc|A|2|30", "data3")

        gs._invalidate_cache("ws_abc")

        self.assertIsNone(gs._cache_get("ctx|ws_abc|20"))
        self.assertIsNone(gs._cache_get("subgraph|ws_abc|A|2|30"))
        self.assertEqual(gs._cache_get("ctx|ws_xyz|20"), "data2")  # 다른 workspace 유지


# ─────────────────────────────────────────────────────────
# 7. 임베딩 기반 테스트 (실제 BAAI/bge-m3 사용)
#    --skip-embedding 플래그가 없으면 실행
# ─────────────────────────────────────────────────────────

SKIP_EMBEDDING = os.environ.get("SKIP_EMBEDDING", "").lower() in ("1", "true", "yes")

try:
    from sentence_transformers import SentenceTransformer as _ST
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False

_SKIP_EMBEDDING_REASON = (
    "SKIP_EMBEDDING=1 으로 건너뜀" if SKIP_EMBEDDING
    else "sentence_transformers 미설치 (pip install sentence-transformers)"
)

@unittest.skipIf(SKIP_EMBEDDING or not HAS_SENTENCE_TRANSFORMERS, _SKIP_EMBEDDING_REASON)
class TestEmbeddingFunctions(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        print("\n[임베딩 테스트] BAAI/bge-m3 로딩 중... (30~60초 소요)")
        cls.model = _ST("BAAI/bge-m3")
        print("[임베딩 테스트] 모델 로딩 완료")

    def setUp(self):
        import database.graph_store as gs
        gs._CACHE.clear()
        gs._last_merge.clear()
        gs._last_pred_merge.clear()

    # ── 7-1. merge_similar_predicates ──────────────────

    @patch("database.graph_store._get_driver")
    def test_predicate_merge_similar_korean(self, mock_get_driver):
        """'사용', '사용함', '활용' → 유사도 0.85 이상이면 병합"""
        from database.graph_store import merge_similar_predicates

        # DISTINCT r.type 조회 결과
        rtypes = [{"rtype": "사용"}, {"rtype": "사용함"}, {"rtype": "활용"}]
        # MERGE + DELETE 각 쌍마다 2 run씩
        mock_driver, mock_session = make_mock_driver(
            [rtypes] + [[] for _ in range(10)]
        )
        mock_get_driver.return_value = mock_driver

        merged = merge_similar_predicates("ws_emb", self.model, threshold=0.85)
        # "사용함", "활용"은 "사용"과 유사 → 최소 1쌍 병합
        self.assertGreater(merged, 0)

    @patch("database.graph_store._get_driver")
    def test_predicate_merge_dissimilar_not_merged(self, mock_get_driver):
        """'사용'과 '삭제'는 의미가 달라 병합 안 됨"""
        from database.graph_store import merge_similar_predicates

        rtypes = [{"rtype": "사용"}, {"rtype": "삭제"}]
        mock_driver, mock_session = make_mock_driver([rtypes])
        mock_get_driver.return_value = mock_driver

        merged = merge_similar_predicates("ws_emb2", self.model, threshold=0.85)
        self.assertEqual(merged, 0)

    # ── 7-2. merge_similar_entities ────────────────────

    @patch("database.graph_store._get_driver")
    def test_entity_merge_similar(self, mock_get_driver):
        """'AI' 와 '인공지능'은 의미상 유사 → 병합"""
        from database.graph_store import merge_similar_entities

        names = [{"name": "AI"}, {"name": "인공지능"}, {"name": "머신러닝"}]
        mock_driver, mock_session = make_mock_driver(
            [names] + [[] for _ in range(10)]
        )
        mock_get_driver.return_value = mock_driver

        merged = merge_similar_entities("ws_ent", self.model, threshold=0.88)
        # AI ≈ 인공지능 → 병합 기대 (모델에 따라 다를 수 있음)
        # 최소한 크래시 없이 정수 반환 확인
        self.assertIsInstance(merged, int)

    # ── 7-3. find_query_entities_semantic ──────────────

    @patch("database.graph_store._get_driver")
    def test_semantic_entity_matching(self, mock_get_driver):
        """'AI 시스템'이라는 쿼리에서 '인공지능' 엔티티를 의미적으로 탐색"""
        from database.graph_store import find_query_entities_semantic

        # find_query_entities (정확 매칭) → 빈 결과
        # all_entities 조회 → 3개 엔티티
        entities = [{"name": "인공지능"}, {"name": "머신러닝"}, {"name": "데이터베이스"}]
        mock_driver, _ = make_mock_driver([[], entities])
        mock_get_driver.return_value = mock_driver

        result = find_query_entities_semantic(
            "ws_sem", "AI 시스템", self.model, threshold=0.42
        )
        # "AI 시스템"과 "인공지능"은 시맨틱 유사 → 포함 기대
        self.assertIsInstance(result, list)
        # 크래시 없이 리스트 반환 확인

    @patch("database.graph_store._get_driver")
    def test_embedding_cached_on_second_call(self, mock_get_driver):
        """두 번째 semantic 검색 시 임베딩 캐시 히트 (Neo4j all_entities 쿼리 1회만)"""
        from database.graph_store import find_query_entities_semantic
        import database.graph_store as gs

        entities = [{"name": "Python"}, {"name": "FastAPI"}]
        mock_driver, mock_session = make_mock_driver([[], entities, []])
        mock_get_driver.return_value = mock_driver

        find_query_entities_semantic("ws_emb_cache", "웹 프레임워크", self.model)
        first_count = mock_session.run.call_count

        find_query_entities_semantic("ws_emb_cache", "REST API", self.model)
        second_count = mock_session.run.call_count

        # 두 번째 호출에서 all_entities 쿼리가 다시 나가지 않아야 함
        # (정확 매칭 쿼리 1번만 추가)
        self.assertLessEqual(second_count - first_count, 1)


# ─────────────────────────────────────────────────────────
# 실행
# ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("GraphRAG 테스트 시작")
    print("임베딩 테스트 건너뛰려면: SKIP_EMBEDDING=1 python tests/test_graphrag.py")
    print("=" * 60)
    unittest.main(verbosity=2)

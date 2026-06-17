"""
Phase 2 Item 8 — 단/장기 메모리 분리 테스트

Episodic Store (단기):
  - save/load/count/prune
  - format_episodic_context

Semantic Store (장기):
  - Neo4j SemanticFact 저장/조회/통합 (Neo4j 없으면 SKIP)

Integration:
  - selective_search_node가 episodic_context, semantic_context를 state에 반환
"""
import sys
import os
import time
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock


# ─────────────────────────────────────────────────────────────────────────────
# 1. Episodic Store 유닛 테스트 (외부 의존성 없음)
# ─────────────────────────────────────────────────────────────────────────────
class TestEpisodicStore(unittest.TestCase):
    """database.memory_store 의 에피소딕 메모리 테스트."""

    def setUp(self):
        # 임시 디렉터리로 에피소딕 저장소 격리
        self._tmpdir = tempfile.mkdtemp()
        import database.memory_store as ms
        self._original_dir = ms._EPISODIC_DIR
        ms._EPISODIC_DIR = Path(self._tmpdir)

    def tearDown(self):
        import database.memory_store as ms
        ms._EPISODIC_DIR = self._original_dir
        shutil.rmtree(self._tmpdir, ignore_errors=True)

    def _ms(self):
        import database.memory_store as ms
        return ms

    def test_save_and_load(self):
        ms = self._ms()
        ws = "ws-test-001"
        ms.save_episode(ws, "Python이 뭐야?", "Python은 고수준 프로그래밍 언어입니다.")
        ms.save_episode(ws, "React란?", "React는 Meta가 만든 UI 라이브러리입니다.")
        episodes = ms.load_recent_episodes(ws, limit=10)
        self.assertEqual(len(episodes), 2)
        self.assertEqual(episodes[0]["user"], "Python이 뭐야?")
        self.assertEqual(episodes[1]["user"], "React란?")

    def test_count_episodes(self):
        ms = self._ms()
        ws = "ws-count-001"
        self.assertEqual(ms.count_episodes(ws), 0)
        ms.save_episode(ws, "질문1", "답변1")
        ms.save_episode(ws, "질문2", "답변2")
        ms.save_episode(ws, "질문3", "답변3")
        self.assertEqual(ms.count_episodes(ws), 3)

    def test_load_limit(self):
        ms = self._ms()
        ws = "ws-limit-001"
        for i in range(10):
            ms.save_episode(ws, f"질문{i}", f"답변{i}")
        recent = ms.load_recent_episodes(ws, limit=3)
        self.assertEqual(len(recent), 3)
        # 가장 최근 3개여야 함
        self.assertEqual(recent[-1]["user"], "질문9")

    def test_prune_episodes(self):
        ms = self._ms()
        ws = "ws-prune-001"
        for i in range(60):
            ms.save_episode(ws, f"q{i}", f"a{i}")
        self.assertEqual(ms.count_episodes(ws), 60)
        ms.prune_episodes(ws, keep=50)
        self.assertEqual(ms.count_episodes(ws), 50)
        # 가장 최근 것이 남아야 함
        recent = ms.load_recent_episodes(ws, limit=1)
        self.assertEqual(recent[-1]["user"], "q59")

    def test_format_episodic_context(self):
        ms = self._ms()
        ws = "ws-fmt-001"
        ms.save_episode(ws, "팀 구성 추천해줘", "5명 팀 추천: 프론트 2명, 백엔드 2명, DevOps 1명")
        ctx = ms.format_episodic_context(ws, limit=5)
        self.assertIn("에피소딕 메모리", ctx)
        self.assertIn("팀 구성 추천해줘", ctx)
        self.assertIn("5명 팀 추천", ctx)

    def test_format_empty_workspace(self):
        ms = self._ms()
        ctx = ms.format_episodic_context("ws-nonexistent", limit=5)
        self.assertEqual(ctx, "")

    def test_save_ignores_empty_inputs(self):
        ms = self._ms()
        ws = "ws-empty-001"
        ms.save_episode(ws, "", "답변")      # 빈 user_msg
        ms.save_episode(ws, "질문", "")      # 빈 ai_msg
        ms.save_episode("", "질문", "답변")  # 빈 workspace_id
        self.assertEqual(ms.count_episodes(ws), 0)

    def test_timestamp_is_stored(self):
        ms = self._ms()
        ws = "ws-ts-001"
        before = time.time()
        ms.save_episode(ws, "질문", "답변")
        after = time.time()
        eps = ms.load_recent_episodes(ws, limit=1)
        self.assertEqual(len(eps), 1)
        self.assertGreaterEqual(eps[0]["ts"], before)
        self.assertLessEqual(eps[0]["ts"], after)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Semantic Store 유닛 테스트 (Neo4j 없으면 SKIP)
# ─────────────────────────────────────────────────────────────────────────────
def _neo4j_is_real() -> bool:
    neo4j_mod = sys.modules.get("neo4j")
    return not isinstance(neo4j_mod, MagicMock)


SKIP_NEO4J = (not _neo4j_is_real()) or os.environ.get("SKIP_NEO4J", "").lower() in ("1", "true")

NEO4J_SKIP_REASON = "Neo4j 미연결 (SKIP_NEO4J=1 또는 mock)"
TEST_WS = "test-memory-ws-99"


@unittest.skipIf(SKIP_NEO4J, NEO4J_SKIP_REASON)
class TestSemanticStore(unittest.TestCase):
    """Neo4j SemanticFact 저장/조회 E2E 테스트."""

    @classmethod
    def setUpClass(cls):
        from database.graph_store import _get_driver
        try:
            with _get_driver().session() as session:
                session.run("MATCH (f:SemanticFact {workspace_id: $ws}) DETACH DELETE f", ws=TEST_WS)
        except Exception as e:
            raise unittest.SkipTest(f"Neo4j 연결 실패: {e}")

    @classmethod
    def tearDownClass(cls):
        from database.graph_store import _get_driver
        try:
            with _get_driver().session() as session:
                session.run("MATCH (f:SemanticFact {workspace_id: $ws}) DETACH DELETE f", ws=TEST_WS)
        except Exception:
            pass

    def test_save_and_load_semantic_fact(self):
        from database.graph_store import save_semantic_fact, load_semantic_facts
        save_semantic_fact(TEST_WS, "user_preference", "이 팀은 React와 TypeScript를 선호함")
        save_semantic_fact(TEST_WS, "domain_expertise", "백엔드는 Spring Boot 사용 중")
        result = load_semantic_facts(TEST_WS, limit=10)
        self.assertIn("React", result)
        self.assertIn("Spring Boot", result)

    def test_fact_type_saved_correctly(self):
        from database.graph_store import save_semantic_fact, _get_driver
        save_semantic_fact(TEST_WS, "recurring_topic", "비용 최적화 관심 높음")
        with _get_driver().session() as session:
            r = session.run(
                "MATCH (f:SemanticFact {workspace_id: $ws, fact_type: 'recurring_topic'}) RETURN f.content AS c",
                ws=TEST_WS,
            )
            rows = r.data()
        contents = [row["c"] for row in rows]
        self.assertTrue(any("비용 최적화" in c for c in contents))

    def test_invalid_fact_type_defaults_to_domain_expertise(self):
        from database.graph_store import save_semantic_fact, _get_driver
        save_semantic_fact(TEST_WS, "invalid_type_xyz", "잘못된 타입으로 저장 시도")
        with _get_driver().session() as session:
            r = session.run(
                "MATCH (f:SemanticFact {workspace_id: $ws, fact_type: 'domain_expertise'}) RETURN count(f) AS cnt",
                ws=TEST_WS,
            )
            cnt = r.single()["cnt"]
        self.assertGreater(cnt, 0)

    def test_consolidate_with_mock_llm(self):
        from database.graph_store import consolidate_to_semantic, _last_consolidate
        # 스로틀 우회를 위해 타임스탬프 리셋
        _last_consolidate.pop(TEST_WS, None)

        mock_llm = MagicMock()
        mock_llm.invoke.return_value = MagicMock(
            content='{"facts": [{"fact_type": "recurring_topic", "content": "데이터 분석 관련 질문이 많음"}]}'
        )
        ep_text = "사용자: 데이터 분석 방법 알려줘\nDati: Pandas와 SQL을 활용하세요."
        count = consolidate_to_semantic(TEST_WS, ep_text, mock_llm)
        self.assertGreater(count, 0)

    def test_load_semantic_facts_empty_workspace(self):
        from database.graph_store import load_semantic_facts
        result = load_semantic_facts("nonexistent-ws-abc123", limit=5)
        self.assertEqual(result, "")

    def test_load_semantic_facts_for_query_relevance(self):
        """관련도 필터: limit 준수 + React 팩트가 상위로 선택됨."""
        import numpy as np
        from database.graph_store import save_semantic_fact, load_semantic_facts_for_query, _get_driver
        ws = TEST_WS + "-relevance"
        with _get_driver().session() as s:
            s.run("MATCH (f:SemanticFact {workspace_id: $ws}) DETACH DELETE f", ws=ws)
        save_semantic_fact(ws, "domain_expertise", "이 팀은 React와 TypeScript로 프론트엔드 개발")
        save_semantic_fact(ws, "user_preference",  "팀원들이 코드 리뷰를 중요하게 여김")
        save_semantic_fact(ws, "recurring_topic",  "비용 절감과 클라우드 인프라 최적화 논의")
        save_semantic_fact(ws, "key_decision",     "백엔드는 Spring Boot, DB는 PostgreSQL 선택")

        # 제어된 mock 모델: React 팩트에 가장 높은 유사도 부여
        call_count = [0]
        def fake_encode(texts, normalize_embeddings=True, batch_size=64):
            call_count[0] += 1
            if call_count[0] == 1:  # query embedding → [1, 0, 0, 0]
                return np.array([1.0, 0.0, 0.0, 0.0])
            # fact embeddings: React 팩트 = [1,0,0,0], 나머지 = [0,1,0,0]~[0,0,0,1]
            n = len(texts)
            embs = np.zeros((n, 4))
            for i, t in enumerate(texts):
                embs[i, 0 if "React" in str(t) else (i % 3 + 1)] = 1.0
            return embs
        mock_model = MagicMock()
        mock_model.encode.side_effect = fake_encode

        result = load_semantic_facts_for_query(ws, "React 컴포넌트 설계", mock_model, limit=2)
        lines = [l for l in result.strip().split("\n") if l.strip()]
        self.assertLessEqual(len(lines), 2)          # limit 준수
        self.assertTrue(any("React" in l for l in lines))  # React 팩트 포함

        with _get_driver().session() as s:
            s.run("MATCH (f:SemanticFact {workspace_id: $ws}) DETACH DELETE f", ws=ws)


# ─────────────────────────────────────────────────────────────────────────────
# 3. save_episode_from_history 통합 테스트 (memory_store 기반, nodes 미사용)
# ─────────────────────────────────────────────────────────────────────────────
class TestSaveEpisodeFromHistory(unittest.TestCase):
    """memory_store.save_episode_from_history — history_list 파싱 로직 테스트."""

    def setUp(self):
        self._tmpdir = tempfile.mkdtemp()
        import database.memory_store as ms
        self._original_dir = ms._EPISODIC_DIR
        ms._EPISODIC_DIR = Path(self._tmpdir)

    def tearDown(self):
        import database.memory_store as ms
        ms._EPISODIC_DIR = self._original_dir
        shutil.rmtree(self._tmpdir, ignore_errors=True)

    def test_extracts_last_pair_from_history(self):
        from database.memory_store import save_episode_from_history, load_recent_episodes
        history = [
            {"role": "user",      "content": "이전 질문1"},
            {"role": "assistant", "content": "이전 답변1"},
            {"role": "user",      "content": "최신 질문"},
            {"role": "assistant", "content": "최신 답변"},
        ]
        ws = "ws-save-ep-001"
        save_episode_from_history(ws, history)
        eps = load_recent_episodes(ws, limit=5)
        self.assertEqual(len(eps), 1)
        self.assertEqual(eps[0]["user"], "최신 질문")
        self.assertEqual(eps[0]["ai"],   "최신 답변")

    def test_no_episode_saved_if_only_user_message(self):
        from database.memory_store import save_episode_from_history, count_episodes
        history = [{"role": "user", "content": "질문만 있음"}]
        ws = "ws-save-ep-002"
        save_episode_from_history(ws, history)
        self.assertEqual(count_episodes(ws), 0)

    def test_no_episode_saved_for_empty_history(self):
        from database.memory_store import save_episode_from_history, count_episodes
        ws = "ws-save-ep-003"
        save_episode_from_history(ws, [])
        self.assertEqual(count_episodes(ws), 0)


if __name__ == "__main__":
    unittest.main()

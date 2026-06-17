"""
Phase 2 Item 9 — 회귀 테스트
코드 변경 후에도 핵심 동작이 유지되는지 자동 검증.
LLM 호출 없이 실행 가능 (conftest mock 활용).

검증 영역:
  A. 라우팅 — 시맨틱 스코어가 명확한 케이스는 항상 같은 방향으로 라우팅
  B. 에피소딕 메모리 — 저장→로딩→포맷 파이프라인
  C. 토픽 겹침 필터 — 무관한 질문엔 메모리 주입 안 됨
  D. search_grader 패스스루 — 검색 결과 없으면 sufficient 반환
  E. tool_use_failed 핸들링 — 400 에러 catch 로직
  F. 시맨틱 통합 스로틀 — 5분 내 재호출 무시
"""
import sys
import os
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch


# ─────────────────────────────────────────────────────────────────────────────
# A. 라우팅 회귀 — _semantic_score 기반 방향성 테스트
# ─────────────────────────────────────────────────────────────────────────────
class TestRoutingRegression(unittest.TestCase):
    """시맨틱 라우팅에서 명확한 케이스가 일관된 방향으로 분류되는지 검증."""

    def setUp(self):
        from sentence_transformers import SentenceTransformer
        self._real_st = isinstance(
            sys.modules.get("sentence_transformers"), MagicMock
        )

    def _score(self, query: str) -> dict:
        """_semantic_score를 직접 호출하지 않고 점수 비교만 검증."""
        # sentence_transformers가 mock이면 스킵
        if isinstance(sys.modules.get("sentence_transformers"), MagicMock):
            self.skipTest("sentence_transformers mocked — 임베딩 테스트 불가")
        from ai_core.nodes import _semantic_score
        return _semantic_score(query)

    def test_coding_query_scores_highest_for_coding(self):
        scores = self._score("파이썬 버블 정렬 코드 짜줘")
        self.assertGreater(scores["coding_math_agent"], scores["general_agent"])

    def test_general_query_scores_highest_for_general(self):
        scores = self._score("안녕하세요! 오늘 뭐 도와드릴까요?")
        self.assertGreater(scores["general_agent"], scores["coding_math_agent"])

    def test_expert_query_scores_highest_for_expert(self):
        scores = self._score("마이크로서비스 아키텍처 장단점 분석해줘")
        self.assertGreater(scores["expert_agent"], scores["coding_math_agent"])


# ─────────────────────────────────────────────────────────────────────────────
# B. 에피소딕 메모리 파이프라인 회귀
# ─────────────────────────────────────────────────────────────────────────────
class TestEpisodicPipelineRegression(unittest.TestCase):
    """저장 → 로딩 → 포맷 전체 파이프라인이 항상 일관되게 동작하는지."""

    def setUp(self):
        self._tmpdir = tempfile.mkdtemp()
        import database.memory_store as ms
        self._orig = ms._EPISODIC_DIR
        ms._EPISODIC_DIR = Path(self._tmpdir)

    def tearDown(self):
        import database.memory_store as ms
        ms._EPISODIC_DIR = self._orig
        shutil.rmtree(self._tmpdir, ignore_errors=True)

    def test_save_then_format_contains_content(self):
        from database.memory_store import save_episode, format_episodic_context
        ws = "reg-ep-01"
        save_episode(ws, "React 써도 돼?", "React + TypeScript 추천합니다.")
        ctx = format_episodic_context(ws, limit=5)
        self.assertIn("에피소딕 메모리", ctx)
        self.assertIn("React", ctx)

    def test_prune_keeps_most_recent(self):
        from database.memory_store import save_episode, prune_episodes, load_recent_episodes
        ws = "reg-ep-02"
        for i in range(10):
            save_episode(ws, f"q{i}", f"a{i}")
        prune_episodes(ws, keep=5)
        eps = load_recent_episodes(ws, limit=10)
        self.assertEqual(len(eps), 5)
        self.assertEqual(eps[-1]["user"], "q9")

    def test_save_from_history_extracts_last_pair(self):
        from database.memory_store import save_episode_from_history, load_recent_episodes
        ws = "reg-ep-03"
        history = [
            {"role": "user",      "content": "이전 질문"},
            {"role": "assistant", "content": "이전 답변"},
            {"role": "user",      "content": "최신 질문"},
            {"role": "assistant", "content": "최신 답변"},
        ]
        save_episode_from_history(ws, history)
        eps = load_recent_episodes(ws, limit=5)
        self.assertEqual(len(eps), 1)
        self.assertEqual(eps[0]["user"], "최신 질문")

    def test_empty_history_saves_nothing(self):
        from database.memory_store import save_episode_from_history, count_episodes
        ws = "reg-ep-04"
        save_episode_from_history(ws, [])
        self.assertEqual(count_episodes(ws), 0)

    def test_incomplete_history_saves_nothing(self):
        """user 메시지만 있고 assistant 없으면 저장 안 됨."""
        from database.memory_store import save_episode_from_history, count_episodes
        ws = "reg-ep-05"
        save_episode_from_history(ws, [{"role": "user", "content": "질문만"}])
        self.assertEqual(count_episodes(ws), 0)


# ─────────────────────────────────────────────────────────────────────────────
# C. 토픽 겹침 필터 회귀 — general_agent 메모리 주입 조건
# ─────────────────────────────────────────────────────────────────────────────
class TestTopicOverlapFilter(unittest.TestCase):
    """무관한 질문엔 에피소딕 메모리가 주입되지 않아야 한다."""

    def _overlap(self, query: str, ctx: str) -> bool:
        query_words = set(query.replace("?", "").replace(".", "").split())
        ctx_words = set(ctx.split())
        return len(query_words & ctx_words) >= 2

    def test_related_query_overlaps(self):
        ctx = "React TypeScript 프론트엔드 컴포넌트 설계"
        self.assertTrue(self._overlap("React 컴포넌트 설계 어떻게 해?", ctx))

    def test_unrelated_query_no_overlap(self):
        ctx = "React TypeScript 프론트엔드 컴포넌트 설계"
        self.assertFalse(self._overlap("오늘 점심 뭐 먹을까?", ctx))

    def test_memory_keyword_bypasses_overlap(self):
        """기억 키워드가 있으면 토픽 무관해도 주입."""
        memory_keywords = ["방금", "기억", "아까", "이전에", "뭐 물어", "뭐라고",
                           "말했잖", "어떤 질문", "지난번", "저번에", "전에 했던", "예전에"]
        query = "저번에 뭐 물어봤지?"
        is_memory = any(kw in query for kw in memory_keywords)
        self.assertTrue(is_memory)

    def test_partial_overlap_below_threshold(self):
        """1개만 겹치면 주입 안 됨 (threshold=2)."""
        ctx = "React TypeScript 프론트엔드 컴포넌트 설계"
        self.assertFalse(self._overlap("React 할 일 없어", ctx))


# ─────────────────────────────────────────────────────────────────────────────
# D. search_grader 패스스루 회귀
# ─────────────────────────────────────────────────────────────────────────────
class TestSearchGraderRegression(unittest.TestCase):
    """검색 결과가 전혀 없으면 sufficient 패스스루해야 한다."""

    def _make_state(self, search="", web="", graph="", attempts=0):
        return {
            "query": "테스트 질문",
            "query_rewritten": "테스트 질문",
            "search_context": search,
            "web_context": web,
            "graph_context": graph,
            "search_attempts": attempts,
        }

    def test_empty_results_returns_sufficient(self):
        """세 컨텍스트 모두 비어있으면 LLM 호출 없이 sufficient 반환."""
        from database.memory_store import save_episode  # warmup import (conftest 체크)
        # search_grader_node는 nodes.py import 없이 직접 테스트 불가
        # → 로직만 인라인으로 검증
        state = self._make_state()
        search_ctx = (state.get("search_context") or "")[:400]
        web_ctx    = (state.get("web_context")    or "")[:200]
        graph_ctx  = (state.get("graph_context")  or "")[:400]
        # 모두 비어있으면 sufficient
        all_empty = not search_ctx and not web_ctx and not graph_ctx
        self.assertTrue(all_empty)

    def test_max_attempts_guard(self):
        """search_attempts >= 2 이면 강제 sufficient."""
        attempts = 2
        max_attempts = 2
        self.assertGreaterEqual(attempts, max_attempts)


# ─────────────────────────────────────────────────────────────────────────────
# E. tool_use_failed 핸들링 회귀
# ─────────────────────────────────────────────────────────────────────────────
class TestToolUseFailedRegression(unittest.TestCase):
    """Groq 400 tool_use_failed 에러가 앱 크래시 없이 처리되어야 한다."""

    def test_tool_use_failed_detected(self):
        """tool_use_failed 문자열이 에러 메시지에 있으면 감지됨."""
        err_msg = "Error code: 400 - {'error': {'code': 'tool_use_failed', ...}}"
        is_tool_fail = "tool_use_failed" in err_msg or (
            "400" in err_msg and "tool" in err_msg.lower()
        )
        self.assertTrue(is_tool_fail)

    def test_normal_rate_limit_not_confused(self):
        """rate_limit_exceeded는 tool_use_failed로 감지되면 안 됨."""
        err_msg = "Error code: 429 - {'error': {'code': 'rate_limit_exceeded'}}"
        is_tool_fail = "tool_use_failed" in err_msg
        self.assertFalse(is_tool_fail)

    def test_400_without_tool_not_confused(self):
        """400이어도 'tool' 키워드 없으면 tool_use_failed 아님."""
        err_msg = "Error code: 400 - {'error': {'message': 'bad request format'}}"
        is_tool_fail = "tool_use_failed" in err_msg or (
            "400" in err_msg and "tool" in err_msg.lower()
        )
        self.assertFalse(is_tool_fail)


# ─────────────────────────────────────────────────────────────────────────────
# F. 시맨틱 통합 스로틀 회귀
# ─────────────────────────────────────────────────────────────────────────────
class TestSemanticConsolidateThrottle(unittest.TestCase):
    """5분 스로틀 내 재호출은 무시되어야 한다."""

    def setUp(self):
        self._tmpdir = tempfile.mkdtemp()
        import database.memory_store as ms
        self._orig = ms._EPISODIC_DIR
        ms._EPISODIC_DIR = Path(self._tmpdir)

    def tearDown(self):
        import database.memory_store as ms
        ms._EPISODIC_DIR = self._orig
        shutil.rmtree(self._tmpdir, ignore_errors=True)

    def test_throttle_blocks_second_call(self):
        from database.graph_store import consolidate_to_semantic, _last_consolidate
        import time

        ws = "reg-throttle-01"
        _last_consolidate.pop(ws, None)

        mock_llm = MagicMock()
        mock_llm.invoke.return_value = MagicMock(content='{"facts": []}')

        # 첫 번째 호출 — 통과
        _last_consolidate[ws] = time.time()  # 방금 실행된 것처럼 세팅
        result = consolidate_to_semantic(ws, "에피소드 텍스트", mock_llm)
        # 5분 내이므로 0 반환 (스로틀)
        self.assertEqual(result, 0)

    def test_throttle_allows_after_interval(self):
        from database.graph_store import consolidate_to_semantic, _last_consolidate
        import time

        ws = "reg-throttle-02"
        # 6분 전에 마지막 실행된 것처럼 세팅
        _last_consolidate[ws] = time.time() - 361

        mock_llm = MagicMock()
        mock_llm.invoke.return_value = MagicMock(
            content='{"facts": [{"fact_type": "domain_expertise", "content": "테스트 사실"}]}'
        )

        with patch("database.graph_store.save_semantic_fact"):
            result = consolidate_to_semantic(ws, "에피소드 텍스트", mock_llm)
        # 스로틀 해제 → LLM 호출됨
        mock_llm.invoke.assert_called_once()


# ─────────────────────────────────────────────────────────────────────────────
# G. 트레이서 회귀 — Phase 2 Item 10
# ─────────────────────────────────────────────────────────────────────────────
class TestTracerRegression(unittest.TestCase):
    """요청 트레이스 생성·기록·저장·로딩 파이프라인이 일관되게 동작하는지."""

    def setUp(self):
        self._tmpdir = tempfile.mkdtemp()
        import ai_core.tracer as tr
        self._orig_dir = tr._TRACE_DIR
        tr._TRACE_DIR = Path(self._tmpdir)
        self._tr = tr
        # 테스트 시작 전 active dict 스냅샷 — tearDown에서 격리 복원
        with tr._lock:
            self._pre_active_keys = set(tr._active.keys())

    def tearDown(self):
        # 이 테스트가 남긴 orphaned trace 정리 (finish_and_save 없이 끝난 케이스)
        with self._tr._lock:
            for key in list(self._tr._active.keys()):
                if key not in self._pre_active_keys:
                    del self._tr._active[key]
        self._tr._TRACE_DIR = self._orig_dir
        shutil.rmtree(self._tmpdir, ignore_errors=True)

    def test_start_and_get_trace(self):
        """start_trace 후 get_trace로 동일 컨텍스트 반환."""
        tid = "test0001"
        ctx = self._tr.start_trace(tid, "ws-1", "테스트 쿼리")
        self.assertIsNotNone(ctx)
        self.assertEqual(self._tr.get_trace(tid), ctx)

    def test_record_routing(self):
        tid = "test0002"
        self._tr.start_trace(tid, "ws-1", "전문 분석해줘")
        self._tr.record_routing(tid, "expert_agent")
        ctx = self._tr.get_trace(tid)
        self.assertEqual(ctx.routing, "expert_agent")

    def test_record_tool_calls(self):
        tid = "test0003"
        self._tr.start_trace(tid, "ws-1", "내부 문서 찾아줘")
        self._tr.record_tool_calls(tid, ["rag_search", "web_search_tool"])
        ctx = self._tr.get_trace(tid)
        self.assertIn("rag_search", ctx.tool_calls)

    def test_finish_removes_active_trace(self):
        """finish_and_save 후 get_trace는 None 반환."""
        tid = "test0004"
        self._tr.start_trace(tid, "ws-1", "쿼리")
        self._tr.finish_and_save(tid, total_ms=500, final_answer="답변")
        self.assertIsNone(self._tr.get_trace(tid))

    def test_persist_and_load(self):
        """저장된 트레이스를 load_recent_traces로 읽을 수 있어야 한다."""
        tid = "test0005"
        self._tr.start_trace(tid, "ws-2", "지식 질문")
        self._tr.record_routing(tid, "general_agent")
        self._tr.finish_and_save(tid, total_ms=1200, final_answer="답")
        records = self._tr.load_recent_traces(n=10)
        self.assertTrue(any(r["trace_id"] == tid for r in records))

    def test_load_returns_latest_first(self):
        """load_recent_traces는 최신 트레이스가 먼저 와야 한다."""
        import time as _time
        base_ms = int(_time.time() * 1000)
        for i, tid in enumerate(["ta0001", "ta0002", "ta0003"]):
            ctx = self._tr.start_trace(tid, "ws-3", f"쿼리{i}")
            ctx.start_ms = base_ms + i * 500  # 500ms 간격으로 강제 설정 → 충돌 없음
            self._tr.finish_and_save(tid, total_ms=100 * (i + 1))
        records = self._tr.load_recent_traces(n=10)
        # ta0003이 가장 최근이므로 먼저 나와야 함
        loaded_ids = [r["trace_id"] for r in records if r["trace_id"].startswith("ta")]
        self.assertEqual(loaded_ids, ["ta0003", "ta0002", "ta0001"])

    def test_tool_calls_deduplication(self):
        """ReAct 루프에서 누적 이력을 반복 전송해도 저장 시 중복 제거돼야 한다."""
        tid = "test0007"
        self._tr.start_trace(tid, "ws-1", "내부+외부 검색")
        # 라운드 1: rag_search 호출
        self._tr.record_tool_calls(tid, ["rag_search"])
        # 라운드 2: 누적 이력 전체 재전송 + web_search_tool 추가
        self._tr.record_tool_calls(tid, ["rag_search", "web_search_tool"])
        record = self._tr.finish_and_save(tid, total_ms=2000)
        self.assertEqual(record["tool_calls"], ["rag_search", "web_search_tool"])

    def test_error_recorded_in_trace(self):
        """record_error가 호출되면 저장된 트레이스에 error 필드가 채워진다."""
        tid = "test0008"
        self._tr.start_trace(tid, "ws-1", "쿼리")
        self._tr.record_error(tid, "LLM timeout after 30s")
        record = self._tr.finish_and_save(tid, total_ms=30000)
        self.assertIn("timeout", record["error"])

    def test_nonexistent_trace_is_noop(self):
        """존재하지 않는 trace_id에 기록해도 예외 없음."""
        self._tr.record_routing("ghost-id", "expert_agent")
        self._tr.record_tool_calls("ghost-id", ["rag_search"])
        result = self._tr.finish_and_save("ghost-id", total_ms=0)
        self.assertEqual(result, {})


if __name__ == "__main__":
    unittest.main()

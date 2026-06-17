"""
Phase 2 Item 10 — 경량 요청 트레이서
각 요청에 trace_id를 부여하고 노드 타이밍, 라우팅, 도구 호출을 기록.
data/traces/YYYY-MM-DD.jsonl 에 JSONL 형식으로 영속 저장.
"""
import json
import time
import threading
from datetime import date
from pathlib import Path

_TRACE_DIR = Path("data/traces")
_active: dict[str, "TraceContext"] = {}
_lock = threading.Lock()


class TraceContext:
    def __init__(self, trace_id: str, workspace_id: str, query: str):
        self.trace_id = trace_id
        self.workspace_id = workspace_id
        self.query = query[:120]
        self.start_ms = int(time.time() * 1000)
        self.routing: str = ""
        self.node_timings: list = []   # [{"node": str, "duration_ms": int}]
        self.tool_calls: list = []     # ["rag_search", "web_search_tool", ...]
        self.error: str = ""


def start_trace(trace_id: str, workspace_id: str, query: str) -> TraceContext:
    ctx = TraceContext(trace_id, workspace_id, query)
    with _lock:
        _active[trace_id] = ctx
    return ctx


def get_trace(trace_id: str) -> "TraceContext | None":
    with _lock:
        return _active.get(trace_id)


def record_routing(trace_id: str, target: str) -> None:
    ctx = get_trace(trace_id)
    if ctx:
        ctx.routing = target


def record_node_timing(trace_id: str, node: str, duration_ms: int) -> None:
    ctx = get_trace(trace_id)
    if ctx:
        ctx.node_timings.append({"node": node, "duration_ms": duration_ms})


def record_tool_calls(trace_id: str, calls: list) -> None:
    ctx = get_trace(trace_id)
    if ctx:
        ctx.tool_calls.extend(calls)


def record_error(trace_id: str, error: str) -> None:
    ctx = get_trace(trace_id)
    if ctx:
        ctx.error = str(error)[:200]


def finish_and_save(trace_id: str, *, total_ms: int, final_answer: str = "") -> dict:
    with _lock:
        ctx = _active.pop(trace_id, None)
    if not ctx:
        return {}

    record = {
        "trace_id": trace_id,
        "ts": ctx.start_ms,
        "workspace_id": ctx.workspace_id,
        "query": ctx.query,
        "routing": ctx.routing,
        # ReAct 루프가 누적 이력을 매 라운드 재전송하므로 순서 보존 중복 제거
        "tool_calls": list(dict.fromkeys(ctx.tool_calls)),
        "node_timings": ctx.node_timings,
        "total_ms": total_ms,
        "answer_len": len(final_answer),
        "error": ctx.error,
    }
    try:
        _persist(record)
    except Exception as e:
        print(f"[Tracer] 트레이스 저장 실패 (trace_id={trace_id}): {e}")
    return record


def _persist(record: dict) -> None:
    _TRACE_DIR.mkdir(parents=True, exist_ok=True)
    path = _TRACE_DIR / f"{date.today().isoformat()}.jsonl"
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def load_recent_traces(n: int = 50) -> list:
    """최근 N개 트레이스를 최신순으로 반환."""
    _TRACE_DIR.mkdir(parents=True, exist_ok=True)
    records = []
    for path in sorted(_TRACE_DIR.glob("*.jsonl"), reverse=True)[:3]:
        try:
            with open(path, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        records.append(json.loads(line))
        except Exception:
            pass
    return sorted(records, key=lambda r: r.get("ts", 0), reverse=True)[:n]

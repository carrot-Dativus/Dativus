# database/memory_store.py
"""
Phase 2 — 단/장기 메모리 분리 (Item 8)

Episodic Store:  최근 N회 대화 턴을 워크스페이스별 JSONL 파일로 보관 (단기, 세션 간 연속)
Semantic Store:  graph_store.py의 SemanticFact 노드로 위임 (장기, 패턴/사실 추출 결과)
"""
import json
import time
from pathlib import Path

_EPISODIC_DIR = Path(__file__).parent.parent / "data" / "episodic"
_EPISODIC_DIR.mkdir(parents=True, exist_ok=True)

_MAX_EPISODES = 50         # 워크스페이스당 보관할 최대 에피소드 수
CONSOLIDATE_THRESHOLD = 20  # 이 배수에 도달할 때마다 시맨틱 통합 트리거


def _ep_path(workspace_id: str) -> Path:
    safe = workspace_id.replace("/", "_").replace("\\", "_")[:64]
    return _EPISODIC_DIR / f"{safe}.jsonl"


# ──────────────────────────────────────────────
# Episodic Store API
# ──────────────────────────────────────────────

def save_episode(workspace_id: str, user_msg: str, ai_msg: str):
    """대화 1턴을 에피소딕 스토어에 저장."""
    if not workspace_id or not user_msg or not ai_msg:
        return
    ep = {
        "ts": time.time(),
        "user": user_msg.strip()[:400],
        "ai": ai_msg.strip()[:400],
    }
    with open(_ep_path(workspace_id), "a", encoding="utf-8") as f:
        f.write(json.dumps(ep, ensure_ascii=False) + "\n")


def load_recent_episodes(workspace_id: str, limit: int = 10) -> list:
    """최근 N턴 에피소드 로드 (오래된 순 → 최신 순)."""
    path = _ep_path(workspace_id)
    if not path.exists():
        return []
    episodes = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            episodes.append(json.loads(line))
        except Exception:
            pass
    return episodes[-limit:]


def count_episodes(workspace_id: str) -> int:
    path = _ep_path(workspace_id)
    if not path.exists():
        return 0
    return sum(1 for l in path.read_text(encoding="utf-8").splitlines() if l.strip())


def prune_episodes(workspace_id: str, keep: int = _MAX_EPISODES):
    """오래된 에피소드 정리 — keep개만 유지."""
    path = _ep_path(workspace_id)
    if not path.exists():
        return
    lines = [l for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
    if len(lines) > keep:
        path.write_text("\n".join(lines[-keep:]) + "\n", encoding="utf-8")


def format_episodic_context(workspace_id: str, limit: int = 5) -> str:
    """최근 에피소드를 LLM 컨텍스트용 문자열로 포맷."""
    episodes = load_recent_episodes(workspace_id, limit)
    if not episodes:
        return ""
    lines = ["[에피소딕 메모리 — 최근 대화 이력]"]
    for ep in episodes:
        lines.append(f"사용자: {ep['user']}")
        lines.append(f"Dati: {ep['ai']}")
    return "\n".join(lines)


def save_episode_from_history(workspace_id: str, history_list: list):
    """히스토리 리스트에서 가장 최근 user/AI 쌍을 에피소딕 스토어에 저장.
    nodes.py와 테스트 양쪽에서 재사용할 수 있도록 memory_store에 위치.
    """
    if not workspace_id or not history_list:
        return
    user_msg = ai_msg = None
    for msg in reversed(history_list):
        role = msg.get("role", "")
        content = (msg.get("content") or "").strip()
        if role == "assistant" and ai_msg is None:
            ai_msg = content[:400]
        elif role == "user" and user_msg is None:
            user_msg = content[:400]
        if user_msg and ai_msg:
            break
    if user_msg and ai_msg:
        save_episode(workspace_id, user_msg, ai_msg)
        prune_episodes(workspace_id)

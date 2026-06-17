"""
pytest conftest — 외부 의존성을 테스트 전에 sys.modules에 주입.
실제 Neo4j / Groq / LangChain 없이 모듈 import 가능하게 함.
단, Ollama(local_llm)는 실제 연결 사용 — SKIP_OLLAMA=1 로 건너뜀.
"""
import sys
from unittest.mock import MagicMock

# ── neo4j ──────────────────────────────────────────────────────────────────
# 실제 패키지가 설치돼 있으면 mock 하지 않음 (E2E 테스트가 실제 DB를 사용할 수 있게)
try:
    import neo4j as _neo4j_real  # 설치됐으면 그냥 넘어감
except ImportError:
    neo4j_mock = MagicMock()
    neo4j_mock.GraphDatabase.driver.return_value = MagicMock()
    sys.modules["neo4j"] = neo4j_mock

# ── langchain 계열 ─────────────────────────────────────────────────────────
sys.modules.setdefault("langchain_neo4j",    MagicMock())
sys.modules.setdefault("langchain_core",     MagicMock())
sys.modules.setdefault("langchain_core.prompts",  MagicMock())
sys.modules.setdefault("langchain_core.messages", MagicMock())
sys.modules.setdefault("langchain_core.tools",    MagicMock())
sys.modules.setdefault("langchain_groq",     MagicMock())
sys.modules.setdefault("langchain_community",                        MagicMock())
sys.modules.setdefault("langchain_community.chat_models",            MagicMock())
sys.modules.setdefault("langchain_community.tools",                  MagicMock())
sys.modules.setdefault("langchain_community.tools.ddg_search",       MagicMock())
sys.modules.setdefault("langchain_community.tools.ddg_search.tool",  MagicMock())
sys.modules.setdefault("langchain_text_splitters",  MagicMock())
sys.modules.setdefault("langchain_ollama",   MagicMock())
sys.modules.setdefault("langgraph",               MagicMock())
sys.modules.setdefault("langgraph.graph",         MagicMock())
sys.modules.setdefault("langgraph.graph.message", MagicMock())
sys.modules.setdefault("langgraph.prebuilt",      MagicMock())

# ── sentence_transformers ────────────────────────────────────────────────────
sys.modules.setdefault("sentence_transformers", MagicMock())

# ── 기타 외부 의존성 ──────────────────────────────────────────────────────────
sys.modules.setdefault("chromadb", MagicMock())
sys.modules.setdefault("pydantic", MagicMock())

# ── ai_core 내부 모듈 (nodes 임포트 시 TypedDict+Annotated 충돌 방지) ─────────
# ai_core.state.AgentState: Annotated[list, add_messages] 구문이
# Python 3.12 typing에서 MagicMock을 거부함 → state 자체를 미리 모킹.
sys.modules.setdefault("ai_core.state",   MagicMock())
sys.modules.setdefault("ai_core.prompts", MagicMock())

# ── Ollama(local_llm)는 E2E에서 실제 연결 사용 ─────────────────────────────
# TestOllamaFallback 에서 `from ai_core.llms import local_llm` 직접 import.
# conftest가 langchain_ollama를 Mock 해두면 local_llm도 Mock이 됨.
# → E2E 파일에서 직접 ChatOllama를 import해서 우회.

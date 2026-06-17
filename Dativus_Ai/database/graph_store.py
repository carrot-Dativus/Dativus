# database/graph_store.py
import re
import os
import json
import time
from pathlib import Path
from dotenv import load_dotenv
from neo4j import GraphDatabase

_PENDING_FILE = Path(__file__).parent.parent / "data" / "graph_pending.jsonl"
_PENDING_FILE.parent.mkdir(exist_ok=True)

load_dotenv()

_lc_graph = None  # langchain_neo4j.Neo4jGraph 싱글턴


def _get_lc_graph():
    global _lc_graph
    if _lc_graph is None:
        from langchain_neo4j import Neo4jGraph
        _lc_graph = Neo4jGraph(
            url=os.getenv("NEO4J_URI", "bolt://localhost:7687"),
            username=os.getenv("NEO4J_USER", "neo4j"),
            password=os.getenv("NEO4J_PASSWORD", "password"),
        )
    return _lc_graph

TRIPLE_RE = re.compile(
    r'\[([^\]]+)\]\s*[→➔\->]+\s*\(([^)]+)\)\s*[→➔\->]+\s*\[([^\]]+)\]'
)

_PARTICLES = re.compile(
    r'(이|가|을|를|은|는|의|에서|에게|에|로부터|로|으로|와|과|이고|이며|이다|란|라는|이란)$'
)

# 동사 어미 — 긴 패턴 먼저 (순서 중요)
_VERB_ENDINGS = re.compile(
    r'(합니다|됩니다|했습니다|됐습니다|'
    r'한다|하다|된다|되다|했다|됐다|'
    r'됨|함|이다|는다|겠다|었다|았다|었음|았음)$'
)


def normalize_entity(name: str) -> str:
    """한국어 조사/어미 제거 + 공백 정규화. 최대 2회 반복으로 중첩 조사 처리."""
    name = name.strip()
    for _ in range(2):
        cleaned = _PARTICLES.sub('', name)
        if cleaned == name:
            break
        name = cleaned
    return name


def normalize_predicate(pred: str) -> str:
    """관계 동사 어미 제거 — '사용한다'→'사용', '개발됨'→'개발'. 최대 2회 반복.
    결과가 2자 미만이면 과잉 제거로 판단하고 중단 ('포함됨'→'포함', '포함'→'포함' 유지).
    """
    pred = pred.strip()
    for _ in range(2):
        cleaned = _VERB_ENDINGS.sub('', pred)
        if cleaned == pred or not cleaned or len(cleaned) < 2:
            break
        pred = cleaned
    return pred

# ──────────────────────────────────────────────
# ④ TTL 캐시 (60초) — Neo4j 반복 쿼리 절감
# ──────────────────────────────────────────────
_CACHE: dict = {}
_CACHE_TTL = 60  # seconds

# ① 병합 스로틀 — 같은 워크스페이스에서 5분에 1회만 O(n²) 병합 수행
_last_merge: dict = {}
_last_pred_merge: dict = {}
_MERGE_INTERVAL = 300  # seconds


def _cache_get(key: str):
    entry = _CACHE.get(key)
    if entry and (time.time() - entry[1]) < _CACHE_TTL:
        return entry[0]
    _CACHE.pop(key, None)
    return None


def _cache_set(key: str, value):
    _CACHE[key] = (value, time.time())


def _invalidate_cache(workspace_id: str):
    """그래프가 변경될 때 해당 워크스페이스의 캐시 전체 무효화."""
    stale = [k for k in _CACHE if workspace_id in k]
    for k in stale:
        _CACHE.pop(k, None)


_driver = None


def _get_driver():
    global _driver
    if _driver is None:
        uri  = os.getenv("NEO4J_URI",      "bolt://localhost:7687")
        user = os.getenv("NEO4J_USER",     "neo4j")
        pwd  = os.getenv("NEO4J_PASSWORD", "password")
        _driver = GraphDatabase.driver(uri, auth=(user, pwd))
    return _driver


def ensure_constraints():
    """서버 시작 시 1회 — 유니크 제약 생성."""
    with _get_driver().session() as session:
        session.run(
            "CREATE CONSTRAINT entity_unique IF NOT EXISTS "
            "FOR (e:Entity) REQUIRE (e.workspace_id, e.name) IS UNIQUE"
        )
    print("🕸️ [GraphRAG] Neo4j 연결 완료 & 제약 설정 OK")


def save_triples(workspace_id: str, text: str) -> int:
    """LLM 출력에서 트리플 파싱 후 Neo4j MERGE. 저장된 엣지 수 반환."""
    if not workspace_id or not text:
        return 0
    triples = TRIPLE_RE.findall(text)
    if not triples:
        return 0

    saved = 0
    with _get_driver().session() as session:
        for a, r, b in triples:
            a_norm = normalize_entity(a)
            b_norm = normalize_entity(b)
            r_norm = normalize_predicate(r)[:15]  # 어미 제거 후 15자 절삭
            if not a_norm or not b_norm or not r_norm:
                continue
            session.run(
                """
                MERGE (a:Entity {name: $a, workspace_id: $ws})
                MERGE (b:Entity {name: $b, workspace_id: $ws})
                MERGE (a)-[rel:RELATION {type: $r, workspace_id: $ws}]->(b)
                """,
                a=a_norm, b=b_norm, r=r_norm, ws=workspace_id,
            )
            saved += 1
    if saved:
        _invalidate_cache(workspace_id)
    return saved


def load_context(workspace_id: str, limit: int = 20) -> str:
    """워크스페이스의 누적 트리플을 조회해 텍스트로 반환."""
    if not workspace_id:
        return ""
    key = f"ctx|{workspace_id}|{limit}"
    cached = _cache_get(key)
    if cached is not None:
        return cached
    with _get_driver().session() as session:
        result = session.run(
            """
            MATCH (a:Entity {workspace_id: $ws})-[r:RELATION]->(b:Entity {workspace_id: $ws})
            RETURN a.name AS a, r.type AS rel, b.name AS b
            LIMIT $limit
            """,
            ws=workspace_id, limit=limit,
        )
        rows = result.data()
    if not rows:
        _cache_set(key, "")
        return ""
    text = "\n".join(f"[{row['a']}] → ({row['rel']}) → [{row['b']}]" for row in rows)
    _cache_set(key, text)
    return text


def find_query_entities(workspace_id: str, query: str) -> list:
    """쿼리 텍스트에 포함된 저장된 엔티티 이름을 Neo4j에서 검색 (정확 문자열)."""
    if not workspace_id or not query:
        return []
    with _get_driver().session() as session:
        result = session.run(
            """
            MATCH (e:Entity {workspace_id: $ws})
            WHERE $q CONTAINS e.name
            RETURN e.name AS name
            LIMIT 10
            """,
            ws=workspace_id, q=query,
        )
        return [row["name"] for row in result.data()]


def find_query_entities_semantic(workspace_id: str, query: str, model, threshold: float = 0.42) -> list:
    """② 임베딩 유사도 기반 엔티티 매칭 — 정확한 문자열 불일치도 의미 유사 개체 탐색.
    정확 매칭 결과를 우선 반환하고 시맨틱 결과를 합산.
    """
    if not workspace_id or not query:
        return []

    # 빠른 정확 매칭 먼저
    exact = find_query_entities(workspace_id, query)

    # 전체 엔티티 이름 조회
    cache_key = f"all_entities|{workspace_id}"
    all_names = _cache_get(cache_key)
    if all_names is None:
        with _get_driver().session() as session:
            result = session.run(
                "MATCH (e:Entity {workspace_id: $ws}) RETURN e.name AS name LIMIT 300",
                ws=workspace_id,
            )
            all_names = [row["name"] for row in result.data()]
        _cache_set(cache_key, all_names)

    if not all_names:
        return exact

    import numpy as np
    # 정규화된 임베딩으로 코사인 유사도 = 내적
    query_emb = model.encode(query, normalize_embeddings=True)

    # 엔티티 임베딩도 캐시 (save_triples 호출 시 _invalidate_cache로 함께 무효화됨)
    emb_cache_key = f"all_embeddings|{workspace_id}"
    entity_embs = _cache_get(emb_cache_key)
    if entity_embs is None:
        entity_embs = model.encode(all_names, normalize_embeddings=True, batch_size=64)
        _cache_set(emb_cache_key, entity_embs)

    scores = (entity_embs @ query_emb).tolist()

    semantic = [all_names[i] for i, s in enumerate(scores) if s >= threshold]

    # 중복 제거 (exact 우선 순서 유지)
    seen = set(exact)
    combined = list(exact)
    for name in semantic:
        if name not in seen:
            seen.add(name)
            combined.append(name)

    if combined:
        print(f"🕸️ [GraphRAG] 시맨틱 엔티티 매칭: {combined[:5]} (정확={len(exact)}, 시맨틱={len(semantic)})")

    return combined[:12]


def load_context_for_query(workspace_id: str, query_entities: list, hops: int = 2, limit: int = 30) -> str:
    """쿼리에서 추출한 엔티티 기준으로 N홉 서브그래프 조회."""
    if not workspace_id or not query_entities:
        return load_context(workspace_id, limit)
    key = f"subgraph|{workspace_id}|{','.join(sorted(query_entities))}|{hops}|{limit}"
    cached = _cache_get(key)
    if cached is not None:
        return cached
    with _get_driver().session() as session:
        # [*1..N] 범위에 파라미터 변수 불가 (Neo4j 5+) → hops를 리터럴로 삽입
        result = session.run(
            f"""
            MATCH (start:Entity {{workspace_id: $ws}})
            WHERE start.name IN $entities
            MATCH path = (start)-[*1..{int(hops)}]-(neighbor:Entity {{workspace_id: $ws}})
            UNWIND relationships(path) AS r
            RETURN startNode(r).name AS a, r.type AS rel, endNode(r).name AS b
            LIMIT $limit
            """,
            ws=workspace_id, entities=query_entities, limit=limit,
        )
        rows = result.data()
    if not rows:
        fallback = load_context(workspace_id, limit)
        _cache_set(key, fallback)
        return fallback
    text = "\n".join(f"[{row['a']}] → ({row['rel']}) → [{row['b']}]" for row in rows)
    _cache_set(key, text)
    return text


def append_pending(workspace_id: str, history: str, query: str):
    """Groq 소진 시 대화를 pending 큐에 저장."""
    with open(_PENDING_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps({"ws": workspace_id, "history": history, "query": query, "ts": time.time()}, ensure_ascii=False) + "\n")


def load_pending(workspace_id: str = None) -> list:
    """pending 큐 로드. workspace_id 지정 시 해당 워크스페이스만."""
    if not _PENDING_FILE.exists():
        return []
    items = []
    with open(_PENDING_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
                if workspace_id is None or item.get("ws") == workspace_id:
                    items.append(item)
            except Exception:
                pass
    return items


def clear_pending(workspace_id: str = None):
    """처리 완료된 항목 제거. workspace_id 지정 시 해당 워크스페이스만."""
    if not _PENDING_FILE.exists():
        return
    if workspace_id is None:
        _PENDING_FILE.unlink()
        return
    remaining = []
    with open(_PENDING_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
                if item.get("ws") != workspace_id:
                    remaining.append(line)
            except Exception:
                remaining.append(line)
    with open(_PENDING_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(remaining) + ("\n" if remaining else ""))


def _merge_node_into(workspace_id: str, canonical: str, duplicate: str):
    """duplicate 노드의 모든 관계를 canonical로 이전한 뒤 duplicate 삭제."""
    with _get_driver().session() as session:
        # 나가는 관계 이전
        session.run(
            """
            MATCH (can:Entity {name: $can, workspace_id: $ws})
            MATCH (dup:Entity {name: $dup, workspace_id: $ws})
            MATCH (dup)-[r:RELATION]->(tgt:Entity {workspace_id: $ws})
            MERGE (can)-[:RELATION {type: r.type, workspace_id: $ws}]->(tgt)
            """,
            can=canonical, dup=duplicate, ws=workspace_id,
        )
        # 들어오는 관계 이전
        session.run(
            """
            MATCH (can:Entity {name: $can, workspace_id: $ws})
            MATCH (dup:Entity {name: $dup, workspace_id: $ws})
            MATCH (src:Entity {workspace_id: $ws})-[r:RELATION]->(dup)
            MERGE (src)-[:RELATION {type: r.type, workspace_id: $ws}]->(can)
            """,
            can=canonical, dup=duplicate, ws=workspace_id,
        )
        # duplicate 삭제
        session.run(
            "MATCH (dup:Entity {name: $dup, workspace_id: $ws}) DETACH DELETE dup",
            dup=duplicate, ws=workspace_id,
        )


def merge_similar_entities(workspace_id: str, model, threshold: float = 0.88) -> int:
    """① 임베딩 유사도 기반 중복 엔티티 병합.
    threshold 이상인 쌍을 canonical(먼저 나온 것)로 흡수. 병합된 쌍 수 반환.
    같은 워크스페이스에서 5분에 1회만 실행 (O(n²) 비용 절감).
    """
    if not workspace_id:
        return 0

    # 스로틀: 마지막 병합으로부터 _MERGE_INTERVAL 초 미만이면 건너뜀
    now = time.time()
    if now - _last_merge.get(workspace_id, 0) < _MERGE_INTERVAL:
        return 0
    _last_merge[workspace_id] = now

    with _get_driver().session() as session:
        result = session.run(
            "MATCH (e:Entity {workspace_id: $ws}) RETURN e.name AS name",
            ws=workspace_id,
        )
        names = [row["name"] for row in result.data()]

    if len(names) < 2:
        return 0

    import numpy as np
    embs = model.encode(names, normalize_embeddings=True, batch_size=64)
    sim = (embs @ embs.T)  # 코사인 유사도 행렬

    merged = 0
    already_merged: set = set()

    for i in range(len(names)):
        if names[i] in already_merged:
            continue
        for j in range(i + 1, len(names)):
            if names[j] in already_merged:
                continue
            if float(sim[i][j]) >= threshold:
                canonical, duplicate = names[i], names[j]
                try:
                    _merge_node_into(workspace_id, canonical, duplicate)
                    already_merged.add(duplicate)
                    merged += 1
                    print(f"🕸️ [GraphRAG] 병합: '{duplicate}' → '{canonical}' (유사도={sim[i][j]:.3f})")
                except Exception as e:
                    print(f"🕸️ [GraphRAG] 병합 실패 ({canonical}←{duplicate}): {e}")

    if merged:
        _invalidate_cache(workspace_id)

    return merged


def normalize_existing_predicates(workspace_id: str) -> int:
    """기존 저장된 관계 타입을 소급 정규화 — '사용한다'→'사용' 등. 변경된 엣지 수 반환.
    정규화 후 같은 (a, type, b) 쌍이 중복되면 MERGE로 자동 합산.
    """
    if not workspace_id:
        return 0

    with _get_driver().session() as session:
        result = session.run(
            """
            MATCH (a:Entity {workspace_id: $ws})-[r:RELATION]->(b:Entity {workspace_id: $ws})
            RETURN a.name AS a, r.type AS rtype, b.name AS b
            """,
            ws=workspace_id,
        )
        edges = result.data()

    updated = 0
    for edge in edges:
        norm = normalize_predicate(edge["rtype"])[:15]
        if norm == edge["rtype"] or not norm:
            continue
        with _get_driver().session() as session:
            # 1단계: 정규화된 타입의 엣지 생성(MERGE)
            session.run(
                """
                MATCH (a:Entity {name: $a, workspace_id: $ws})-[r:RELATION {type: $old, workspace_id: $ws}]->(b:Entity {name: $b, workspace_id: $ws})
                MERGE (a)-[:RELATION {type: $new, workspace_id: $ws}]->(b)
                """,
                a=edge["a"], b=edge["b"], old=edge["rtype"], new=norm, ws=workspace_id,
            )
            # 2단계: 원래 비정규화 엣지 삭제
            session.run(
                """
                MATCH (a:Entity {name: $a, workspace_id: $ws})-[r:RELATION {type: $old, workspace_id: $ws}]->(b:Entity {name: $b, workspace_id: $ws})
                DELETE r
                """,
                a=edge["a"], b=edge["b"], old=edge["rtype"], ws=workspace_id,
            )
        updated += 1

    if updated:
        _invalidate_cache(workspace_id)
        print(f"🕸️ [GraphRAG] 관계 정규화: {updated}개 엣지 정규화 완료 (workspace={workspace_id})")

    return updated


def merge_similar_predicates(workspace_id: str, model, threshold: float = 0.85) -> int:
    """임베딩 유사도 기반 중복 관계 타입 병합.
    '사용'·'사용함'·'활용'·'이용' 등 의미 유사 관계를 canonical(먼저 나온 것)로 통합.
    5분 스로틀 적용 (O(n²) 비용 절감).
    """
    if not workspace_id:
        return 0

    now = time.time()
    if now - _last_pred_merge.get(workspace_id, 0) < _MERGE_INTERVAL:
        return 0
    _last_pred_merge[workspace_id] = now

    with _get_driver().session() as session:
        result = session.run(
            "MATCH ()-[r:RELATION {workspace_id: $ws}]->() RETURN DISTINCT r.type AS rtype",
            ws=workspace_id,
        )
        rtypes = [row["rtype"] for row in result.data() if row["rtype"]]

    if len(rtypes) < 2:
        return 0

    import numpy as np
    embs = model.encode(rtypes, normalize_embeddings=True, batch_size=64)
    sim = (embs @ embs.T)

    merged = 0
    already_merged: set = set()

    for i in range(len(rtypes)):
        if rtypes[i] in already_merged:
            continue
        for j in range(i + 1, len(rtypes)):
            if rtypes[j] in already_merged:
                continue
            if float(sim[i][j]) >= threshold:
                canonical, duplicate = rtypes[i], rtypes[j]
                try:
                    with _get_driver().session() as session:
                        # 1단계: canonical 타입 엣지 생성
                        session.run(
                            """
                            MATCH (a:Entity {workspace_id: $ws})-[r:RELATION {type: $dup, workspace_id: $ws}]->(b:Entity {workspace_id: $ws})
                            MERGE (a)-[:RELATION {type: $can, workspace_id: $ws}]->(b)
                            """,
                            dup=duplicate, can=canonical, ws=workspace_id,
                        )
                        # 2단계: duplicate 타입 엣지 삭제
                        session.run(
                            """
                            MATCH ()-[r:RELATION {type: $dup, workspace_id: $ws}]->()
                            DELETE r
                            """,
                            dup=duplicate, ws=workspace_id,
                        )
                    already_merged.add(duplicate)
                    merged += 1
                    print(f"🕸️ [GraphRAG] 관계병합: '{duplicate}' → '{canonical}' (유사도={sim[i][j]:.3f})")
                except Exception as e:
                    print(f"🕸️ [GraphRAG] 관계병합 실패 ({canonical}←{duplicate}): {e}")

    if merged:
        _invalidate_cache(workspace_id)

    return merged


def get_triples_raw(workspace_id: str, limit: int = 60) -> list:
    """워크스페이스의 트리플을 딕셔너리 리스트로 반환 (시각화용)."""
    if not workspace_id:
        return []
    with _get_driver().session() as session:
        result = session.run(
            """
            MATCH (a:Entity {workspace_id: $ws})-[r:RELATION]->(b:Entity {workspace_id: $ws})
            RETURN a.name AS a, r.type AS rel, b.name AS b
            LIMIT $limit
            """,
            ws=workspace_id, limit=limit,
        )
        return result.data()


# ──────────────────────────────────────────────
# Semantic Memory (장기 지식 저장소) — Phase 2 Item 8
# ──────────────────────────────────────────────
_SEMANTIC_FACT_TYPES = {"user_preference", "domain_expertise", "recurring_topic", "key_decision"}
_SEMANTIC_CONSOLIDATE_INTERVAL = 300  # 동일 워크스페이스에서 5분에 1회만 통합
_last_consolidate: dict = {}


def save_semantic_fact(workspace_id: str, fact_type: str, content: str):
    """워크스페이스 장기 시맨틱 사실을 Neo4j SemanticFact 노드로 저장."""
    if not workspace_id or not content:
        return
    fact_type = fact_type if fact_type in _SEMANTIC_FACT_TYPES else "domain_expertise"
    with _get_driver().session() as session:
        session.run(
            """
            MERGE (f:SemanticFact {workspace_id: $ws, content: $content})
            SET f.fact_type = $ft, f.updated_at = $ts
            """,
            ws=workspace_id, content=content.strip()[:500], ft=fact_type, ts=time.time(),
        )
    _invalidate_cache(workspace_id)


def load_semantic_facts(workspace_id: str, limit: int = 10) -> str:
    """워크스페이스의 장기 시맨틱 사실을 텍스트로 반환."""
    if not workspace_id:
        return ""
    key = f"semfacts|{workspace_id}|{limit}"
    cached = _cache_get(key)
    if cached is not None:
        return cached
    with _get_driver().session() as session:
        result = session.run(
            """
            MATCH (f:SemanticFact {workspace_id: $ws})
            RETURN f.fact_type AS ft, f.content AS content
            ORDER BY f.updated_at DESC
            LIMIT $limit
            """,
            ws=workspace_id, limit=limit,
        )
        rows = result.data()
    if not rows:
        _cache_set(key, "")
        return ""
    lines = [f"[{row['ft']}] {row['content']}" for row in rows]
    text = "\n".join(lines)
    _cache_set(key, text)
    return text


def load_semantic_facts_for_query(workspace_id: str, query: str, model, limit: int = 8) -> str:
    """현재 쿼리와 임베딩 유사도 기준으로 관련도 높은 시맨틱 사실 반환.
    팩트가 limit 이하면 정렬 없이 전체 반환, 초과하면 상위 limit개만.
    """
    if not workspace_id or not query:
        return ""
    with _get_driver().session() as session:
        result = session.run(
            "MATCH (f:SemanticFact {workspace_id: $ws}) RETURN f.fact_type AS ft, f.content AS content",
            ws=workspace_id,
        )
        rows = result.data()
    if not rows:
        return ""
    if len(rows) <= limit:
        return "\n".join(f"[{row['ft']}] {row['content']}" for row in rows)
    # 임베딩 유사도로 상위 limit개 선택
    import numpy as np
    query_emb = model.encode(query, normalize_embeddings=True)
    contents = [row["content"] for row in rows]
    fact_embs = model.encode(contents, normalize_embeddings=True, batch_size=64)
    scores = np.array(fact_embs) @ np.array(query_emb)   # shape (N,)
    top_indices = np.argsort(scores)[::-1][:limit]
    print(f"🧠 [SemanticMemory] 관련도 필터: {len(rows)}개 → 상위 {limit}개 선택")
    return "\n".join(f"[{rows[i]['ft']}] {rows[i]['content']}" for i in top_indices)


def consolidate_to_semantic(workspace_id: str, episodic_text: str, llm) -> int:
    """에피소딕 메모리 패턴을 추출 → SemanticFact로 승격.
    5분 스로틀 적용 (반복 호출 비용 절감).
    """
    if not workspace_id or not episodic_text:
        return 0
    now = time.time()
    if now - _last_consolidate.get(workspace_id, 0) < _SEMANTIC_CONSOLIDATE_INTERVAL:
        return 0
    _last_consolidate[workspace_id] = now

    prompt = (
        "다음 대화 에피소드에서 이 워크스페이스에 대해 장기적으로 기억할 중요 사실을 최대 3개 추출하세요.\n"
        "각 사실은 다음 중 하나로 분류하세요:\n"
        "  user_preference(사용자 선호/습관), domain_expertise(전문 분야/기술스택),\n"
        "  recurring_topic(반복되는 주제), key_decision(핵심 결정/방향)\n\n"
        f"[대화 에피소드]:\n{episodic_text}\n\n"
        '결과를 JSON으로 출력하세요:\n'
        '{"facts": [{"fact_type": "user_preference", "content": "사실 내용"}]}'
    )

    try:
        import json as _json, re as _re
        raw = llm.invoke(prompt).content
        m = _re.search(r'\{.*\}', raw, _re.DOTALL)
        if not m:
            return 0
        data = _json.loads(m.group(0))
        facts = data.get("facts", [])
        count = 0
        for f in facts[:3]:
            ft = f.get("fact_type", "domain_expertise")
            content = f.get("content", "").strip()
            if content:
                save_semantic_fact(workspace_id, ft, content)
                count += 1
        if count:
            print(f"🧠 [SemanticMemory] {count}개 사실 시맨틱 메모리 통합 (ws={workspace_id[:8]}…)")
        return count
    except Exception as e:
        print(f"🧠 [SemanticMemory] 통합 실패: {e}")
        return 0


def query_graph_nl(question: str, workspace_id: str, llm) -> str:
    """자연어 질문 → Cypher 자동 생성 → Neo4j 실행 → 결과 반환 (LangChain GraphCypherQAChain)."""
    from langchain_neo4j import GraphCypherQAChain
    from langchain_core.prompts import PromptTemplate

    cypher_prompt = PromptTemplate(
        input_variables=["schema", "question"],
        template=(
            "당신은 Neo4j Cypher 전문가입니다.\n"
            "스키마: {schema}\n\n"
            f"중요: 모든 MATCH 절에 반드시 workspace_id = '{workspace_id}' 조건을 포함하세요.\n\n"
            "질문: {question}\n"
            "Cypher 쿼리:"
        ),
    )

    try:
        chain = GraphCypherQAChain.from_llm(
            llm=llm,
            graph=_get_lc_graph(),
            cypher_prompt=cypher_prompt,
            verbose=False,
            allow_dangerous_requests=True,
        )
        result = chain.invoke({"query": question})
        return result.get("result", "관련 정보를 찾지 못했습니다.")
    except Exception as e:
        # 실패 시 정적 탐색으로 폴백
        print(f"🕸️ [GraphRAG] GraphCypherQA 실패 → 정적 탐색 폴백: {e}")
        return load_context(workspace_id, limit=20)

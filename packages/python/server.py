import json
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from graphiti_core.nodes import EpisodeType
from graphiti_core.search.search_config_recipes import COMBINED_HYBRID_SEARCH_CROSS_ENCODER
from graphiti_core.search.search_filters import SearchFilters

from graphiti_client import close_graphiti, get_graphiti


logger = logging.getLogger("python-server")
logging.basicConfig(
  level=logging.INFO,
  format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logging.getLogger("neo4j.notifications").setLevel(logging.WARNING)


class EpisodeWriteRequest(BaseModel):
  """
  写入 episode 的最小入参。

  注意：
  - content 允许是 string 或任意 JSON object；服务端会统一序列化为字符串写入 Graphiti。
  - reference_time 用于 Graphiti 的 valid_at，决定时间相关性。
  """

  user_name: str = Field(min_length=1)
  type: str = Field(min_length=1)
  content: Any
  reference_time: datetime


class EpisodeWriteResponse(BaseModel):
  ok: bool


class MemorySearchRequest(BaseModel):
  """
  记忆检索入参。

  filters 为可选的 Graphiti SearchFilters 原始字典（首期不要求必须传）。
  """

  user_name: str = Field(min_length=1)
  query: str = Field(min_length=1)
  top_k: int = Field(default=5, ge=1, le=50)
  filters: dict[str, Any] | None = None


class MemorySearchItem(BaseModel):
  memory: str
  time: str | None = None
  source: str | None = None
  score: float | None = None


app = FastAPI(title="python-server")


@app.on_event("shutdown")
async def _shutdown() -> None:
  await close_graphiti()


@app.get("/healthz")
async def healthz() -> dict[str, str]:
  return {"status": "ok"}


def _stringify_episode_content(user_name: str, type_: str, reference_time: datetime, content: Any) -> str:
  """
  将 episode 内容统一转换为字符串写入 Graphiti。

  这里会把 user_name/type/reference_time 作为 meta 混入内容，确保在语义检索上具备“按用户隔离”的倾向。
  """

  meta = {
    "user_name": user_name,
    "type": type_,
    "reference_time": reference_time.astimezone(timezone.utc).isoformat(),
  }

  if isinstance(content, str):
    return (
      "[meta]\n"
      + json.dumps(meta, ensure_ascii=False)
      + "\n[/meta]\n"
      + content
    )

  return json.dumps({"meta": meta, "content": content}, ensure_ascii=False)


@app.post("/v1/episodes", response_model=EpisodeWriteResponse)
async def write_episode(payload: EpisodeWriteRequest) -> EpisodeWriteResponse:
  graphiti = await get_graphiti()

  reference_time = payload.reference_time
  if reference_time.tzinfo is None:
    reference_time = reference_time.replace(tzinfo=timezone.utc)

  episode_body = _stringify_episode_content(
    user_name=payload.user_name,
    type_=payload.type,
    reference_time=reference_time,
    content=payload.content,
  )
  name = f"{payload.user_name}-{payload.type}-{reference_time.isoformat()}"

  episode_type = EpisodeType.text if isinstance(payload.content, str) else EpisodeType.json

  await graphiti.add_episode(
    name=name,
    episode_body=episode_body,
    source_description=payload.type,
    reference_time=reference_time,
    source=episode_type,
  )
  return EpisodeWriteResponse(ok=True)


@app.post("/v1/search", response_model=list[MemorySearchItem])
async def search_memory(payload: MemorySearchRequest) -> list[MemorySearchItem]:
  graphiti = await get_graphiti()

  config = COMBINED_HYBRID_SEARCH_CROSS_ENCODER.model_copy(deep=True)
  config.limit = payload.top_k

  search_filter: SearchFilters | None = None
  if payload.filters:
    try:
      search_filter = SearchFilters.model_validate(payload.filters)
    except Exception as e:
      raise HTTPException(status_code=400, detail=f"Invalid filters: {e}") from e

  scoped_query = f"{payload.query}\n只检索 user_name={payload.user_name} 的相关事实"

  results = await graphiti.search_(
    query=scoped_query,
    config=config,
    search_filter=search_filter,
  )

  items: list[MemorySearchItem] = []
  for edge, score in zip(results.edges, results.edge_reranker_scores, strict=False):
    items.append(
      MemorySearchItem(
        memory=edge.fact,
        time=edge.created_at.astimezone(timezone.utc).isoformat() if edge.created_at else None,
        source=edge.name,
        score=score if score is not None else None,
      )
    )

  return items

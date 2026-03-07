import json
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from neo4j import AsyncSession

from graphiti_core.nodes import EpisodeType
from graphiti_core.search.search_config_recipes import (
    COMBINED_HYBRID_SEARCH_CROSS_ENCODER,
    COMBINED_HYBRID_SEARCH_RRF,
)
from graphiti_core.search.search_filters import SearchFilters

from graphiti_client import close_graphiti, get_graphiti

logger = logging.getLogger("python-server")

# ========================================
# 临时补丁：修复 Graphiti 字段兼容性问题
# 问题 1：LLM 返回的是 "entities"，但 Graphiti 期望的是 "extracted_entities"
# 问题 2：LLM 返回的是 "entity_text"，但 Graphiti 期望的是 "name"
# ========================================
import sys
from pydantic import Field, field_validator
from typing import Any

# 保存原始类并替换
_original_extracted_entities = None
_original_extracted_entity = None

def _apply_field_compatibility_patch():
    """修改 ExtractedEntities 和 ExtractedEntity 类，让它们兼容字段不匹配的问题"""
    global _original_extracted_entities, _original_extracted_entity
    if _original_extracted_entities is not None and _original_extracted_entity is not None:
        return

    try:
        from graphiti_core.prompts.extract_nodes import ExtractedEntities, ExtractedEntity
        _original_extracted_entities = ExtractedEntities
        _original_extracted_entity = ExtractedEntity

        # 首先修改 ExtractedEntity 类，让它兼容 entity_text 字段作为 name
        class CompatibleExtractedEntity(_original_extracted_entity):
            name: str = Field(..., description='Name of the extracted entity')
            entity_type_id: int = Field(default=0, description='ID of the classified entity type')

            @field_validator('name', mode='before')
            @classmethod
            def validate_name_compatibility(cls, v: Any, info: Any) -> Any:
                # 从 info.data 中获取所有可用数据
                data = info.data if hasattr(info, 'data') else {}
                # 如果 name 字段缺失，检查是否有 entity_text 字段
                if v is None or v == "":
                    if 'entity_text' in data:
                        logger.warning("Applied patch: using 'entity_text' as 'name'")
                        return data['entity_text']
                return v

            model_config = {
                'extra': 'allow'
            }

        # 然后修改 ExtractedEntities 类，让它同时兼容 'entities' 和 'extracted_entities'
        class CompatibleExtractedEntities(_original_extracted_entities):
            extracted_entities: list[CompatibleExtractedEntity] = Field(..., description='List of extracted entities')

            @field_validator('extracted_entities', mode='before')
            @classmethod
            def validate_entities_compatibility(cls, v: Any, info: Any) -> Any:
                # 如果是字典，检查是否有 'entities' 字段
                if isinstance(v, dict):
                    if 'entities' in v and 'extracted_entities' not in v:
                        logger.warning("Applied patch: using 'entities' as 'extracted_entities'")
                        return v['entities']
                    if 'extracted_entities' in v:
                        v = v['extracted_entities']
                # 如果是列表，检查每个元素是否需要字段转换
                if isinstance(v, list):
                    return [
                        {
                            'name': item.get('entity_text', item.get('name', '')),
                            'entity_type_id': item.get('entity_type_id', item.get('type', 0)),
                            **{k: val for k, val in item.items() if k not in ['entity_text']}
                        }
                        for item in v
                    ]
                return v

            model_config = {
                'extra': 'allow'
            }

        # 替换原始类
        import graphiti_core.prompts.extract_nodes as prompts_extract_nodes
        import graphiti_core.utils.maintenance.node_operations as node_operations

        sys.modules['graphiti_core.prompts.extract_nodes'].ExtractedEntity = CompatibleExtractedEntity
        sys.modules['graphiti_core.prompts.extract_nodes'].ExtractedEntities = CompatibleExtractedEntities
        sys.modules['graphiti_core.utils.maintenance.node_operations'].ExtractedEntity = CompatibleExtractedEntity
        sys.modules['graphiti_core.utils.maintenance.node_operations'].ExtractedEntities = CompatibleExtractedEntities

        prompts_extract_nodes.ExtractedEntity = CompatibleExtractedEntity
        prompts_extract_nodes.ExtractedEntities = CompatibleExtractedEntities
        node_operations.ExtractedEntity = CompatibleExtractedEntity
        node_operations.ExtractedEntities = CompatibleExtractedEntities

        logger.info("Applied Graphiti patch: ExtractedEntities and ExtractedEntity compatibility patch applied")

    except Exception as e:
        logger.warning(f"Failed to apply ExtractedEntities/ExtractedEntity patch: {e}")
        import traceback
        logger.warning(traceback.format_exc())

# 应用补丁
_apply_field_compatibility_patch()
# ========================================

logging.basicConfig(
  level=logging.INFO,
  format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logging.getLogger("neo4j.notifications").setLevel(logging.WARNING)

SUBJECT_NAME = "ゆいじゅ"


class EpisodeWriteRequest(BaseModel):
  """
  写入 episode 的最小入参。

  注意：
  - content 允许是 string 或任意 JSON object；服务端会统一序列化为字符串写入 Graphiti。
  - reference_time 用于 Graphiti 的 valid_at，决定时间相关性。
  - is_dev 用于区分测试与线上环境，服务端会映射为 Graphiti 的 group_id（namespace）。
  - counterparty_name 为“对话对方/关联对象”，用于帮助检索到与某人相关的记忆。
  """

  type: str = Field(min_length=1)
  counterparty_name: str | None = Field(default=None)
  content: Any
  reference_time: datetime
  is_dev: bool = Field(default=False)


class EpisodeWriteResponse(BaseModel):
  ok: bool


class MemorySearchRequest(BaseModel):
  """
  记忆检索入参。

  filters 为可选的 Graphiti SearchFilters 原始字典（首期不要求必须传）。
  """

  query: str = Field(min_length=1)
  counterparty_name: str | None = Field(default=None)
  is_dev: bool = Field(default=False)
  top_k: int = Field(default=5, ge=1, le=50)
  filters: dict[str, Any] | None = None


class MemorySearchItem(BaseModel):
  memory: str
  time: str | None = None
  source: str | None = None
  # Cross Encoder 分数范围 (0-1]，分数越高表示语义相似度越高
  score: float | None = None


class ClearDevResponse(BaseModel):
  deleted_count: int


app = FastAPI(title="python-server")


@app.on_event("shutdown")
async def _shutdown() -> None:
  await close_graphiti()


@app.get("/healthz")
async def healthz() -> dict[str, str]:
  return {"status": "ok"}


def _namespace_group_id(is_dev: bool) -> str:
  return "dev" if is_dev else "prod"


def _stringify_episode_content(
  type_: str,
  content: Any,
  counterparty_name: str | None,
) -> str:
  """
  将 episode 内容统一转换为字符串写入 Graphiti。

  这里会把主体与关键元信息混入内容，帮助语义检索时更稳地命中：
  - subject_name 固定为「ゆいじゅ」
  - counterparty_name 为“对话对方/关联对象”（可选）
  - type/reference_time
  """

  meta = {
    "subject_name": SUBJECT_NAME,
    "type": type_,
    "fact_language_hint": "尽量使用中文表述 fact",
  }
  if counterparty_name:
    meta["counterparty_name"] = counterparty_name

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
    type_=payload.type,
    content=payload.content,
    counterparty_name=payload.counterparty_name,
  )
  name_parts = [SUBJECT_NAME, payload.type]
  if payload.counterparty_name:
    name_parts.append(payload.counterparty_name)
  name_parts.append(reference_time.isoformat())
  name = "-".join(name_parts)

  episode_type = EpisodeType.text if isinstance(payload.content, str) else EpisodeType.json

  await graphiti.add_episode(
    name=name,
    episode_body=episode_body,
    source_description=payload.type,
    reference_time=reference_time,
    source=episode_type,
    group_id=_namespace_group_id(payload.is_dev),
  )
  return EpisodeWriteResponse(ok=True)


@app.post("/v1/search", response_model=list[MemorySearchItem])
async def search_memory(payload: MemorySearchRequest) -> list[MemorySearchItem]:
  graphiti = await get_graphiti()

  # 优化搜索配置，使用 Cross Encoder 进行深度语义精排
  # Cross Encoder 能够更准确地计算查询与结果之间的语义相似度
  config = COMBINED_HYBRID_SEARCH_CROSS_ENCODER.model_copy(deep=True)
  config.limit = payload.top_k

  # 召回阶段：降低相似度阈值，确保召回更多相关候选结果
  config.edge_config.sim_min_score = 0.6
  config.node_config.sim_min_score = 0.6
  config.episode_config.sim_min_score = 0.6
  config.community_config.sim_min_score = 0.6

  # 精排阶段：提高重排最小分数，保证返回结果的高质量
  config.reranker_min_score = 0.8

  search_filter: SearchFilters | None = None
  if payload.filters:
    try:
      search_filter = SearchFilters.model_validate(payload.filters)
    except Exception as e:
      raise HTTPException(status_code=400, detail=f"Invalid filters: {e}") from e

  results = await graphiti.search_(
    query=payload.query,
    config=config,
    search_filter=search_filter,
    group_ids=[_namespace_group_id(payload.is_dev)],
  )

  # 结构化打印搜索结果，输出所有字段
  # 获取 results 对象的所有属性
  results_dict = {}
  for key in dir(results):
      if not key.startswith("_"):  # 跳过私有属性
          value = getattr(results, key)
          if not callable(value):  # 跳过方法
              results_dict[key] = value

  # 对 edges 做特殊处理，提取可读信息
  if "edges" in results_dict:
      results_dict["edges"] = [
          {
              k: (v.isoformat() if hasattr(v, "isoformat") else v)
              for k, v in edge.__dict__.items()
              if not k.startswith("_")
          }
          for edge in results_dict["edges"]
      ]

  logger.info(
      "Search results (all fields): \n%s",
      json.dumps(results_dict, ensure_ascii=False, indent=2, default=str)
  )

  items: list[MemorySearchItem] = []
  for idx, edge in enumerate(results.edges):
    score = results.edge_reranker_scores[idx] if idx < len(results.edge_reranker_scores) else None
    items.append(
      MemorySearchItem(
        memory=edge.fact,
        time=edge.created_at.astimezone(timezone.utc).isoformat() if edge.created_at else None,
        source=edge.name,
        score=score if score is not None else None,
      )
    )

  # 进一步过滤结果，只保留语义相似度高的记忆
  # Cross Encoder 分数范围 0-1，分数越高表示语义相似度越高
  filtered_items = [item for item in items if (item.score or 0) > 0.85]

  # 如果过滤后没有结果，返回空列表（避免返回不相关的结果）
  return filtered_items


@app.delete("/v1/admin/clear-dev", response_model=ClearDevResponse)
async def clear_dev_data() -> ClearDevResponse:
    """
    清理 dev 环境（group_id = "dev"）的所有数据。

    警告：此操作不可逆！
    """
    graphiti = await get_graphiti()

    # 使用 Graphiti 的 driver 直接执行 Cypher 查询
    # 删除所有 group_id 为 "dev" 的节点和关系
    query = """
    MATCH (n {group_id: $group_id})
    DETACH DELETE n
    RETURN count(n) AS deleted_count
    """

    async with graphiti.driver.session() as session:  # type: AsyncSession
        result = await session.run(query, group_id="dev")
        record = await result.single()
        deleted_count = record["deleted_count"] if record else 0

    return ClearDevResponse(deleted_count=deleted_count)

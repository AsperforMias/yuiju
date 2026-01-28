import asyncio
import os
from dataclasses import dataclass
from typing import Optional

from graphiti_core import Graphiti
from graphiti_core.cross_encoder.openai_reranker_client import OpenAIRerankerClient
from graphiti_core.embedder.openai import OpenAIEmbedder, OpenAIEmbedderConfig
from graphiti_core.llm_client.config import LLMConfig
from graphiti_core.llm_client.openai_generic_client import OpenAIGenericClient


@dataclass(frozen=True)
class GraphitiEnv:
  """
  Graphiti 初始化配置（全部来自环境变量）。

  说明：
  - 本项目使用 OpenAI-compatible 协议的 LLM/Embedding（例如 SiliconFlow）。
  - 不在代码里写任何 key/密码，避免泄露。
  """

  neo4j_uri: str
  neo4j_user: str
  neo4j_password: str

  llm_api_key: str
  llm_base_url: str
  llm_model: str
  llm_small_model: str

  embedding_api_key: str
  embedding_base_url: str
  embedding_model: str

  reranker_api_key: str
  reranker_base_url: str
  reranker_model: str


def _require_env(name: str) -> str:
  value = os.getenv(name)
  if not value:
    raise ValueError(f"Environment variable {name} is required")
  return value


def load_graphiti_env() -> GraphitiEnv:
  """
  从环境变量读取 Graphiti 初始化配置。

  约定的环境变量：
  - NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD
  - MEMORY_LLM_API_KEY / MEMORY_LLM_BASE_URL / MEMORY_LLM_MODEL / MEMORY_LLM_SMALL_MODEL
  - MEMORY_EMBEDDING_API_KEY / MEMORY_EMBEDDING_BASE_URL / MEMORY_EMBEDDING_MODEL
  - MEMORY_RERANKER_API_KEY / MEMORY_RERANKER_BASE_URL / MEMORY_RERANKER_MODEL

  为了降低配置成本：Embedding/Reranker 的 key/base_url 默认复用 LLM 的配置。
  """

  neo4j_uri = _require_env("NEO4J_URI")
  neo4j_user = _require_env("NEO4J_USER")
  neo4j_password = _require_env("NEO4J_PASSWORD")

  llm_api_key = _require_env("MEMORY_LLM_API_KEY")
  llm_base_url = _require_env("MEMORY_LLM_BASE_URL")
  llm_model = _require_env("MEMORY_LLM_MODEL")
  llm_small_model = os.getenv("MEMORY_LLM_SMALL_MODEL") or llm_model

  embedding_api_key = os.getenv("MEMORY_EMBEDDING_API_KEY") or llm_api_key
  embedding_base_url = os.getenv("MEMORY_EMBEDDING_BASE_URL") or llm_base_url
  embedding_model = _require_env("MEMORY_EMBEDDING_MODEL")

  reranker_api_key = os.getenv("MEMORY_RERANKER_API_KEY") or llm_api_key
  reranker_base_url = os.getenv("MEMORY_RERANKER_BASE_URL") or llm_base_url
  reranker_model = os.getenv("MEMORY_RERANKER_MODEL") or llm_small_model

  return GraphitiEnv(
    neo4j_uri=neo4j_uri,
    neo4j_user=neo4j_user,
    neo4j_password=neo4j_password,
    llm_api_key=llm_api_key,
    llm_base_url=llm_base_url,
    llm_model=llm_model,
    llm_small_model=llm_small_model,
    embedding_api_key=embedding_api_key,
    embedding_base_url=embedding_base_url,
    embedding_model=embedding_model,
    reranker_api_key=reranker_api_key,
    reranker_base_url=reranker_base_url,
    reranker_model=reranker_model,
  )


_graphiti_lock = asyncio.Lock()
_graphiti: Optional[Graphiti] = None


async def get_graphiti() -> Graphiti:
  """
  获取全局 Graphiti 单例。

  FastAPI 会在每次请求中调用该函数，因此必须复用同一个实例，避免重复建连与重复建索引。
  """

  global _graphiti
  if _graphiti is not None:
    return _graphiti

  async with _graphiti_lock:
    if _graphiti is not None:
      return _graphiti

    env = load_graphiti_env()

    llm_config = LLMConfig(
      api_key=env.llm_api_key,
      model=env.llm_model,
      small_model=env.llm_small_model,
      base_url=env.llm_base_url,
    )

    embedder_config = OpenAIEmbedderConfig(
      api_key=env.embedding_api_key,
      embedding_model=env.embedding_model,
      base_url=env.embedding_base_url,
    )

    reranker_config = LLMConfig(
      api_key=env.reranker_api_key,
      model=env.reranker_model,
      base_url=env.reranker_base_url,
    )

    _graphiti = Graphiti(
      env.neo4j_uri,
      env.neo4j_user,
      env.neo4j_password,
      llm_client=OpenAIGenericClient(config=llm_config),
      embedder=OpenAIEmbedder(config=embedder_config),
      cross_encoder=OpenAIRerankerClient(config=reranker_config),
    )
    return _graphiti


async def close_graphiti() -> None:
  """
  关闭 Graphiti 全局单例连接（FastAPI shutdown 时调用）。
  """

  global _graphiti
  if _graphiti is None:
    return

  await _graphiti.close()
  _graphiti = None

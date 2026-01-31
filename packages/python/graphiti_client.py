import asyncio
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from graphiti_core import Graphiti
from graphiti_core.cross_encoder.openai_reranker_client import OpenAIRerankerClient
from graphiti_core.embedder.openai import OpenAIEmbedder, OpenAIEmbedderConfig
from graphiti_core.llm_client.config import LLMConfig
from graphiti_core.llm_client.openai_generic_client import OpenAIGenericClient


_dotenv_loaded = False


def _load_root_dotenv() -> None:
  global _dotenv_loaded
  if _dotenv_loaded:
    return
  _dotenv_loaded = True

  try:
    from dotenv import load_dotenv
  except Exception:
    return

  repo_root = Path(__file__).resolve().parents[2]
  dotenv_path = repo_root / ".env"
  if not dotenv_path.exists():
    return

  load_dotenv(dotenv_path=dotenv_path, override=False)


@dataclass(frozen=True)
class GraphitiEnv:
  """
  Graphiti 初始化配置。

  说明：
  - 本项目使用 OpenAI-compatible 协议的 LLM/Embedding（例如 SiliconFlow）。
  - 处于早期开发阶段：Neo4j 与模型相关配置固定写在代码中，减少配置项。
  - 仅敏感信息（如 key/密码）从环境变量读取，避免泄露。
  """

  neo4j_uri: str
  neo4j_user: str
  neo4j_password: str

  llm_api_key: str
  llm_base_url: str
  llm_model: str
  llm_small_model: str
  embedding_model: str
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
  - SILICONFLOW_API_KEY
  """

  _load_root_dotenv()

  default_neo4j_uri = "bolt://192.168.31.10:7687"
  default_neo4j_user = "neo4j"
  default_neo4j_password = "neo4j123456"
  default_llm_base_url = "https://api.siliconflow.cn/v1"
  default_llm_model = "Pro/deepseek-ai/DeepSeek-V3.2"
  default_llm_small_model = "Qwen/Qwen3-8B"
  default_embedding_model = "Qwen/Qwen3-Embedding-0.6B"
  default_reranker_model = "Qwen/Qwen3-8B"

  llm_api_key = _require_env("SILICONFLOW_API_KEY")

  return GraphitiEnv(
    neo4j_uri=default_neo4j_uri,
    neo4j_user=default_neo4j_user,
    neo4j_password=default_neo4j_password,
    llm_api_key=llm_api_key,
    llm_base_url=default_llm_base_url,
    llm_model=default_llm_model,
    llm_small_model=default_llm_small_model,
    embedding_model=default_embedding_model,
    reranker_model=default_reranker_model,
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
      api_key=env.llm_api_key,
      embedding_model=env.embedding_model,
      base_url=env.llm_base_url,
    )

    reranker_config = LLMConfig(
      api_key=env.llm_api_key,
      model=env.reranker_model,
      base_url=env.llm_base_url,
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

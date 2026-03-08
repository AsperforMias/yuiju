import asyncio
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import httpx
from graphiti_core import Graphiti
from graphiti_core.cross_encoder.client import CrossEncoderClient
from graphiti_core.embedder.openai import OpenAIEmbedder, OpenAIEmbedderConfig
from graphiti_core.llm_client.config import LLMConfig
from graphiti_core.llm_client.openai_generic_client import OpenAIGenericClient
from graphiti_core.llm_client import RateLimitError


class SiliconFlowRerankerClient(CrossEncoderClient):
    """
    硅基流动专业 Rerank API 客户端

    使用 Qwen/Qwen3-Reranker-8B 模型的专业重排服务，该模型专门用于语义相关性排序。

    特点：
    - 使用专业的 Rerank API 端点
    - 模型：Qwen/Qwen3-Reranker-8B，专门为检索重排优化
    - API 端点：/v1/rerank
    - 返回 0-1 范围的相关性分数
    - 比通用 LLM 重排更准确
    """

    def __init__(
        self,
        config: LLMConfig | None = None,
    ):
        """
        初始化硅基流动 Rerank 客户端

        Args:
            config (LLMConfig | None): LLM 配置，需要包含 API 密钥和基础 URL
        """
        if config is None:
            config = LLMConfig()

        self.config = config
        # 构建 rerank API 端点
        base_url = self.config.base_url.rstrip("/")
        self.rerank_url = f"{base_url}/rerank"
        self.default_model = "Qwen/Qwen3-Reranker-8B"

    async def rank(self, query: str, passages: list[str]) -> list[tuple[str, float]]:
        """
        使用硅基流动 Rerank API 对段落进行排序

        Args:
            query (str): 查询内容
            passages (list[str]): 待排序的段落列表

        Returns:
            list[tuple[str, float]]: 排序后的段落和分数（0-1 范围）
        """
        if not passages:
            return []

        if len(passages) <= 1:
            return [(passage, 1.0) for passage in passages]

        # 每次调用 rank 时创建新的 client
        client = httpx.AsyncClient(
            headers={
                "Authorization": f"Bearer {self.config.api_key}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

        try:
            # 构建请求体
            payload = {
                "model": self.config.model or self.default_model,
                "query": query,
                "documents": passages,
                "top_n": len(passages),
            }

            # 发送请求
            response = await client.post(self.rerank_url, json=payload)

            if response.status_code == 429:
                raise RateLimitError("Rate limit exceeded for rerank API")
            if response.status_code != 200:
                raise Exception(f"Rerank API failed with status {response.status_code}: {response.text}")

            # 解析响应
            data = response.json()

            if "results" not in data:
                raise Exception("Invalid rerank API response structure")

            # 提取分数并配对
            ranked_results = []
            for result in data["results"]:
                passage = passages[result["index"]]
                score = result["relevance_score"]
                ranked_results.append((passage, score))

            # 按分数降序排序
            ranked_results.sort(reverse=True, key=lambda x: x[1])
            return ranked_results

        except Exception as e:
            # 捕获所有异常并记录日志
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"SiliconFlow rerank API failed: {str(e)}")
            logger.warning("Falling back to simple rank (all passages score 1.0)")
            # 降级到简单排序
            return [(passage, 1.0) for passage in passages]
        finally:
            # 关闭客户端
            await client.aclose()


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
  default_llm_model = "Pro/MiniMaxAI/MiniMax-M2.5"
  default_llm_small_model = "Qwen/Qwen3-8B"
  default_embedding_model = "Qwen/Qwen3-Embedding-0.6B"
  default_reranker_model = "Qwen/Qwen3-Reranker-8B"

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
      cross_encoder=SiliconFlowRerankerClient(config=reranker_config),
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

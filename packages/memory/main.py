
import asyncio
from datetime import datetime, timezone

from graphiti_core.nodes import EpisodeType

from graphiti_client import close_graphiti, get_graphiti


async def main():
  """
  本文件仅用于本地快速验证 Graphiti 是否连通。

  重要：
  - 不在代码里写任何 key/密码，所有配置都从环境变量读取；
  - 生产对外 API 请使用 server.py（FastAPI）。
  """

  graphiti = await get_graphiti()
  try:
    now = datetime.now(timezone.utc)

    await graphiti.add_episode(
      name=f"smoke-test-{now.isoformat()}",
      episode_body="这是一条 smoke test 记忆，用于验证 Graphiti 写入与检索是否正常。",
      source_description="smoke_test",
      reference_time=now,
      source=EpisodeType.text,
    )

    results = await graphiti.search("smoke test 记忆是什么？", num_results=5)
    for r in results:
      print(r.fact)
  finally:
    await close_graphiti()


if __name__ == "__main__":
  asyncio.run(main())

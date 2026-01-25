
import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from logging import INFO

from graphiti_core import Graphiti
from graphiti_core.nodes import EpisodeType
from graphiti_core.search.search_config_recipes import NODE_HYBRID_SEARCH_RRF
from graphiti_core.llm_client.openai_generic_client import OpenAIGenericClient
from graphiti_core.llm_client.config import LLMConfig
from graphiti_core.embedder.openai import OpenAIEmbedder, OpenAIEmbedderConfig
from graphiti_core.cross_encoder.openai_reranker_client import OpenAIRerankerClient

#################################################
# CONFIGURATION
#################################################
# Set up logging and environment variables for
# connecting to Neo4j database
#################################################

# Configure logging
logging.basicConfig(
    level=INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
logger = logging.getLogger(__name__)
logging.getLogger("neo4j.notifications").setLevel(logging.WARNING)

# Configure OpenAI-compatible service
llm_config = LLMConfig(
    api_key="sk-qthclrzibhtkkrgdcoovoxbqqiiwtfqgihegcdvgmovbuatg",
    model="Qwen/Qwen3-8B",        # e.g., "mistral-large-latest"
    small_model="Qwen/Qwen3-8B", # e.g., "mistral-small-latest"
    base_url="https://api.siliconflow.cn/v1",       # e.g., "https://api.mistral.ai/v1"
)

# Neo4j connection parameters
# Make sure Neo4j Desktop is running with a local DBMS started
neo4j_uri = 'bolt://192.168.31.10:7687'
neo4j_user = 'neo4j'
neo4j_password = 'neo4j123456'

if not neo4j_uri or not neo4j_user or not neo4j_password:
    raise ValueError('NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD must be set')


async def main():
    #################################################
    # INITIALIZATION
    #################################################
    # Connect to Neo4j and set up Graphiti indices
    # This is required before using other Graphiti
    # functionality
    #################################################

    # Initialize Graphiti with Neo4j connection
    graphiti = Graphiti(
        "bolt://192.168.31.10:7687",
        "neo4j",
        "neo4j123456",
        llm_client=OpenAIGenericClient(config=llm_config),
        embedder=OpenAIEmbedder(
            config=OpenAIEmbedderConfig(
                api_key="sk-qthclrzibhtkkrgdcoovoxbqqiiwtfqgihegcdvgmovbuatg",
                embedding_model="Qwen/Qwen3-Embedding-4B", # e.g., "mistral-embed"
                base_url="https://api.siliconflow.cn/v1",
            )
        ),
        cross_encoder=OpenAIRerankerClient(
            config=LLMConfig(
                api_key="sk-qthclrzibhtkkrgdcoovoxbqqiiwtfqgihegcdvgmovbuatg",
                model="Qwen/Qwen3-8B",  # Use smaller model for reranking
                base_url="https://api.siliconflow.cn/v1",
            )
        )
    )

    try:
        #################################################
        # ADDING EPISODES
        #################################################
        # Episodes are the primary units of information
        # in Graphiti. They can be text or structured JSON
        # and are automatically processed to extract entities
        # and relationships.
        #################################################

        # Example: Add Episodes
        # Episodes list containing both text and JSON episodes
        episodes = [
            {
                'content': '卡玛拉·哈里斯曾任加利福尼亚州总检察长。她此前是旧金山的地方检察官。',
                'type': EpisodeType.text,
                'description': '播客转写',
            },
            {
                'content': '作为总检察长，她的任期为 2011 年 1 月 3 日至 2017 年 1 月 3 日。',
                'type': EpisodeType.text,
                'description': '播客转写',
            },
            {
                'content': {
                    'name': '加文·纽森',
                    'position': '州长',
                    'state': '加利福尼亚州',
                    'previous_role': '副州长',
                    'previous_location': '旧金山',
                },
                'type': EpisodeType.json,
                'description': '播客元数据',
            },
            {
                'content': {
                    'name': '加文·纽森',
                    'position': '州长',
                    'term_start': '2019 年 1 月 7 日',
                    'term_end': '至今',
                },
                'type': EpisodeType.json,
                'description': '播客元数据',
            },
        ]

        # Add episodes to the graph
        # for i, episode in enumerate(episodes):
        #     await graphiti.add_episode(
        #         name=f'Freakonomics Radio {i}',
        #         episode_body=episode['content']
        #         if isinstance(episode['content'], str)
        #         else json.dumps(episode['content']),
        #         source=episode['type'],
        #         source_description=episode['description'],
        #         reference_time=datetime.now(timezone.utc),
        #     )
        #     print(f'已添加片段：Freakonomics Radio {i}（{episode["type"].value}）')

        #################################################
        # BASIC SEARCH
        #################################################
        # The simplest way to retrieve relationships (edges)
        # from Graphiti is using the search method, which
        # performs a hybrid search combining semantic
        # similarity and BM25 text retrieval.
        #################################################

        # Perform a hybrid search combining semantic similarity and BM25 retrieval
        query = '加利福尼亚州的总检察长是谁？'
        print(f"\n正在搜索：{query}")
        results = await graphiti.search(query)

        # Print search results
        print('\n搜索结果：')
        for result in results:
            print(f'UUID：{result.uuid}')
            print(f'事实：{result.fact}')
            if hasattr(result, 'valid_at') and result.valid_at:
                print(f'生效时间：{result.valid_at}')
            if hasattr(result, 'invalid_at') and result.invalid_at:
                print(f'失效时间：{result.invalid_at}')
            print('---')

        #################################################
        # CENTER NODE SEARCH
        #################################################
        # For more contextually relevant results, you can
        # use a center node to rerank search results based
        # on their graph distance to a specific node
        #################################################

        # Use the top search result's UUID as the center node for reranking
        if results and len(results) > 0:
            # Get the source node UUID from the top result
            center_node_uuid = results[0].source_node_uuid

            print('\n基于图距离对搜索结果重新排序：')
            print(f'使用中心节点 UUID：{center_node_uuid}')

            reranked_results = await graphiti.search(
                query, center_node_uuid=center_node_uuid
            )

            # Print reranked search results
            print('\n重新排序后的结果：')
            for result in reranked_results:
                print(f'UUID：{result.uuid}')
                print(f'事实：{result.fact}')
                if hasattr(result, 'valid_at') and result.valid_at:
                    print(f'生效时间：{result.valid_at}')
                if hasattr(result, 'invalid_at') and result.invalid_at:
                    print(f'失效时间：{result.invalid_at}')
                print('---')
        else:
            print('初次搜索没有结果，无法选择中心节点进行重新排序。')

        #################################################
        # NODE SEARCH USING SEARCH RECIPES
        #################################################
        # Graphiti provides predefined search recipes
        # optimized for different search scenarios.
        # Here we use NODE_HYBRID_SEARCH_RRF for retrieving
        # nodes directly instead of edges.
        #################################################

        # Example: Perform a node search using _search method with standard recipes
        print('\n使用标准配置（NODE_HYBRID_SEARCH_RRF）进行节点搜索：')

        # Use a predefined search configuration recipe and modify its limit
        node_search_config = NODE_HYBRID_SEARCH_RRF.model_copy(deep=True)
        node_search_config.limit = 5  # Limit to 5 results

        # Execute the node search
        node_search_results = await graphiti._search(
            query='加利福尼亚州州长',
            config=node_search_config,
        )

        # Print node search results
        print('\n节点搜索结果：')
        for node in node_search_results.nodes:
            print(f'节点 UUID：{node.uuid}')
            print(f'节点名称：{node.name}')
            node_summary = node.summary[:100] + '...' if len(node.summary) > 100 else node.summary
            print(f'内容摘要：{node_summary}')
            print(f'节点标签：{", ".join(node.labels)}')
            print(f'创建时间：{node.created_at}')
            if hasattr(node, 'attributes') and node.attributes:
                print('属性：')
                for key, value in node.attributes.items():
                    print(f'  {key}：{value}')
            print('---')

    finally:
        #################################################
        # CLEANUP
        #################################################
        # Always close the connection to Neo4j when
        # finished to properly release resources
        #################################################

        # Close the connection
        await graphiti.close()
        print('\n连接已关闭')


if __name__ == '__main__':
    asyncio.run(main())

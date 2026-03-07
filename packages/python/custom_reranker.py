"""
自定义 Cross Encoder 实现，适配 OpenAI-compatible API（如 SiliconFlow）

参考 GeminiRerankerClient 的思路，但使用 OpenAI API 调用方式
避免使用 top_logprobs 参数，直接让 LLM 返回 0-100 的分数
"""

import logging
import re
from typing import Any

import openai
from graphiti_core.cross_encoder.client import CrossEncoderClient
from graphiti_core.helpers import semaphore_gather
from graphiti_core.llm_client import LLMConfig, RateLimitError

logger = logging.getLogger(__name__)

DEFAULT_MODEL = 'Qwen/Qwen3-8B'


class CustomRerankerClient(CrossEncoderClient):
    """
    OpenAI-compatible API 的自定义 Reranker 客户端

    特点：
    - 不使用 logprobs/top_logprobs，避免兼容性问题
    - 直接让 LLM 返回 0-100 的分数，然后归一化为 0-1
    - 支持所有 OpenAI 兼容 API（如 SiliconFlow）
    - 语义相关性判断更准确
    """

    def __init__(
        self,
        config: LLMConfig | None = None,
        client: openai.AsyncOpenAI | openai.OpenAI | None = None,
    ):
        """
        初始化 Reranker 客户端

        Args:
            config (LLMConfig | None): LLM 配置
            client (AsyncOpenAI | OpenAI | None): 可选的客户端实例
        """
        if config is None:
            config = LLMConfig()

        self.config = config
        if client is None:
            self.client = openai.AsyncOpenAI(
                api_key=config.api_key,
                base_url=config.base_url
            )
        else:
            self.client = client

    async def rank(self, query: str, passages: list[str]) -> list[tuple[str, float]]:
        """
        对段落进行排序，根据与查询的相关性

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

        # 为每个段落生成评分提示
        scoring_prompts = []
        for passage in passages:
            prompt = [
                {
                    'role': 'system',
                    'content': (
                        'You are an expert at rating passage relevance. '
                        'Respond with only a number from 0 to 100 indicating relevance. '
                        '0 means completely irrelevant, 100 means highly relevant.'
                    )
                },
                {
                    'role': 'user',
                    'content': f"""
Query: {query}

Passage: {passage}

Rate how relevant this passage is to the query.
Provide only a number between 0 and 100 (no explanation, just the number):
""".strip()
                }
            ]
            scoring_prompts.append(prompt)

        try:
            # 并发执行所有评分请求
            responses = await semaphore_gather(
                *[
                    self.client.chat.completions.create(
                        model=self.config.model or DEFAULT_MODEL,
                        messages=prompt_messages,
                        temperature=0.0,
                        max_tokens=3,
                    )
                    for prompt_messages in scoring_prompts
                ]
            )

            # 提取分数
            results = []
            for passage, response in zip(passages, responses, strict=True):
                try:
                    if hasattr(response, 'choices') and response.choices:
                        content = response.choices[0].message.content.strip()

                        # 从响应中提取数值分数
                        score_match = re.search(r'\b(\d{1,3})\b', content)
                        if score_match:
                            score = float(score_match.group(1))
                            # 归一化为 0-1 范围
                            normalized_score = max(0.0, min(1.0, score / 100.0))
                            results.append((passage, normalized_score))
                        else:
                            logger.warning(
                                f'Could not extract numeric score from response: {content}'
                            )
                            results.append((passage, 0.0))
                    else:
                        logger.warning('Empty response from LLM for passage scoring')
                        results.append((passage, 0.0))
                except (ValueError, AttributeError, IndexError) as e:
                    logger.warning(f'Error parsing score from response: {e}')
                    results.append((passage, 0.0))

            # 按分数降序排序
            results.sort(reverse=True, key=lambda x: x[1])
            return results

        except openai.RateLimitError as e:
            raise RateLimitError from e
        except Exception as e:
            logger.error(f'Error in generating LLM response: {e}')
            raise

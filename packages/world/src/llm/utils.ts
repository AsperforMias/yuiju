import { logger } from '@/utils/logger';
import { createOpenAI } from '@ai-sdk/openai';

// 创建 SiliconFlow 客户端
export const siliconflow = createOpenAI({
  baseURL: 'https://api.siliconflow.cn/v1',
  apiKey: process.env.SILICONFLOW_API_KEY ?? '',
  name: 'Siliconflow',
  fetch: async (url, options) => {
    const body = options?.body ? JSON.parse(options.body.toString()) : {};
    body.enable_reasoning = true;
    options!.body = JSON.stringify(body);
    const response = await fetch(url, options);
    const llmRes = await response.clone().json();
    logger.info('[LLM SiliconFlow Response]', llmRes.choices[0]);
    return response;
  },
});

// export const model_glm_9B = siliconflow.chat('THUDM/GLM-Z1-9B-0414');
export const model_qwen3_8B = siliconflow.chat('Qwen/Qwen3-8B');

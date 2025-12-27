import 'dotenv/config';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

const siliconflow = createOpenAI({
  baseURL: 'https://api.siliconflow.cn/v1',
  apiKey: process.env.SILICONFLOW_API_KEY ?? '',
  name: 'Siliconflow',
});

const qwenModel = siliconflow.chat('Qwen/Qwen3-8B');

async function example1_basicChat() {
  try {
    const result = await generateText({
      model: qwenModel,
      prompt: '介绍你自己',
      providerOptions: {
        Siliconflow: {
          enable_thinking: false,
        },
      },
    });

    console.log('AI 回复:', result.text);
    console.log('推理过程:', result.reasoning);
  } catch (error) {
    console.error('调用失败:', error);
  }
}

example1_basicChat();

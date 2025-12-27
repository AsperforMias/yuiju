import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { ActionContext, ActionId, ActionMetadata } from '@/types/action';
import { chooseActionPrompt } from '@yuiju/source';
import dayjs from 'dayjs';

// 创建 SiliconFlow 客户端
const siliconflow = createOpenAI({
  baseURL: 'https://api.siliconflow.cn/v1',
  apiKey: process.env.SILICONFLOW_API_KEY ?? '',
  name: 'Siliconflow',
});

export async function chooseAction(
  actionList: ActionMetadata[],
  context: ActionContext,
  actionMemoryList: {
    action: ActionId;
    reason: string;
    timestamp: number;
  }[]
) {
  const systemPrompt = chooseActionPrompt({
    actionList,
    currentAction: context.charactorState.action,
    money: context.charactorState.money,
    stamina: context.charactorState.stamina,
    worldTime: context.worldState.time,
    recentActionList: actionMemoryList.map(item => ({
      action: item.action,
      reason: item.reason,
      time: dayjs(item.timestamp),
    })),
    location: `${context.charactorState.location.major}${
      context.charactorState.location.minor ? '-' + context.charactorState.location.minor : ''
    }`,
  });

  for (let i = 0; i < 3; i++) {
    try {
      const { output } = await generateText({
        model: siliconflow.chat('Qwen/Qwen3-8B'),
        output: Output.object({
                  schema: z.object({
          action: z.enum(actionList?.map(item => item.action)).describe('选择的 action'),
          reason: z.string().describe('选择action的原因'),
          durationMinute: z.number().optional().describe('action的持续时间（分钟）'),
        })
        })
,
        prompt: systemPrompt,
      });
      return output;
    } catch (error) {}
  }
}

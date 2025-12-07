import { generateObject } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { z } from 'zod';
import { ActionContext, ActionMetadata } from '@/types/action';
import { chooseActionPrompt } from '@yuiju/source';
import { ActionMemory } from '@/memory/short-action';
import dayjs from 'dayjs';

export async function chooseAction(
  actionList: ActionMetadata[],
  context: ActionContext,
  actionMemoryList: ActionMemory[]
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
      const { object } = await generateObject({
        model: deepseek('deepseek-reasoner'),
        schema: z.object({
          action: z.enum(actionList?.map(item => item.action)),
          reason: z.string(),
          durationMinute: z.number().optional(),
        }),
        prompt: systemPrompt,
      });
      return object;
    } catch (error) {}
  }
}

import { generateText, Output, stepCountIs } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { z } from 'zod';
import {
  ActionAgentDecision,
  ActionContext,
  ActionMetadata,
  ActionParameter,
  ActionRecord,
  ParameterAgentDecision,
} from '@/types/action';
import { chooseActionPrompt, chooseFoodPrompt } from '@yuiju/source';
import dayjs from 'dayjs';
import { model_qwen3_8B } from './utils';
import { logger } from '@/utils/logger';
import { queryAvailableFood } from './tools';

const RETRY_COUNT = 3;

export async function chooseActionAgent(
  actionList: ActionMetadata[],
  context: ActionContext,
  actionMemoryList: ActionRecord[]
): Promise<ActionAgentDecision | undefined> {
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
    longTermPlan: context.charactorState.longTermPlan,
    shortTermPlan: context.charactorState.shortTermPlan,
  });

  for (let i = 0; i < RETRY_COUNT; i++) {
    try {
      const { output, reasoningText } = await generateText({
        model: deepseek('deepseek-reasoner'),
        tools: {
          queryAvailableFood: queryAvailableFood(context),
        },
        output: Output.object({
          schema: z.object({
            action: z.enum(actionList?.map(item => item.action)).describe('Action ID，例如：idle、wake_up等'),
            reason: z.string().describe('简短理由，说明为什么选择这个Action'),
            durationMinute: z.number().optional().describe('Action持续多少分钟，只有特殊的Action需要给出持续时间'),
            updateShortTermPlan: z.array(z.string()).optional().describe('如果需要修改短期计划，在此输出新的计划内容'),
            updateLongTermPlan: z.string().optional().describe('如果需要修改长期计划，在此输出新的计划内容'),
          }),
        }),
        prompt: systemPrompt,
        stopWhen: stepCountIs(5),
      });
      logger.info('[chooseActionAgent] 选择行动结果', output);
      logger.info('[chooseActionAgent reasoning]: ', reasoningText);
      return output;
    } catch (error) {
      logger.error('[chooseActionAgent] 选择行动失败', error);
    }
  }
}

export async function chooseFoodAgent(
  foodList: ActionParameter[],
  context: ActionContext,
  actionMemoryList: ActionRecord[]
): Promise<ParameterAgentDecision | undefined> {
  const systemPrompt = chooseFoodPrompt({
    availableFood: foodList,
    location: `${context.charactorState.location.major}${
      context.charactorState.location.minor ? '-' + context.charactorState.location.minor : ''
    }`,
    stamina: context.charactorState.stamina,
    worldTime: context.worldState.time,
    longTermPlan: context.charactorState.longTermPlan,
    shortTermPlan: context.charactorState.shortTermPlan,
    recentActionList: actionMemoryList.map(item => ({
      action: item.action,
      reason: item.reason,
      time: dayjs(item.timestamp),
    })),
  });

  for (let i = 0; i < RETRY_COUNT; i++) {
    try {
      const { output } = await generateText({
        model: model_qwen3_8B,
        output: Output.object({
          schema: z.object({
            selectedList: z
              .array(z.enum(foodList.map(item => item.value)))
              .length(1)
              .describe('选择的食物名称列表，必须是可用食物中的一个'),
            reason: z.string().describe('简短的理由'),
          }),
        }),
        prompt: systemPrompt,
      });
      logger.info('[chooseFoodAgent] 选择食物结果', output);
      return output;
    } catch (error) {
      logger.error('[chooseFoodAgent] 选择食物失败', error);
    }
  }
}

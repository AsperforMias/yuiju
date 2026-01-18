import { chooseActionPrompt, chooseFoodPrompt, chooseShopProductPrompt } from "@yuiju/source";
import type {
  ActionAgentDecision,
  ActionContext,
  ActionMetadata,
  ActionParameter,
  BehaviorRecord,
  ParameterAgentDecision,
} from "@yuiju/utils";
import { generateText, Output, stepCountIs } from "ai";
import dayjs from "dayjs";
import { z } from "zod";
import { logger } from "@/utils/logger";
import { queryAvailableFood } from "./tools";
import { model_deepseek_reasoner, model_qwen3_8B } from "./utils";

const RETRY_COUNT = 3;

export async function chooseActionAgent(
  actionList: ActionMetadata[],
  context: ActionContext,
  actionMemoryList: BehaviorRecord[],
): Promise<ActionAgentDecision | undefined> {
  const systemPrompt = chooseActionPrompt({
    actionList,
    currentAction: context.characterState.action,
    money: context.characterState.money,
    stamina: context.characterState.stamina,
    worldTime: context.worldState.time,
    recentBehaviorList: actionMemoryList.map((item) => ({
      behavior: item.behavior,
      description: item.description,
      parameters: item.parameters,
      time: dayjs(item.timestamp),
    })),
    location: `${context.characterState.location.major}${
      context.characterState.location.minor ? "-" + context.characterState.location.minor : ""
    }`,
    longTermPlan: context.characterState.longTermPlan,
    shortTermPlan: context.characterState.shortTermPlan,
  });

  for (let i = 0; i < RETRY_COUNT; i++) {
    try {
      const { output, reasoningText } = await generateText({
        model: model_deepseek_reasoner,
        tools: {
          queryAvailableFood: queryAvailableFood(context),
        },
        output: Output.object({
          schema: z.object({
            action: z
              .enum(actionList?.map((item) => item.action))
              .describe("Action ID，例如：idle、wake_up等"),
            reason: z.string().describe("简短理由，说明为什么选择这个Action"),
            durationMinute: z
              .number()
              .optional()
              .describe("Action持续多少分钟，只有特殊的Action需要给出持续时间"),
            updateShortTermPlan: z
              .array(z.string())
              .optional()
              .describe("如果需要修改短期计划，在此输出新的计划内容"),
            updateLongTermPlan: z
              .string()
              .optional()
              .describe("如果需要修改长期计划，在此输出新的计划内容"),
          }),
        }),
        prompt: systemPrompt,
        stopWhen: stepCountIs(5),
      });
      logger.info("[chooseActionAgent] 选择行动结果", output);
      logger.info("[chooseActionAgent reasoning]: ", reasoningText);
      return output;
    } catch (error) {
      logger.error("[chooseActionAgent] 选择行动失败", error);
    }
  }
}

export async function chooseFoodAgent(
  foodList: ActionParameter[],
  context: ActionContext,
  actionMemoryList: BehaviorRecord[],
): Promise<ParameterAgentDecision | undefined> {
  const systemPrompt = chooseFoodPrompt({
    availableFood: foodList,
    location: `${context.characterState.location.major}${
      context.characterState.location.minor ? "-" + context.characterState.location.minor : ""
    }`,
    stamina: context.characterState.stamina,
    worldTime: context.worldState.time,
    longTermPlan: context.characterState.longTermPlan,
    shortTermPlan: context.characterState.shortTermPlan,
    recentBehaviorList: actionMemoryList.map((item) => ({
      behavior: item.behavior,
      description: item.description,
      parameters: item.parameters,
      time: dayjs(item.timestamp),
    })),
  });

  for (let i = 0; i < RETRY_COUNT; i++) {
    try {
      const { output } = await generateText({
        model: model_qwen3_8B,
        providerOptions: {
          Siliconflow: {
            enable_thinking: true,
          },
        },
        output: Output.object({
          schema: z.array(
            z.object({
              value: z.enum(foodList.map((item) => item.value)).describe("选择的食物名称"),
              reason: z.string().describe("简短的理由"),
              quantity: z.number().describe("选择的数量"),
            }),
          ),
        }),
        prompt: systemPrompt,
      });
      // LLM 返回的是数组，需要包装成 selectedList 格式
      const result = { selectedList: output };
      logger.info("[chooseFoodAgent] 选择食物结果", result);
      return result;
    } catch (error) {
      logger.error("[chooseFoodAgent] 选择食物失败", error);
    }
  }
}

export async function chooseShopProductAgent(
  productList: ActionParameter[],
  context: ActionContext,
  actionMemoryList: BehaviorRecord[],
): Promise<ParameterAgentDecision | undefined> {
  if (productList.length === 0) {
    return;
  }

  const systemPrompt = chooseShopProductPrompt({
    availableProducts: productList,
    location: `${context.characterState.location.major}${
      context.characterState.location.minor ? "-" + context.characterState.location.minor : ""
    }`,
    stamina: context.characterState.stamina,
    money: context.characterState.money,
    worldTime: context.worldState.time,
    longTermPlan: context.characterState.longTermPlan,
    shortTermPlan: context.characterState.shortTermPlan,
    recentBehaviorList: actionMemoryList.map((item) => ({
      behavior: item.behavior,
      description: item.description,
      parameters: item.parameters,
      time: dayjs(item.timestamp),
    })),
  });

  for (let i = 0; i < RETRY_COUNT; i++) {
    try {
      const { output } = await generateText({
        model: model_qwen3_8B,
        providerOptions: {
          Siliconflow: {
            enable_thinking: true,
          },
        },
        output: Output.object({
          schema: z.object({
            value: z.enum(productList.map((item) => item.value)).describe("选择的商品名称"),
            reason: z.string().describe("简短的理由"),
            quantity: z.number().describe("购买数量"),
          }),
        }),
        prompt: systemPrompt,
      });

      const result = { selectedList: [output] };
      logger.info("[chooseShopProductAgent] 选择商品结果", result);
      return result;
    } catch (error) {
      logger.error("[chooseShopProductAgent] 选择商品失败", error);
    }
  }
}

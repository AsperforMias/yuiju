import {
  type ActionContext,
  ActionId,
  type ActionParameter,
  getMemoryServiceClientFromEnv,
  getRecentBehaviorRecords,
  getTimeWithWeekday,
  isDev,
  isProd,
  saveBehaviorRecord,
} from "@yuiju/utils";
import dayjs from "dayjs";
import { getActionList } from "@/action";
import { getActionById } from "@/action/utils";
import { chooseActionAgent } from "@/llm/agent";
import { characterState } from "@/state/character-state";
import { worldState } from "@/state/world-state";
import { logger } from "@/utils/logger";

const memoryClient = getMemoryServiceClientFromEnv();

export async function getDurationTime(
  durationMin:
    | number
    | ((
        context: ActionContext,
        llmDurationMin?: number,
        parameters?: ActionParameter[],
      ) => Promise<number>),
  context: ActionContext,
  llmDurationMin?: number,
  parameters?: ActionParameter[],
) {
  if (typeof durationMin === "function") {
    return durationMin(context, llmDurationMin, parameters);
  } else {
    return durationMin;
  }
}

export interface TickParams {
  eventDescription?: string;
}

export interface TickReturn {
  nextTickInMinutes: number;
  completionEvent?: string;
}

export async function tick(params: TickParams): Promise<TickReturn> {
  const context: ActionContext = {
    characterState: characterState,
    worldState,
    eventDescription: params.eventDescription,
  };

  const actionList = getActionList(context);

  if (actionList.length === 0) {
    const idleAction = getActionById(ActionId.Idle);
    logger.error("[tick] action list is empty");

    const durationMin = await getDurationTime(idleAction.durationMin, context);
    return { nextTickInMinutes: durationMin };
  }

  logger.info(
    `[tick] Available actions: [${actionList.map((a) => a.action).join(", ")}]`,
    context.characterState.log(),
    context.worldState.log(),
  );

  const recentBehaviors = await getRecentBehaviorRecords(10);
  const history = recentBehaviors.map((behavior) => ({
    behavior: behavior.behavior as ActionId,
    description: behavior.description,
    timestamp: behavior.timestamp.getTime(),
  }));

  const selectedAction = await chooseActionAgent(actionList, context, history);
  const actionMetadata = actionList.find((item) => item.action === selectedAction?.action);

  if (actionMetadata && selectedAction) {
    // 处理计划更新
    if (selectedAction.updateLongTermPlan !== undefined) {
      await characterState.setLongTermPlan(selectedAction.updateLongTermPlan);
      logger.info(
        `[tick] Long term plan updated: ${selectedAction.updateLongTermPlan || "（清空）"}`,
      );
    }
    if (selectedAction.updateShortTermPlan !== undefined) {
      await characterState.setShortTermPlan(selectedAction.updateShortTermPlan);
      logger.info(
        `[tick] Short term plan updated: ${JSON.stringify(selectedAction.updateShortTermPlan)}`,
      );
    }

    // 执行行为
    const executionResult = await actionMetadata.executor(context);

    // 更新世界时间（第一次）
    await context.worldState.updateTime();

    // 计算行为持续时间
    const durationMin = await getDurationTime(
      actionMetadata.durationMin,
      context,
      selectedAction.durationMinute,
    );

    // 保存行为记录（包含持续时间）
    if (isProd()) {
      let description = selectedAction.reason;
      if (executionResult) {
        description += ` ${executionResult}`;
      }

      await saveBehaviorRecord({
        behavior: selectedAction.action,
        description,
        timestamp: new Date(),
        trigger: "agent",
        duration_minutes: durationMin,
      });
    }

    if (memoryClient && selectedAction.action !== ActionId.Idle) {
      try {
        const now = new Date();
        let description = selectedAction.reason;
        if (executionResult) {
          description += ` ${executionResult}`;
        }

        await memoryClient.writeEpisode({
          is_dev: isDev(),
          type: "ゆいじゅ的 Behavior",
          reference_time: now,
          content: {
            time: getTimeWithWeekday(dayjs(now)),
            action: selectedAction.action,
            reason: description,
            duration_minutes: `持续了${durationMin}分钟`,
          },
        });
      } catch (e) {
        logger.error("[tick] write world_action episode failed", e);
      }
    }

    const completionEvent =
      typeof actionMetadata.completionEvent === "function"
        ? await actionMetadata.completionEvent(context)
        : actionMetadata.completionEvent;

    logger.info(
      `[tick] Executed action: ${selectedAction.action}, Reason: ${selectedAction.reason}， Duration: ${durationMin} minutes`,
      context.characterState.log(),
      context.worldState.log(),
    );

    return { nextTickInMinutes: durationMin, completionEvent };
  } else {
    const idleAction = getActionById(ActionId.Idle);
    logger.error("[tick] LLM selected action is not executable.", selectedAction);
    const durationMin = await getDurationTime(idleAction.durationMin, context);
    return { nextTickInMinutes: durationMin };
  }
}

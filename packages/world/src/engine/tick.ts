import {
  type ActionContext,
  ActionId,
  type ActionParameter,
  DEFAULT_MEMORY_SUBJECT_ID,
  emitMemoryEpisode,
  getRecentMemoryEpisodes,
  isDev,
} from "@yuiju/utils";
import { getActionList } from "@/action";
import { getActionById } from "@/action/utils";
import { chooseActionAgent } from "@/llm/agent";
import { buildBehaviorEpisode, buildPlanUpdateEpisodes } from "@/memory/episode-builder";
import { characterState } from "@/state/character-state";
import { worldState } from "@/state/world-state";
import { logger } from "@/utils/logger";

// 当前阶段先在调用侧统一 Episode 模型，暂不真正写入 Graphiti。
// const memoryClient = getMemoryServiceClientFromEnv();

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

  const recentBehaviors = await getRecentMemoryEpisodes({
    limit: 10,
    types: ["behavior"],
    subjectId: DEFAULT_MEMORY_SUBJECT_ID,
    isDev: isDev(),
    onlyToday: true,
  });
  const history = recentBehaviors.map((behavior) => ({
    behavior: String(behavior.payload.action ?? ActionId.Idle) as ActionId,
    description: String(behavior.payload.reason ?? behavior.summaryText),
    timestamp: behavior.happenedAt.getTime(),
  }));

  const selectedAction = await chooseActionAgent(actionList, context, history);
  const actionMetadata = actionList.find((item) => item.action === selectedAction?.action);

  if (actionMetadata && selectedAction) {
    const previousLongTermPlan = characterState.longTermPlan;
    const previousShortTermPlan = characterState.shortTermPlan
      ? [...characterState.shortTermPlan]
      : undefined;

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

    const planEpisodes = buildPlanUpdateEpisodes({
      previousLongTermPlan,
      nextLongTermPlan: characterState.longTermPlan,
      previousShortTermPlan,
      nextShortTermPlan: characterState.shortTermPlan,
      happenedAt: new Date(),
      isDev: isDev(),
    });

    for (const planEpisode of planEpisodes) {
      try {
        await emitMemoryEpisode(planEpisode);
        logger.debug("[tick] built plan_update episode", planEpisode);
      } catch (error) {
        logger.error("[tick] write plan_update episode failed", error);
      }
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

    const satietyDecay = Math.ceil((durationMin / 60) * 5);
    if (satietyDecay > 0) {
      await context.characterState.changeSatiety(-satietyDecay);
    }

    const behaviorEpisode = buildBehaviorEpisode({
      context,
      selectedAction,
      executionResult: executionResult ?? undefined,
      durationMinutes: durationMin,
      happenedAt: new Date(),
      isDev: isDev(),
    });

    if (behaviorEpisode) {
      try {
        await emitMemoryEpisode(behaviorEpisode);
        logger.debug("[tick] built behavior episode", behaviorEpisode);

        // 当前阶段只完成统一 Episode 建模，等待 Python 服务升级后再恢复真实写入。
        // if (memoryClient) {
        //   let description = selectedAction.reason;
        //   if (executionResult) {
        //     description += ` ${executionResult}`;
        //   }
        //
        //   await memoryClient.writeEpisode({
        //     is_dev: isDev(),
        //     type: "ゆいじゅ的 Behavior",
        //     reference_time: behaviorEpisode.happenedAt,
        //     content: {
        //       time: getTimeWithWeekday(dayjs(behaviorEpisode.happenedAt)),
        //       action: selectedAction.action,
        //       reason: description,
        //       duration_minutes: `持续了${durationMin}分钟`,
        //     },
        //   });
        // }
      } catch (e) {
        logger.error("[tick] build world_action episode failed", e);
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

import { charactorState } from '@/state/charactor-state';
import { worldState } from '@/state/world-state';
import { chooseActionAgent } from '@/llm/agent';
import { getActionList } from '@/action';
import { ActionContext, ActionId, ActionParameter } from '@/types/action';
import { getActionById } from '@/action/utils';
import { logger } from '@/utils/logger';
import { isProd } from '@yuiju/utils';
import { getRecentActions, saveAction } from '@yuiju/utils';
import { coordinatorAgent } from '@/llm/coordinator';

// TODO：记得更新入参
export async function getDurationTime(
  durationMin:
    | number
    | ((context: ActionContext, llmDurationMin?: number, parameters?: ActionParameter[]) => Promise<number>),
  context: ActionContext,
  llmDurationMin?: number,
  parameters?: ActionParameter[]
) {
  if (typeof durationMin === 'function') {
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

/**
 *
 * @returns 下一次的 tick 时间
 */
export async function tick(params: TickParams): Promise<TickReturn> {
  const context: ActionContext = {
    charactorState,
    worldState,
    eventDescription: params.eventDescription,
  };

  const actionList = getActionList(context);

  if (actionList.length === 0) {
    const idleAction = getActionById(ActionId.Idle);
    logger.error('[tick] action list is empty');

    const durationMin = await getDurationTime(idleAction.durationMin, context);
    return { nextTickInMinutes: durationMin };
  }

  logger.info(
    `[tick] Available actions: [${actionList.map(a => a.action).join(', ')}]`,
    context.charactorState.log(),
    context.worldState.log()
  );

  const recentActions = await getRecentActions(10);
  const history = recentActions.map(a => ({
    action: a.action_id as ActionId,
    reason: a.reason,
    timestamp: a.create_time.getTime(),
  }));

  const { selectedAction, selectedParameter } = await coordinatorAgent(actionList, context, history);
  const actionMetadata = actionList.find(item => item.action === selectedAction?.action);

  if (actionMetadata && selectedAction) {
    // 处理计划更新
    if (selectedAction.updateLongTermPlan !== undefined) {
      await charactorState.setLongTermPlan(selectedAction.updateLongTermPlan);
      logger.info(`[tick] Long term plan updated: ${selectedAction.updateLongTermPlan || '（清空）'}`);
    }
    if (selectedAction.updateShortTermPlan !== undefined) {
      await charactorState.setShortTermPlan(selectedAction.updateShortTermPlan);
      logger.info(`[tick] Short term plan updated: ${JSON.stringify(selectedAction.updateShortTermPlan)}`);
    }

    // 更新时间
    await context.worldState.updateTime();

    await actionMetadata.executor(context, selectedParameter?.parameters);

    if (isProd) {
      await saveAction({
        action_id: selectedAction.action,
        reason: selectedAction.reason,
        create_time: new Date(),
      });
    }

    // 更新时间
    await context.worldState.updateTime();

    const durationMin = await getDurationTime(
      actionMetadata.durationMin,
      context,
      selectedAction.durationMinute,
      selectedParameter?.parameters
    );

    const completionEvent =
      typeof actionMetadata.completionEvent === 'function'
        ? await actionMetadata.completionEvent(context, selectedParameter?.parameters)
        : actionMetadata.completionEvent;

    logger.info(
      `[tick] Executed action: ${selectedAction.action}, Reason: ${selectedAction.reason}， Duration: ${durationMin} minutes`,
      context.charactorState.log(),
      context.worldState.log()
    );

    return { nextTickInMinutes: durationMin, completionEvent };
  } else {
    const idleAction = getActionById(ActionId.Idle);
    logger.error('[tick] LLM selected action is not executable.', selectedAction);
    const durationMin = await getDurationTime(idleAction.durationMin, context);
    return { nextTickInMinutes: durationMin };
  }
}

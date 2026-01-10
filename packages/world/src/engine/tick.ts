import { getRecentBehaviorRecords, isProd, saveBehaviorRecord } from '@yuiju/utils';
import { getActionList } from '@/action';
import { getActionById } from '@/action/utils';
import { chooseActionAgent } from '@/llm/agent';
import { coordinatorAgent } from '@/llm/coordinator';
import { charactorState } from '@/state/charactor-state';
import { worldState } from '@/state/world-state';
import { type ActionContext, ActionId, type ActionParameter } from '@/types/action';
import { logger } from '@/utils/logger';

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

  const recentBehaviors = await getRecentBehaviorRecords(10);
  const history = recentBehaviors.map(b => ({
    behavior: b.behavior as ActionId,
    description: b.description,
    timestamp: b.timestamp.getTime(),
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

    // 执行行为
    await actionMetadata.executor(context, selectedParameter?.parameters);

    // 更新世界时间（第一次）
    await context.worldState.updateTime();

    // 计算行为持续时间
    const durationMin = await getDurationTime(
      actionMetadata.durationMin,
      context,
      selectedAction.durationMinute,
      selectedParameter?.parameters
    );

    // 保存行为记录（包含持续时间）
    if (isProd) {
      await saveBehaviorRecord({
        behavior: selectedAction.action,
        description: selectedAction.reason,
        timestamp: new Date(),
        trigger: 'agent',
        parameters: selectedParameter?.parameters?.map(p => ({
          value: p.value,
          quantity: p.quantity ?? 1,
          reason: p.description,
          extra: p.extra,
        })),
        duration_minutes: durationMin,
      });
    }

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

import { charactorState } from '@/state/charactor-state';
import { worldState } from '@/state/world-state';
import { chooseAction } from '@/llm/llm-client';
import { getActionList } from '@/action';
import { ActionContext, ActionId } from '@/types/action';
import { getActionById } from '@/action/utils';
import { logger } from '@/utils/logger';
import { isProd } from '@yuiju/utils';
import { getRecentActions, saveAction } from '@yuiju/utils';

export function getDurationTime(durationMin: number | ((context: ActionContext) => number), context: ActionContext) {
  if (typeof durationMin === 'function') {
    return durationMin(context);
  } else {
    return durationMin;
  }
}

/**
 *
 * @returns 下一次的 tick 时间
 */
export async function tick(): Promise<number> {
  const context: ActionContext = {
    charactorState,
    worldState,
  };

  const actionList = getActionList(context);

  if (actionList.length === 0) {
    const idleAction = getActionById(ActionId.Idle);
    logger.error('[tick] action list is empty');

    return getDurationTime(idleAction.durationMin, context);
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

  const selectedAction = await chooseAction(actionList, context, history);
  const actionMetadata = actionList.find(item => item.action === selectedAction?.action);

  if (actionMetadata && selectedAction) {
    const durationMin = actionMetadata.useLLMDuration
      ? selectedAction?.durationMinute ?? actionMetadata.durationMin
      : actionMetadata.durationMin;

    await actionMetadata.executor(context);

    if (isProd) {
      await saveAction({
        action_id: selectedAction.action,
        reason: selectedAction.reason,
        create_time: new Date(),
      });
    }

    logger.info(
      `[tick] Executed action: ${selectedAction.action}, Reason: ${selectedAction.reason}， Duration: ${durationMin} minutes`,
      context.charactorState.log(),
      context.worldState.log()
    );

    return getDurationTime(durationMin, context);
  } else {
    const idleAction = getActionById(ActionId.Idle);
    logger.error('[tick] LLM selected action is not executable.', selectedAction);
    return getDurationTime(idleAction.durationMin, context);
  }
}

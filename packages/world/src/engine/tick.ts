import { charactorState } from '@/state/charactor-state';
import { worldState } from '@/state/world-state';
import { chooseAction } from '@/llm/llm-client';
import { getActionList } from '@/action';
import { ActionContext, ActionId } from '@/types/action';
import { getActionById } from '@/action/utils';
import { shortActionMemory } from '@/memory/short-action';
import { logger } from '@/utils/logger';

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

    return idleAction.durationMin;
  }

  const selectedAction = await chooseAction(actionList, context, shortActionMemory.list());
  const actionMetadata = actionList.find(item => item.action === selectedAction?.action);

  if (actionMetadata && selectedAction) {
    await actionMetadata.executor(context);

    const durationMin = actionMetadata.useLLMDuration
      ? selectedAction?.durationMinute ?? actionMetadata.durationMin
      : actionMetadata.durationMin;

    shortActionMemory.push({
      action: selectedAction.action,
      reason: selectedAction.reason,
      timestamp: Date.now(),
    });

    return durationMin;
  } else {
    const idleAction = getActionById(ActionId.Idle);
    logger.error('[tick] LLM selected action is not executable.', selectedAction);
    return idleAction.durationMin;
  }
}

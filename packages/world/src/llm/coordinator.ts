import {
  ActionAgentDecision,
  ActionContext,
  ActionId,
  ActionMetadata,
  ActionParameter,
  ActionRecord,
} from '@/types/action';
import { chooseActionAgent, chooseFoodAgent } from './agent';

const Action2ParameterAgentMap: Record<
  string,
  (
    parameterList: ActionParameter[],
    context: ActionContext,
    actionMemoryList: ActionRecord[]
  ) => Promise<
    | {
        selectedList: string[];
        reason: string;
      }
    | undefined
  >
> = {
  [ActionId.Eat_Item]: chooseFoodAgent,
};

export async function coordinatorAgent(
  actionList: ActionMetadata[],
  context: ActionContext,
  actionMemoryList: ActionRecord[]
): Promise<{
  selectedAction?: ActionAgentDecision;
  selectedParameter?: {
    parameters: ActionParameter[];
    reason: string;
  };
}> {
  const selectedAction = await chooseActionAgent(actionList, context, actionMemoryList);
  if (!selectedAction) {
    return {};
  }
  const actionMetadata = actionList.find(item => item.action === selectedAction?.action);
  if (!actionMetadata) {
    return {};
  }

  const parameterAgent = Action2ParameterAgentMap[selectedAction.action];
  if (parameterAgent) {
    const parameterList = actionMetadata.parameterAgent ? await actionMetadata.parameterAgent(context) : [];

    const parameterAgentRes = await parameterAgent(parameterList, context, actionMemoryList);

    if (!parameterAgentRes || parameterAgentRes.selectedList.length === 0) {
      return {
        selectedAction,
        selectedParameter: undefined,
      };
    }

    const selectedParameterList = parameterAgentRes.selectedList
      .map(value => {
        return parameterList.find(param => param.value === value);
      })
      .filter(Boolean) as ActionParameter[];

    return {
      selectedAction,
      selectedParameter: {
        parameters: selectedParameterList,
        reason: parameterAgentRes.reason,
      },
    };
  }

  return {
    selectedAction,
    selectedParameter: undefined,
  };
}

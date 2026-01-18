import {
  type ActionAgentDecision,
  type ActionContext,
  ActionId,
  type ActionMetadata,
  type ActionParameter,
  type BehaviorRecord,
  type ParameterAgentDecision,
} from "@yuiju/utils";
import { chooseActionAgent, chooseFoodAgent, chooseShopProductAgent } from "./agent";

const Action2ParameterAgentMap: Record<
  string,
  (
    parameterList: ActionParameter[],
    context: ActionContext,
    actionMemoryList: BehaviorRecord[],
  ) => Promise<ParameterAgentDecision | undefined>
> = {
  [ActionId.Eat_Item]: chooseFoodAgent,
  [ActionId.Buy_Item_At_Shop]: chooseShopProductAgent,
};

export async function coordinatorAgent(
  actionList: ActionMetadata[],
  context: ActionContext,
  behaviorList: BehaviorRecord[],
): Promise<{
  selectedAction?: ActionAgentDecision;
  selectedParameter?: {
    parameters: ActionParameter[];
  };
}> {
  const selectedAction = await chooseActionAgent(actionList, context, behaviorList);
  if (!selectedAction) {
    return {};
  }
  const actionMetadata = actionList.find((item) => item.action === selectedAction?.action);
  if (!actionMetadata) {
    return {};
  }

  const parameterAgent = Action2ParameterAgentMap[selectedAction.action];
  if (parameterAgent) {
    const parameterList = actionMetadata.parameterResolver
      ? await actionMetadata.parameterResolver(context)
      : [];

    const parameterAgentRes = await parameterAgent(parameterList, context, behaviorList);

    if (!parameterAgentRes || parameterAgentRes.selectedList.length === 0) {
      return {
        selectedAction,
        selectedParameter: undefined,
      };
    }

    const selectedParameterList = parameterAgentRes.selectedList
      .map((selectedItem) => {
        const baseParam = parameterList.find((param) => param.value === selectedItem.value);
        if (!baseParam) return null;

        // 合并数量信息
        return {
          ...baseParam,
          quantity: selectedItem.quantity,
          reason: selectedItem.reason,
        };
      })
      .filter(Boolean) as ActionParameter[];

    return {
      selectedAction,
      selectedParameter: {
        parameters: selectedParameterList,
      },
    };
  }

  return {
    selectedAction,
    selectedParameter: undefined,
  };
}

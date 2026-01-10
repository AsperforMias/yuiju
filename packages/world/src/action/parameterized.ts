import { ActionId, type ActionMetadata, ActionParameter } from "@/types/action";
import { isNotDoing } from "./utils";

/**
 * 参数化行为定义
 * 这些行为需要通过参数 Agent 选择具体的执行参数
 */
export const parameterizedActions: ActionMetadata[] = [
  {
    action: ActionId.Buy_Item,
    description: "购买指定物品（可以调用 queryAvailableItems 查看可购买物品）",

    /**
     * 前置条件：不在睡觉且有金币
     */
    precondition: (context) => {
      return isNotDoing(context, ActionId.Sleep) && context.characterState.money > 0;
    },

    /**
     * 参数选择 Agent
     * 返回可购买的物品参数列表
     */
    parameterAgent: async (context) => {
      // 这里的逻辑会被参数 Agent 覆盖，但保留作为备用
      throw new Error("需要通过参数 Agent 获取可购买物品");
    },

    /**
     * 执行器：购买物品并扣除金币
     */
    async executor(context, parameters) {
      if (!parameters || parameters.length === 0) {
        throw new Error("没有可用的购买参数");
      }

      const selectedItem = parameters[0];

      // 设置当前动作
      await context.characterState.setAction(ActionId.Buy_Item);

      // 扣除金币
      const price = selectedItem.extra?.price || 5;
      if (context.characterState.money < price) {
        throw new Error(`金币不足，需要${price}金币，当前只有${context.characterState.money}金币`);
      }

      await context.characterState.changeMoney(-price);

      // 添加物品到背包
      await context.characterState.addItem(selectedItem.value, 1);
    },

    /**
     * 持续时间：购买行为通常比较快
     */
    durationMin: 5,

    /**
     * 完成事件：生成购买完成的描述
     */
    completionEvent: async (context, parameters) => {
      if (parameters && parameters.length > 0) {
        const itemName = parameters[0].value;
        const price = parameters[0].extra?.price || 0;
        return `悠酱花了${price}金币买了${itemName}，放进了背包里`;
      }
      return "悠酱买了一些东西";
    },
  },
];

/**
 * 获取所有参数化行为
 * 用于在 action 列表中包含这些行为
 */
export function getParameterizedActions() {
  return parameterizedActions;
}

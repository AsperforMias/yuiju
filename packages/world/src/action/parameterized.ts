import { ActionId, ActionMetadata, ActionParameter } from '@/types/action';
import { isNotDoing } from './utils';

/**
 * 参数化行为定义
 * 这些行为需要通过参数 Agent 选择具体的执行参数
 */
export const parameterizedActions: ActionMetadata[] = [
  {
    action: ActionId.Eat_Item,
    description: '吃指定食物恢复体力（可以调用 queryAvailableFood 查看可用食物）',
    
    /**
     * 前置条件：不在睡觉且体力不满
     */
    precondition: (context) => {
      return isNotDoing(context, ActionId.Sleep) && context.charactorState.stamina < 90;
    },
    
    /**
     * 参数选择 Agent
     * 返回可用的食物参数列表
     */
    parameterAgent: async (context) => {
      const inventory = context.charactorState.inventory || [];
      const availableFood = inventory.filter(item => 
        item.category === 'food' && item.quantity > 0
      );
      
      if (availableFood.length === 0) {
        throw new Error('背包中没有可用的食物');
      }

      return availableFood.map(food => ({
        value: food.name,
        description: `${food.name}可以恢复${food.stamina || 0}点体力（剩余${food.quantity}个）`,
        metadata: {
          stamina: food.stamina || 0,
          category: 'food',
          quantity: food.quantity
        }
      }));
    },
    
    /**
     * 执行器：消费食物并恢复体力
     */
    async executor(context, parameters) {
      if (!parameters || parameters.length === 0) {
        throw new Error('没有可用的食物参数');
      }
      
      const selectedFood = parameters[0];
      
      // 设置当前动作
      await context.charactorState.setAction(ActionId.Eat_Item);
      
      // 消费物品
      const consumed = await context.charactorState.consumeItem(selectedFood.value, 1);
      if (!consumed) {
        throw new Error(`消费物品失败: ${selectedFood.value}`);
      }
      
      // 恢复体力
      const stamina = selectedFood.metadata?.stamina || 10;
      await context.charactorState.changeStamina(stamina);
    },
    
    /**
     * 持续时间：根据食物类型动态计算
     */
    durationMin: async (context, parameters) => {
      // 不同食物有不同的进食时间
      if (parameters && parameters.length > 0) {
        const foodName = parameters[0].value;
        switch (foodName) {
          case '苹果':
          case '饼干':
            return 5; // 小食品，快速进食
          case '面包':
          case '三明治':
            return 10; // 中等食品
          case '学校午餐':
            return 20; // 正餐，需要更多时间
          default:
            return 8; // 默认时间
        }
      }
      return 10; // 默认时间
    },
    
    /**
     * 完成事件：生成个性化的完成描述
     */
    completionEvent: async (context, parameters) => {
      if (parameters && parameters.length > 0) {
        const foodName = parameters[0].value;
        const stamina = parameters[0].metadata?.stamina || 0;
        return `悠酱吃了${foodName}，恢复了${stamina}点体力，感觉精神了一些`;
      }
      return '悠酱吃了一些食物，感觉好多了';
    }
  },
  
  {
    action: ActionId.Buy_Item,
    description: '购买指定物品（可以调用 queryAvailableItems 查看可购买物品）',
    
    /**
     * 前置条件：不在睡觉且有金币
     */
    precondition: (context) => {
      return isNotDoing(context, ActionId.Sleep) && context.charactorState.money > 0;
    },
    
    /**
     * 参数选择 Agent
     * 返回可购买的物品参数列表
     */
    parameterAgent: async (context) => {
      // 这里的逻辑会被参数 Agent 覆盖，但保留作为备用
      throw new Error('需要通过参数 Agent 获取可购买物品');
    },
    
    /**
     * 执行器：购买物品并扣除金币
     */
    async executor(context, parameters) {
      if (!parameters || parameters.length === 0) {
        throw new Error('没有可用的购买参数');
      }
      
      const selectedItem = parameters[0];
      
      // 设置当前动作
      await context.charactorState.setAction(ActionId.Buy_Item);
      
      // 扣除金币
      const price = selectedItem.metadata?.price || 5;
      if (context.charactorState.money < price) {
        throw new Error(`金币不足，需要${price}金币，当前只有${context.charactorState.money}金币`);
      }
      
      await context.charactorState.changeMoney(-price);
      
      // 添加物品到背包
      await context.charactorState.addItem(selectedItem.value, 1);
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
        const price = parameters[0].metadata?.price || 0;
        return `悠酱花了${price}金币买了${itemName}，放进了背包里`;
      }
      return '悠酱买了一些东西';
    }
  }
];

/**
 * 获取所有参数化行为
 * 用于在 action 列表中包含这些行为
 */
export function getParameterizedActions() {
  return parameterizedActions;
}
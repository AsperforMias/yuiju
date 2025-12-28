import { ActionContext } from '@/types/action';
import { tool } from 'ai';
import z from 'zod';

export const queryAvailableFood = (context: ActionContext) =>
  tool({
    description: '查询当前背包中的食物列表',
    inputSchema: z.object({}),
    execute: async () => {
      const inventory = context.charactorState.inventory || [];
      const availableFood = inventory.filter(item => item.category === 'food' && item.quantity > 0);

      if (availableFood.length === 0) {
        return '背包中没有可用的食物';
      }

      const result = availableFood.map(food => {
        return {
          value: food.name,
          description: `${food.description}（剩余${food.quantity}个）`,
        };
      });

      return result;
    },
  });

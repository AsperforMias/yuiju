import { ActionId, ActionMetadata } from '@/types/action';
import { notDoneToday } from './utils';
import { allTrue } from '@yuiju/utils';
import { logger } from '@/utils/logger';
import { FoodMetadata } from '@/types/state';

export const anywhereAction: ActionMetadata[] = [
  {
    action: ActionId.Idle,
    description: '休息等待，可以在任何地点进行。需要给出等待多少分钟。',
    precondition(context) {
      return true;
    },
    async executor(context) {
      await context.charactorState.setAction(ActionId.Idle);
    },
    async durationMin(context, durationMinute) {
      return durationMinute ?? 10;
    },
  },
  {
    action: ActionId.Eat_Lunch,
    description: '吃午饭，恢复50点体力。耗时20分钟。',
    precondition(context) {
      const hour = context.worldState.time.get('hour');
      return allTrue([() => hour >= 11 && hour < 14, () => notDoneToday(context, ActionId.Eat_Lunch)]);
    },
    async executor(context) {
      await context.charactorState.setAction(ActionId.Eat_Lunch);
      await context.charactorState.changeStamina(50);
      await context.charactorState.markActionDoneToday(ActionId.Eat_Lunch);
    },
    durationMin: 20,
  },
  {
    action: ActionId.Eat_Item,
    description: '吃食物，可以恢复体力。耗时10分钟。（可以调用 queryAvailableFood 查看可用食物）',
    precondition: context => {
      return allTrue([
        () => {
          const inventory = context.charactorState.inventory || [];
          const availableFood = inventory.filter(item => item.category === 'food' && item.quantity > 0);
          return availableFood.length > 0;
        },
      ]);
    },
    parameterAgent: async context => {
      const inventory = context.charactorState.inventory || [];
      const availableFood = inventory.filter(item => item.category === 'food' && item.quantity > 0);

      if (availableFood.length === 0) {
        return [];
      }

      return availableFood.map(food => {
        const metadata = food.metadata as FoodMetadata;

        return {
          value: food.name,
          description: `${food.description}（剩余${food.quantity}个）`,
          extra: metadata,
        };
      });
    },

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
        logger.error(`[Eat_Item] 消费食物失败: ${selectedFood.value}`);
        return;
      }

      // 恢复体力
      const stamina = selectedFood.extra?.stamina || 10;
      await context.charactorState.changeStamina(stamina);
    },

    durationMin: 10,
  },
];

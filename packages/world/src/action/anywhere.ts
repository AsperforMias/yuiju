import { allTrue } from "@yuiju/utils";
import { ActionId, type ActionMetadata } from "@/types/action";
import type { FoodMetadata } from "@/types/state";
import { logger } from "@/utils/logger";
import { notDoneToday } from "./utils";

export const anywhereAction: ActionMetadata[] = [
  {
    action: ActionId.Idle,
    description: "休息等待，可以在任何地点进行。需要给出等待多少分钟。",
    precondition(_context) {
      return true;
    },
    async executor(context) {
      await context.characterState.setAction(ActionId.Idle);
    },
    async durationMin(_context, durationMinute) {
      return durationMinute ?? 10;
    },
  },
  {
    action: ActionId.Eat_Lunch,
    description: "吃午饭，恢复50点体力。耗时20分钟。",
    precondition(context) {
      const hour = context.worldState.time.get("hour");
      return allTrue([
        () => hour >= 11 && hour < 14,
        () => notDoneToday(context, ActionId.Eat_Lunch),
      ]);
    },
    async executor(context) {
      await context.characterState.setAction(ActionId.Eat_Lunch);
      await context.characterState.changeStamina(50);
      await context.characterState.markActionDoneToday(ActionId.Eat_Lunch);
    },
    durationMin: 20,
  },
  {
    action: ActionId.Eat_Item,
    description: "吃食物，可以恢复体力。耗时10分钟。（可以调用 queryAvailableFood 查看可用食物）",
    precondition: (context) => {
      return allTrue([
        () => {
          const inventory = context.characterState.inventory || [];
          const availableFood = inventory.filter(
            (item) => item.category === "food" && item.quantity > 0,
          );
          return availableFood.length > 0;
        },
      ]);
    },
    parameterAgent: async (context) => {
      const inventory = context.characterState.inventory || [];
      const availableFood = inventory.filter(
        (item) => item.category === "food" && item.quantity > 0,
      );

      if (availableFood.length === 0) {
        return [];
      }

      return availableFood.map((food) => {
        return {
          value: food.name,
          description: `${food.description}（剩余${food.quantity}个）`,
          extra: food.metadata,
        };
      });
    },

    async executor(context, parameters) {
      if (!parameters || parameters.length === 0) {
        throw new Error("没有可用的食物参数");
      }

      // 设置当前动作
      await context.characterState.setAction(ActionId.Eat_Item);

      // 遍历处理所有选择的食物
      for (const selectedFood of parameters) {
        const quantity = selectedFood.quantity || 1;

        // 消费指定数量的物品
        const consumed = await context.characterState.consumeItem(selectedFood.value, quantity);
        if (!consumed) {
          logger.error(`[Eat_Item] 消费食物失败: ${selectedFood.value} x${quantity}`);
          continue;
        }

        // 恢复体力（按数量累加）
        const staminaPerUnit = selectedFood.extra?.stamina || 10;
        const totalStamina = staminaPerUnit * quantity;
        await context.characterState.changeStamina(totalStamina);

        logger.info(
          `[Eat_Item] 成功消费 ${selectedFood.value} x${quantity}，恢复 ${totalStamina} 点体力`,
        );
      }
    },

    durationMin: 10,
  },
];

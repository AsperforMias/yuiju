import { ActionId, type ActionMetadata, allTrue } from "@yuiju/utils";
import { chooseFoodAgent } from "@/llm/agent";
import { logger } from "@/utils/logger";
import { notDoneToday } from "./utils";

function getAvailableFoodParameters(context: { characterState: { inventory?: any[] } }) {
  const inventory = context.characterState.inventory || [];
  const availableFood = inventory.filter((item) => item.category === "food" && item.quantity! > 0);

  return availableFood.map((food) => {
    return {
      value: food.name,
      description: `${food.description}（剩余${food.quantity}个）`,
      extra: food.metadata,
    };
  });
}

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
          return getAvailableFoodParameters(context).length > 0;
        },
      ]);
    },
    async executor(context) {
      const foodList = getAvailableFoodParameters(context);
      if (foodList.length === 0) {
        return "没有可吃的食物。";
      }

      // 设置当前动作
      await context.characterState.setAction(ActionId.Eat_Item);

      const selectionResult = await chooseFoodAgent(foodList, context, []);
      const selectedFoodList = selectionResult
        ?.filter((item) => foodList.find((param) => param.value === item.value))
        ?.map((item) => {
          const baseParam = foodList.find((param) => param.value === item.value)!;

          return {
            ...baseParam,
            quantity: item.quantity,
          };
        });

      if (!selectedFoodList || selectedFoodList.length === 0) {
        return "没有选择要吃的食物。";
      }

      const eatenSummary: string[] = [];

      // 遍历处理所有选择的食物
      for (const selectedFood of selectedFoodList) {
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

        eatenSummary.push(`${selectedFood.value}${quantity}个`);
      }

      if (eatenSummary.length === 0) {
        return "尝试吃东西，但都没吃成功。";
      }

      return `吃了${eatenSummary.join("，")}`;
    },

    durationMin: 10,
  },
];

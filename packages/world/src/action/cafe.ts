import { ActionId, type ActionMetadata, allTrue, MajorScene } from "@yuiju/utils";
import { chooseCafeCoffeeAgent } from "@/llm/agent";
import { logger } from "@/utils/logger";

type CafeCoffee = {
  name: string;
  price: number;
  stamina: number;
  description: string;
};

const CAFE_COFFEES: CafeCoffee[] = [
  {
    name: "拼配热咖啡",
    price: 80,
    stamina: 8,
    description: "店家每日拼配，香气温和，口感顺口。",
  },
  {
    name: "冰咖啡",
    price: 90,
    stamina: 9,
    description: "冰镇清爽，适合夏天。",
  },
  {
    name: "美式咖啡",
    price: 90,
    stamina: 9,
    description: "清透不腻，带一点点苦。",
  },
  {
    name: "咖啡欧蕾",
    price: 100,
    stamina: 10,
    description: "牛奶与咖啡的温柔平衡。",
  },
  {
    name: "拿铁",
    price: 110,
    stamina: 11,
    description: "奶泡细腻，口感更醇厚。",
  },
];

const CAFE_MIN_PRICE = Math.min(...CAFE_COFFEES.map((p) => p.price));

function isAtCafe(major: MajorScene) {
  return major === MajorScene.Cafe;
}

function formatCoffeeDescription(coffee: CafeCoffee) {
  return `${coffee.price}元，恢复${coffee.stamina}体力；${coffee.description}`;
}

function isCafeWorkTimeWithAtLeastOneHourLeft(time: { hour: () => number; minute: () => number }) {
  const minutesSinceMidnight = time.hour() * 60 + time.minute();
  return minutesSinceMidnight >= 10 * 60 && minutesSinceMidnight <= 16 * 60;
}

function getAvailableCafeCoffeeNames(context: { characterState: { inventory?: any[] } }) {
  const inventory = context.characterState.inventory || [];
  const available = inventory.filter(
    (item) =>
      item.category === "food" &&
      item.quantity > 0 &&
      CAFE_COFFEES.some((coffee) => coffee.name === item.name),
  );
  return available.map((item) => item.name);
}

export const cafeAction: ActionMetadata[] = [
  {
    action: ActionId.Order_Coffee,
    description: "在咖啡店点单。点咖啡并放入背包。结束后提示咖啡制作完成。",
    precondition(context) {
      return allTrue([
        () => isAtCafe(context.characterState.location.major),
        () => context.characterState.money >= CAFE_MIN_PRICE,
      ]);
    },
    async executor(context) {
      await context.characterState.setAction(ActionId.Order_Coffee);

      const coffeeList = CAFE_COFFEES.map((coffee) => {
        return {
          value: coffee.name,
          description: formatCoffeeDescription(coffee),
          extra: { price: coffee.price },
        };
      });

      const selectedCoffee = await chooseCafeCoffeeAgent(coffeeList, context, []);
      if (!selectedCoffee) {
        logger.error("[Order_Coffee] 没有选择咖啡");
        return "点单失败，没有选择咖啡。";
      }

      const coffee = CAFE_COFFEES.find((p) => p.name === selectedCoffee.value);
      if (!coffee) {
        logger.error(`[Order_Coffee] 未找到咖啡: ${selectedCoffee.value}`);
        return "点单失败，未找到咖啡。";
      }

      const cost = coffee.price;
      if (context.characterState.money < cost) {
        logger.info(
          `[Order_Coffee] 余额不足，跳过点单: ${coffee.name}（单价${coffee.price}元，余额${context.characterState.money}元）`,
        );
        return "点单失败，余额不足。";
      }

      await context.characterState.changeMoney(-cost);

      await context.characterState.addItem(
        {
          name: coffee.name,
          description: coffee.description,
          category: "food",
          metadata: { stamina: coffee.stamina },
        },
        1,
      );

      logger.info(`[Order_Coffee] 点单成功: ${coffee.name}，花费${cost}元`);

      return `点了${coffee.name}，花费${cost}元`;
    },
    durationMin: 10,
    completionEvent: "咖啡制作完成",
  },
  {
    action: ActionId.Drink_Coffee,
    description: "喝咖啡，恢复体力（恢复值=咖啡价格/10）。点单后只能选择这个行为。耗时10分钟。",
    precondition(_context) {
      return false;
    },
    async executor(context) {
      await context.characterState.setAction(ActionId.Drink_Coffee);

      const availableCoffeeNames = getAvailableCafeCoffeeNames(context);
      const coffeeName = availableCoffeeNames[0];
      if (!coffeeName) {
        return "没有咖啡可以喝。";
      }

      const consumed = await context.characterState.consumeItem(coffeeName, 1);
      if (!consumed) {
        return `喝咖啡失败，没有喝到${coffeeName}。`;
      }

      const coffee = CAFE_COFFEES.find((item) => item.name === coffeeName);
      const staminaRecovered = coffee?.stamina ?? 10;
      await context.characterState.changeStamina(staminaRecovered);
      return `喝了${coffeeName}，恢复${staminaRecovered}点体力`;
    },
    durationMin: 10,
  },
  {
    action: ActionId.Work_At_Cafe,
    description: "在咖啡店打工。可打工时间段为10:00-17:00，每小时200块钱。持续60分钟。",
    precondition(context) {
      return allTrue([
        () => isAtCafe(context.characterState.location.major),
        () => isCafeWorkTimeWithAtLeastOneHourLeft(context.worldState.time),
      ]);
    },
    async executor(context) {
      await context.characterState.setAction(ActionId.Work_At_Cafe);
      await context.characterState.changeMoney(200);
      await context.characterState.changeStamina(-10);
      return "打工1小时，赚了200元";
    },
    durationMin: 60,
  },
  {
    action: ActionId.Go_Home_From_Cafe,
    description: "从咖啡店回家。消耗体力5点。耗时20分钟。",
    precondition(context) {
      return isAtCafe(context.characterState.location.major);
    },
    async executor(context) {
      await context.characterState.setAction(ActionId.Go_Home_From_Cafe);
      await context.characterState.setLocation({ major: MajorScene.Home });
      await context.characterState.changeStamina(-5);
    },
    durationMin: 20,
  },
  {
    action: ActionId.Go_To_School_From_Cafe,
    description: "从咖啡店去学校。消耗体力5点。耗时10分钟。",
    precondition(context) {
      return isAtCafe(context.characterState.location.major);
    },
    async executor(context) {
      await context.characterState.setAction(ActionId.Go_To_School_From_Cafe);
      await context.characterState.setLocation({ major: MajorScene.School });
      await context.characterState.changeStamina(-5);
    },
    durationMin: 10,
  },
];

import "@yuiju/utils/env";
import type {
  ActionContext,
  ActionParameter,
  BehaviorRecord,
  CharacterStateData,
  ICharacterState,
  IWorldState,
} from "@yuiju/utils";
import { ActionId, MajorScene } from "@yuiju/utils";
import dayjs from "dayjs";
import { chooseShopProductAgent } from "@/llm/agent";

function createMockCharacterState(): ICharacterState {
  const data: CharacterStateData = {
    action: ActionId.Idle,
    location: { major: MajorScene.Shop },
    stamina: 42,
    money: 35,
    dailyActionsDoneToday: [ActionId.Wake_Up, ActionId.Go_To_Shop_From_School],
    longTermPlan: "省钱买喜欢的轻小说",
    shortTermPlan: ["回学校前补充点零食", "控制预算不要乱买"],
    inventory: [
      {
        name: "饼干",
        description: "甜甜的饼干",
        category: "food",
        quantity: 1,
        metadata: { stamina: 5 },
      },
    ],
  };

  return {
    ...data,
    setAction: async () => {},
    setStamina: async () => {},
    setLocation: async () => {},
    changeStamina: async () => {},
    changeMoney: async () => {},
    markActionDoneToday: async () => {},
    clearDailyActions: async () => {},
    log: () => ({ ...data }),
    addItem: async () => {},
    consumeItem: async () => true,
    getItemQuantity: () => 0,
    setLongTermPlan: async () => {},
    setShortTermPlan: async () => {},
  };
}

function createMockWorldState(): IWorldState {
  const data = {
    time: dayjs(),
  };

  return {
    ...data,
    log: () => ({ ...data }),
    updateTime: async () => {},
    reset: async () => {},
  };
}

function createMockContext(): ActionContext {
  return {
    characterState: createMockCharacterState(),
    worldState: createMockWorldState(),
    eventDescription: "刚进商店，想买点东西带走",
  };
}

function createMockProductList(): ActionParameter[] {
  return [
    { value: "柠檬水", description: "清爽解腻，价格 5 金币", extra: { price: 5 } },
    { value: "草莓蛋糕", description: "甜品，价格 18 金币", extra: { price: 18 } },
    { value: "饭团", description: "顶饱，价格 8 金币", extra: { price: 8 } },
    { value: "薯片", description: "零食，价格 10 金币", extra: { price: 10 } },
    { value: "巧克力", description: "甜食，价格 12 金币", extra: { price: 12 } },
  ];
}

function createMockActionMemory(): BehaviorRecord[] {
  return [
    {
      behavior: ActionId.Study_At_School,
      description: "在学校学习了一段时间，有点累",
      timestamp: dayjs().subtract(120, "minute").valueOf(),
    },
    {
      behavior: ActionId.Go_To_Shop_From_School,
      description: "从学校走到商店",
      timestamp: dayjs().subtract(20, "minute").valueOf(),
    },
  ];
}

async function main() {
  if (!process.env.SILICONFLOW_API_KEY) {
    console.log("[demo] 未检测到 SILICONFLOW_API_KEY，跳过调用 chooseShopProductAgent");
    console.log("[demo] 你可以先在环境变量中设置 SILICONFLOW_API_KEY，然后再运行：pnpm demo:world");
    return;
  }

  const productList = createMockProductList();
  const context = createMockContext();
  const actionMemoryList = createMockActionMemory();

  const decision = await chooseShopProductAgent(productList, context, actionMemoryList);
  console.log("[demo] chooseShopProductAgent 返回：", JSON.stringify(decision, null, 2));
}

void main();

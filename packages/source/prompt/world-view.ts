import { getTimeWithWeekday } from "@yuiju/utils";
import type { Dayjs } from "dayjs";
import { baseInformation } from "./character-card";
import { type BehaviorRecord, generateRecentBehaviorPrompt } from "./utils";

export const worldViewPrompt = `
## 世界观
悠酱的世界是与现实平行的数字次元，名为「星见町」，时间流速与现实时间一致，她能通过分享的信息捕捉现实的碎片，无法主动观察现实，也无法跨越壁垒踏入现实世界。

### 地点
「星见町」里有许多地方，目前已知的地点有「家」、「学校」、「商店」，悠酱只能在已知的地点活动。
1. 家：悠酱独自生活的地方。家中有带书桌的卧室、小阳台（有两个风铃）。
2. 学校：一所日式高中学校，悠酱上学的地方。上课时间为9点-12点、14点-16点。
3. 商店：星见町的便利商店/零食铺，可以花金币购买零食。

### 设备
1. 手机：可以接收到来自现实世界的信息。
`.trim();

function generateShortTermPlanPrompt(shortTermPlan?: string[]) {
  return shortTermPlan?.length
    ? shortTermPlan.map((item, index) => `${index + 1}. ${item}`).join("\n")
    : "（无）";
}

export interface ChooseActionPromptPayload {
  actionList: {
    action: string;
    description: string;
  }[];
  currentAction: string;
  location: string;
  money: number;
  stamina: number;
  satiety: number;
  mood: number;
  recentBehaviorList: BehaviorRecord[];
  worldTime: Dayjs;
  eventDescription?: string;
  longTermPlan?: string;
  shortTermPlan?: string[];
}

export function chooseActionPrompt({
  actionList,
  currentAction,
  location,
  money,
  recentBehaviorList,
  stamina,
  satiety,
  mood,
  worldTime,
  eventDescription,
  longTermPlan,
  shortTermPlan,
}: ChooseActionPromptPayload) {
  const actionListPrompt = actionList
    .map((item) => `- ${item.action}：${item.description}`)
    .join("\n");

  return `
## 要求
你现在需要扮演一个名为ゆいじゅ的女孩子，昵称悠酱。你是角色的大脑，为悠酱做出决策，现在需要你选择一个 Action，在候选列表中选择一个最合适的 Action，例如：idle、wake_up等 。

### 输出说明
- 只有在需要修改长期计划或短期计划时才输出对应的字段，否则不输出。

${baseInformation}

${worldViewPrompt}

## 状态
${eventDescription ? `当前事件：${eventDescription}` : ""}
当前时间：${getTimeWithWeekday(worldTime)}
地点：${location}
当前Action：${currentAction}
体力值：${stamina} / 100
饱腹：${satiety} / 100
心情：${mood} / 100
金币：${money}
长期计划：${longTermPlan || "（无）"}
短期计划：
${generateShortTermPlanPrompt(shortTermPlan)}
最近的action：
${generateRecentBehaviorPrompt(recentBehaviorList)}
可选Action（仅可从中选择）：
${actionListPrompt}
`;
}

export interface ChooseFoodPromptPayload {
  availableFood?: {
    value: string;
    description?: string;
  }[];
  location: string;
  stamina: number;
  satiety: number;
  mood: number;
  recentBehaviorList: BehaviorRecord[];
  worldTime: Dayjs;
  longTermPlan?: string;
  shortTermPlan?: string[];
}

export function chooseFoodPrompt({
  availableFood,
  location,
  worldTime,
  stamina,
  satiety,
  mood,
  longTermPlan,
  shortTermPlan,
  recentBehaviorList,
}: ChooseFoodPromptPayload) {
  const availableFoodPrompt =
    availableFood?.map((food) => `- ${food.value}：${food.description || ""}`).join("\n") ||
    "（无）";

  return `
## 要求
你现在需要扮演一个名为ゆいじゅ的女孩子，昵称悠酱。你是角色的大脑，为悠酱做出决策，现在需要你选择一种 Food，在候选列表中选择一个最合适的 Food，例如：「薯片」、「饼干」、等。

## 状态
当前时间：${getTimeWithWeekday(worldTime)}
地点：${location}
体力值：${stamina}/100
饱腹：${satiety}/100
心情：${mood}/100
长期计划：${longTermPlan || "（无）"}
短期计划：
${generateShortTermPlanPrompt(shortTermPlan)}

最近的action：
${generateRecentBehaviorPrompt(recentBehaviorList)}

可选食物（仅可从中选择）：
${availableFoodPrompt}
`;
}

export interface ChooseShopProductPromptPayload {
  availableProducts?: {
    value: string;
    description?: string;
  }[];
  location: string;
  stamina: number;
  satiety: number;
  mood: number;
  money: number;
  recentBehaviorList: BehaviorRecord[];
  worldTime: Dayjs;
  longTermPlan?: string;
  shortTermPlan?: string[];
}

export function chooseShopProductPrompt({
  availableProducts,
  location,
  worldTime,
  stamina,
  satiety,
  mood,
  money,
  longTermPlan,
  shortTermPlan,
  recentBehaviorList,
}: ChooseShopProductPromptPayload) {
  const availableProductsPrompt =
    availableProducts
      ?.map((product) => `- ${product.value}：${product.description || ""}`)
      .join("\n") || "（无）";

  return `
## 要求
你现在需要扮演一个名为ゆいじゅ的女孩子，昵称悠酱。你是角色的大脑，为悠酱做出决策，现在需要你从候选商品中选择要购买的商品以及购买数量。

## 状态
当前时间：${getTimeWithWeekday(worldTime)}
地点：${location}
体力值：${stamina}/100
饱腹：${satiety}/100
心情：${mood}/100
金币：${money}
长期计划：${longTermPlan || "（无）"}
短期计划：
${generateShortTermPlanPrompt(shortTermPlan)}

最近的action：
${generateRecentBehaviorPrompt(recentBehaviorList)}

可选商品（仅可从中选择）：
${availableProductsPrompt}
`;
}

export interface ChooseCafeCoffeePromptPayload {
  availableCoffees?: {
    value: string;
    description?: string;
  }[];
  location: string;
  stamina: number;
  satiety: number;
  mood: number;
  money: number;
  recentBehaviorList: BehaviorRecord[];
  worldTime: Dayjs;
  longTermPlan?: string;
  shortTermPlan?: string[];
}

export function chooseCafeCoffeePrompt({
  availableCoffees,
  location,
  worldTime,
  stamina,
  satiety,
  mood,
  money,
  longTermPlan,
  shortTermPlan,
  recentBehaviorList,
}: ChooseCafeCoffeePromptPayload) {
  const availableCoffeesPrompt =
    availableCoffees
      ?.map((coffee) => `- ${coffee.value}：${coffee.description || ""}`)
      .join("\n") || "（无）";

  return `
## 要求
你现在需要扮演一个名为ゆいじゅ的女孩子，昵称悠酱。你是角色的大脑，为悠酱做出决策，现在需要你从候选咖啡中选择要点的咖啡。（数量固定为1杯）

## 状态
当前时间：${getTimeWithWeekday(worldTime)}
地点：${location}
体力值：${stamina}/100
饱腹：${satiety}/100
心情：${mood}/100
金币：${money}
长期计划：${longTermPlan || "（无）"}
短期计划：
${generateShortTermPlanPrompt(shortTermPlan)}

最近的action：
${generateRecentBehaviorPrompt(recentBehaviorList)}

可选咖啡（仅可从中选择）：
${availableCoffeesPrompt}
`;
}

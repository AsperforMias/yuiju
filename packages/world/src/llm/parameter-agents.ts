import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { ActionContext, ActionId, ActionParameter, ParameterAgent } from '@/types/action';
import { InventoryItem, Shop, MajorScene } from '@/types/state';

// 创建 SiliconFlow 客户端
const siliconflow = createOpenAI({
  baseURL: 'https://api.siliconflow.cn/v1',
  apiKey: process.env.SILICONFLOW_API_KEY ?? '',
  name: 'Siliconflow',
});

/**
 * 模拟商店数据（与 llm-client.ts 保持一致）
 */
const SHOPS: Shop[] = [
  {
    name: '家附近的便利店',
    location: { major: MajorScene.Home },
    items: [
      { name: '苹果', category: 'food', price: 5, stamina: 15 },
      { name: '面包', category: 'food', price: 8, stamina: 25 },
      { name: '牛奶', category: 'food', price: 6, stamina: 12 },
      { name: '饼干', category: 'food', price: 4, stamina: 8 },
    ],
  },
  {
    name: '学校食堂',
    location: { major: MajorScene.School },
    items: [
      { name: '学校午餐', category: 'food', price: 12, stamina: 35 },
      { name: '三明治', category: 'food', price: 10, stamina: 20 },
      { name: '果汁', category: 'food', price: 7, stamina: 10 },
    ],
  },
];

/**
 * 根据位置获取商店信息
 */
async function getShopByLocation(location: { major: MajorScene }): Promise<Shop | null> {
  return SHOPS.find(shop => shop.location.major === location.major) || null;
}

/**
 * EatItem 参数 Agent
 * 负责智能选择要吃的食物
 */
export class EatItemParameterAgent implements ParameterAgent {
  actionId = ActionId.Eat_Item;

  /**
   * 获取当前可用的食物参数列表
   */
  async getAvailableParameters(context: ActionContext): Promise<ActionParameter[]> {
    const inventory = context.charactorState.inventory || [];
    const availableFood = inventory.filter(item => item.category === 'food' && item.quantity > 0);

    if (availableFood.length === 0) {
      throw new Error('背包中没有可用的食物');
    }

    return availableFood.map(food => ({
      value: food.name,
      description: `${food.name}可以恢复${food.stamina || 0}点体力（剩余${food.quantity}个）`,
      metadata: {
        stamina: food.stamina || 0,
        category: 'food',
        quantity: food.quantity,
      },
    }));
  }

  /**
   * 从可用食物中选择最佳选项
   * 考虑当前体力值、食物效果、时间等因素
   */
  async selectBestParameter(availableParameters: ActionParameter[], context: ActionContext): Promise<ActionParameter> {
    // 如果只有一个选择，直接返回
    if (availableParameters.length === 1) {
      return availableParameters[0];
    }

    // 多个选择时，调用 LLM 进行智能选择
    const prompt = `
你是悠酱，现在要选择吃什么食物。

当前状态：
- 体力：${context.charactorState.stamina}/100
- 时间：${context.worldState.time.format('HH:mm')}
- 位置：${context.charactorState.location.major}

可选食物：
${availableParameters.map((param, index) => `${index + 1}. ${param.description}`).join('\n')}

请选择最合适的食物。考虑因素：
- 当前体力值（体力越低越需要恢复效果好的食物）
- 时间（不同时间适合不同食物）
- 食物的恢复效果和数量

返回选择的食物索引（从1开始）和理由。
    `;

    try {
      const { output } = await generateText({
        model: siliconflow.chat('Qwen/Qwen3-8B'),
        output: Output.object({
          schema: z.object({
            selectedIndex: z.number().min(1).max(availableParameters.length).describe('选择的食物索引（从1开始）'),
            reason: z.string().describe('选择理由'),
          }),
        }),
        prompt,
      });

      const selectedParameter = availableParameters[output.selectedIndex - 1];
      console.log(`🍎 EatItem 子 Agent 选择: ${selectedParameter.value}, 理由: ${output.reason}`);

      return selectedParameter;
    } catch (error) {
      console.error('EatItem 子 Agent 选择失败，使用默认策略:', error);

      // 失败时使用默认策略：选择恢复体力最多的食物
      return availableParameters.reduce((best, current) => {
        const bestStamina = best.metadata?.stamina || 0;
        const currentStamina = current.metadata?.stamina || 0;
        return currentStamina > bestStamina ? current : best;
      });
    }
  }
}

/**
 * BuyItem 参数 Agent
 * 负责智能选择要购买的物品
 */
export class BuyItemParameterAgent implements ParameterAgent {
  actionId = ActionId.Buy_Item;

  /**
   * 获取当前可购买的物品参数列表
   */
  async getAvailableParameters(context: ActionContext): Promise<ActionParameter[]> {
    const location = context.charactorState.location;
    const shop = await getShopByLocation(location);
    const money = context.charactorState.money;

    if (!shop || !shop.items) {
      throw new Error('当前位置没有商店');
    }

    // 过滤买得起的物品
    const affordableItems = shop.items.filter(item => item.price <= money);

    if (affordableItems.length === 0) {
      throw new Error('没有买得起的物品');
    }

    return affordableItems.map(item => ({
      value: item.name,
      description: `${item.name}需要${item.price}金币${item.stamina ? `，恢复${item.stamina}体力` : ''}`,
      metadata: {
        price: item.price,
        category: item.category,
        stamina: item.stamina || 0,
        effect: item.effect || {},
      },
    }));
  }

  /**
   * 从可购买物品中选择最佳选项
   * 考虑当前需求、价格、效果等因素
   */
  async selectBestParameter(availableParameters: ActionParameter[], context: ActionContext): Promise<ActionParameter> {
    if (availableParameters.length === 1) {
      return availableParameters[0];
    }

    const prompt = `
你是悠酱，现在要选择购买什么物品。

当前状态：
- 金币：${context.charactorState.money}
- 体力：${context.charactorState.stamina}/100
- 时间：${context.worldState.time.format('HH:mm')}
- 背包：${JSON.stringify(context.charactorState.inventory || [])}

可购买物品：
${availableParameters.map((param, index) => `${index + 1}. ${param.description}`).join('\n')}

请选择最合适的物品。考虑因素：
- 当前需求（体力、食物等）
- 物品价值和价格比
- 背包空间和已有物品

返回选择的物品索引（从1开始）和理由。
    `;

    try {
      const { output } = await generateText({
        model: siliconflow.chat('Qwen/Qwen3-8B'),
        output: Output.object({
          schema: z.object({
            selectedIndex: z.number().min(1).max(availableParameters.length).describe('选择的物品索引（从1开始）'),
            reason: z.string().describe('选择理由'),
          }),
        }),
        prompt,
      });

      const selectedParameter = availableParameters[output.selectedIndex - 1];
      console.log(`🛒 BuyItem 子 Agent 选择: ${selectedParameter.value}, 理由: ${output.reason}`);

      return selectedParameter;
    } catch (error) {
      console.error('BuyItem 子 Agent 选择失败，使用默认策略:', error);

      // 失败时使用默认策略：选择最便宜的物品
      return availableParameters.reduce((cheapest, current) => {
        const cheapestPrice = cheapest.metadata?.price || Infinity;
        const currentPrice = current.metadata?.price || Infinity;
        return currentPrice < cheapestPrice ? current : cheapest;
      });
    }
  }
}

/**
 * 参数 Agent 注册表
 * 用于根据 ActionId 查找对应的参数 Agent
 */
export const parameterAgents: Record<string, ParameterAgent> = {
  [ActionId.Eat_Item]: new EatItemParameterAgent(),
  [ActionId.Buy_Item]: new BuyItemParameterAgent(),
};

/**
 * 获取指定 Action 的参数 Agent
 */
export function getParameterAgent(actionId: ActionId): ParameterAgent | undefined {
  return parameterAgents[actionId];
}

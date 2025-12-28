import 'dotenv/config';
import { chooseActionAgent } from '../llm/agent';
import { ActionId, ActionContext, ActionMetadata, ActionRecord } from '@/types/action';
import { ICharactorState, IWorldState, MajorScene, InventoryItem } from '@/types/state';
import dayjs from 'dayjs';

/**
 * Mock 角色状态
 * 实现了 ICharactorState 接口的基本方法
 */
class MockCharactorState implements ICharactorState {
  action: ActionId = ActionId.Idle;
  location = { major: MajorScene.Home };
  stamina = 100;
  money = 0;
  dailyActionsDoneToday: ActionId[] = [];
  longTermPlan?: string;
  shortTermPlan?: string[];
  inventory: InventoryItem[] = [];

  async setAction(action: ActionId): Promise<void> {
    this.action = action;
  }

  async setStamina(stamina: number): Promise<void> {
    this.stamina = Math.min(100, Math.max(0, stamina));
  }

  async changeStamina(delta: number): Promise<void> {
    this.stamina = Math.min(100, Math.max(0, this.stamina + delta));
  }

  async changeMoney(delta: number): Promise<void> {
    this.money += delta;
  }

  async markActionDoneToday(action: ActionId): Promise<void> {
    if (!this.dailyActionsDoneToday.includes(action)) {
      this.dailyActionsDoneToday.push(action);
    }
  }

  async clearDailyActions(): Promise<void> {
    this.dailyActionsDoneToday = [];
  }

  log() {
    return {
      action: this.action,
      location: this.location,
      stamina: this.stamina,
      money: this.money,
      dailyActionsDoneToday: this.dailyActionsDoneToday,
      longTermPlan: this.longTermPlan,
      shortTermPlan: this.shortTermPlan,
      inventory: this.inventory,
    };
  }

  async addItem(itemName: string, quantity: number = 1): Promise<void> {
    const existingItem = this.inventory.find(item => item.name === itemName);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      this.inventory.push({
        name: itemName,
        description: '',
        category: 'food',
        quantity,
        metadata: { stamina: 10 },
      });
    }
  }

  async consumeItem(itemName: string, quantity: number = 1): Promise<boolean> {
    const itemIndex = this.inventory.findIndex(item => item.name === itemName);
    if (itemIndex === -1) {
      return false;
    }

    const item = this.inventory[itemIndex];
    if (item.quantity < quantity) {
      return false;
    }

    item.quantity -= quantity;
    if (item.quantity === 0) {
      this.inventory.splice(itemIndex, 1);
    }

    return true;
  }

  getItemQuantity(itemName: string): number {
    const item = this.inventory.find(i => i.name === itemName);
    return item ? item.quantity : 0;
  }

  async setLongTermPlan(plan?: string): Promise<void> {
    this.longTermPlan = plan;
  }

  async setShortTermPlan(plans?: string[]): Promise<void> {
    this.shortTermPlan = plans;
  }
}

/**
 * Mock 世界状态
 * 实现了 IWorldState 接口的基本方法
 */
class MockWorldState implements IWorldState {
  time = dayjs();

  log() {
    return {
      time: this.time,
    };
  }

  async updateTime(newTime?: dayjs.Dayjs): Promise<void> {
    this.time = newTime || dayjs();
  }

  async reset(): Promise<void> {
    this.time = dayjs();
  }
}

/**
 * 定义可用的行为列表
 * 只包含 Eat_Item 和 Idle 两个行为
 */
const actionList: ActionMetadata[] = [
  {
    action: ActionId.Eat_Item,
    description: '吃指定食物恢复体力（可以调用 queryAvailableFood 查看可用食物）',
    precondition: async context => {
      const inventory = context.charactorState.inventory || [];
      const availableFood = inventory.filter(item => item.category === 'food' && item.quantity > 0);
      return availableFood.length > 0;
    },
    parameterAgent: async context => {
      const inventory = context.charactorState.inventory || [];
      const availableFood = inventory.filter(item => item.category === 'food' && item.quantity > 0);

      return availableFood.map(food => ({
        value: food.name,
        description: `${food.description}（剩余${food.quantity}个）`,
        extra: food.metadata,
      }));
    },
    async executor(context, parameters) {
      if (!parameters || parameters.length === 0) {
        throw new Error('没有可用的食物参数');
      }

      const selectedFood = parameters[0];
      await context.charactorState.setAction(ActionId.Eat_Item);
      const consumed = await context.charactorState.consumeItem(selectedFood.value, 1);
      if (!consumed) {
        console.error(`消费食物失败: ${selectedFood.value}`);
        return;
      }

      const stamina = selectedFood.extra?.stamina || 10;
      await context.charactorState.changeStamina(stamina);
      console.log(`吃了 ${selectedFood.value}，恢复了 ${stamina} 点体力`);
    },
    durationMin: 10,
  },
  {
    action: ActionId.Idle,
    description: '休息等待，可以在任何地点进行。需要给出等待多少分钟。',
    precondition: async () => true,
    async executor(context) {
      await context.charactorState.setAction(ActionId.Idle);
    },
    async durationMin(context, durationMinute) {
      return durationMinute ?? 10;
    },
  },
];

/**
 * 初始化角色状态
 * 设置低饥饿值和背包中的食物
 */
function initCharactorState(): ICharactorState {
  const charactorState = new MockCharactorState();

  // 设置低饥饿值，让模型倾向于选择吃东西
  charactorState.stamina = 10;

  // 设置位置
  charactorState.location = { major: MajorScene.Home };

  // 设置金钱
  charactorState.money = 100;

  // 设置计划
  charactorState.longTermPlan = '保持健康的生活状态';
  charactorState.shortTermPlan = ['恢复体力', '保持良好的精神状态'];

  // 添加食物到背包
  charactorState.inventory = [
    {
      name: '苹果',
      description: '新鲜的红苹果，可以恢复 15 点体力',
      category: 'food',
      quantity: 3,
      metadata: { stamina: 15 },
    },
    {
      name: '面包',
      description: '松软的面包，可以恢复 25 点体力',
      category: 'food',
      quantity: 2,
      metadata: { stamina: 25 },
    },
    {
      name: '能量饮料',
      description: '功能饮料，可以恢复 35 点体力',
      category: 'food',
      quantity: 1,
      metadata: { stamina: 35 },
    },
  ];

  return charactorState;
}

/**
 * 初始化世界状态
 */
function initWorldState(): IWorldState {
  const worldState = new MockWorldState();

  // 设置时间为上午 10 点
  worldState.time = dayjs().hour(10).minute(0).second(0);

  return worldState;
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('=== 开始 chooseActionAgent Demo ===\n');

    // 初始化角色状态
    const charactorState = initCharactorState();

    // 初始化世界状态
    const worldState = initWorldState();
    console.log('世界状态初始化完成:');
    console.log(`  - 时间: ${worldState.time.format('YYYY-MM-DD HH:mm:ss')}`);
    console.log();

    // 创建行为上下文
    const context: ActionContext = {
      charactorState,
      worldState,
    };

    // 创建空的行为历史记录
    const actionMemoryList: ActionRecord[] = [];

    // 显示可用行为列表
    console.log('可用行为列表:');
    actionList.forEach(action => {
      console.log(`  - ${action.action}: ${action.description}`);
    });
    console.log();

    // 调用 chooseActionAgent
    console.log('=== 调用 chooseActionAgent ===');
    console.log('等待模型决策...\n');

    const result = await chooseActionAgent(actionList, context, actionMemoryList);

    console.log('\n=== 决策结果 ===');
    if (result) {
      console.log(`选择的行为: ${result.action}`);
      console.log(`选择理由: ${result.reason}`);
      console.log(`持续时间: ${result.durationMinute ?? '未指定'} 分钟`);
      if (result.updateShortTermPlan) {
        console.log(`更新短期计划: ${result.updateShortTermPlan.join(', ')}`);
      }
      if (result.updateLongTermPlan) {
        console.log(`更新长期计划: ${result.updateLongTermPlan}`);
      }
    } else {
      console.log('决策失败');
    }

    console.log('\n=== Demo 结束 ===');
  } catch (error) {
    console.error('Demo 执行出错:', error);
  }
}

// 运行主函数
main();

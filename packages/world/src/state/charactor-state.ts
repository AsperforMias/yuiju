import { getRedis, REDIS_KEY_CHARACTER_STATE } from "@yuiju/utils";
import { cloneDeep } from "lodash-es";
import { ActionId } from "@/types/action";
import {
  type CharacterStateData,
  type ICharacterState,
  type InventoryItem,
  type Location,
  MajorScene,
} from "@/types/state";

const MAX_STAMINA = 100;

export class CharacterState implements ICharacterState {
  private static instance: CharacterState | null = null;

  public action: ActionId = ActionId.Idle;
  public location: Location = { major: MajorScene.Home };
  public stamina: number = 100;
  public money: number = 0;
  // 仅作内存缓存或只读展示，实际数据源为 Redis String (JSON)
  public dailyActionsDoneToday: ActionId[] = [];
  /** 长期计划（一句话描述） */
  public longTermPlan: string | undefined;
  /** 短期计划（步骤列表） */
  public shortTermPlan: string[] | undefined;
  /** 背包物品列表 */
  public inventory: InventoryItem[] = [];

  static getInstance() {
    if (!CharacterState.instance) CharacterState.instance = new CharacterState();
    return CharacterState.instance;
  }

  // 从 Redis 加载状态到内存（初始化时或定期同步）
  async load() {
    const redis = getRedis();
    const data = await redis.hgetall(REDIS_KEY_CHARACTER_STATE);
    if (Object.keys(data).length > 0) {
      if (data.action) this.action = data.action as ActionId;
      if (data.location) {
        try {
          this.location = JSON.parse(data.location);
        } catch (e) {
          console.error("Failed to parse location:", e);
        }
      }
      if (data.stamina) this.stamina = Number.parseInt(data.stamina, 10);
      if (data.money) this.money = Number.parseInt(data.money, 10);
      if (data.dailyActionsDoneToday) {
        try {
          this.dailyActionsDoneToday = JSON.parse(data.dailyActionsDoneToday);
        } catch (e) {
          console.error("Failed to parse daily actions:", e);
          this.dailyActionsDoneToday = [];
        }
      }
      if (data.longTermPlan) {
        this.longTermPlan = data.longTermPlan;
      }
      if (data.shortTermPlan) {
        try {
          this.shortTermPlan = JSON.parse(data.shortTermPlan);
        } catch (e) {
          console.error("Failed to parse short term plan:", e);
          this.shortTermPlan = [];
        }
      }
      if (data.inventory) {
        try {
          this.inventory = JSON.parse(data.inventory);
        } catch (e) {
          console.error("Failed to parse inventory:", e);
          this.inventory = [];
        }
      }
    } else {
      // Redis 为空，写入初始值
      await this.save();
    }
  }

  async save() {
    const redis = getRedis();
    await redis.hset(REDIS_KEY_CHARACTER_STATE, {
      action: this.action,
      location: JSON.stringify(this.location),
      stamina: this.stamina,
      money: this.money,
      dailyActionsDoneToday: JSON.stringify(this.dailyActionsDoneToday),
      longTermPlan: this.longTermPlan || "",
      shortTermPlan: JSON.stringify(this.shortTermPlan || []),
      inventory: JSON.stringify(this.inventory),
    });
  }

  async setAction(action: ActionId) {
    this.action = action;
    await this.save();
  }

  async setStamina(stamina: number) {
    this.stamina = Math.min(MAX_STAMINA, Math.max(0, stamina));
    await this.save();
  }

  async changeStamina(delta: number) {
    this.stamina = Math.min(MAX_STAMINA, Math.max(0, this.stamina + delta));
    await this.save();
  }

  async setMoney(money: number) {
    this.money = Math.max(0, money);
    await this.save();
  }

  async changeMoney(delta: number) {
    this.money = Math.max(0, this.money + delta);

    await this.save();
  }

  async markActionDoneToday(action: ActionId): Promise<void> {
    // 优先更新内存（不再依赖 Redis 结果）
    if (!this.dailyActionsDoneToday.includes(action)) {
      this.dailyActionsDoneToday.push(action);
    }

    this.save();
  }

  async clearDailyActions(): Promise<void> {
    this.dailyActionsDoneToday = [];
    await this.save();
  }

  async setLongTermPlan(plan?: string): Promise<void> {
    this.longTermPlan = plan;
    await this.save();
  }

  async setShortTermPlan(plan?: string[]): Promise<void> {
    this.shortTermPlan = plan;
    await this.save();
  }

  /**
   * 添加物品到背包
   * 如果物品已存在，增加数量；否则创建新物品
   */
  async addItem(itemName: string, quantity: number = 1): Promise<void> {
    const existingItem = this.inventory.find((item) => item.name === itemName);

    if (existingItem) {
      // 物品已存在，增加数量
      existingItem.quantity += quantity;
    } else {
    }

    await this.save();
  }

  /**
   * 消费背包中的物品
   * 返回是否成功消费
   */
  async consumeItem(itemName: string, quantity: number = 1): Promise<boolean> {
    const item = this.inventory.find((item) => item.name === itemName);

    if (!item || item.quantity < quantity) {
      return false; // 物品不存在或数量不足
    }

    item.quantity -= quantity;

    // 如果数量为0，从背包中移除
    if (item.quantity <= 0) {
      const index = this.inventory.indexOf(item);
      this.inventory.splice(index, 1);
    }

    await this.save();
    return true;
  }

  /**
   * 获取背包中指定物品的数量
   */
  getItemQuantity(itemName: string): number {
    const item = this.inventory.find((item) => item.name === itemName);
    return item ? item.quantity : 0;
  }

  public log(): CharacterStateData {
    return cloneDeep({
      action: this.action,
      location: this.location,
      stamina: this.stamina,
      money: this.money,
      dailyActionsDoneToday: this.dailyActionsDoneToday,
      longTermPlan: this.longTermPlan,
      shortTermPlan: this.shortTermPlan,
      inventory: this.inventory,
    });
  }
}

export const characterState = CharacterState.getInstance();

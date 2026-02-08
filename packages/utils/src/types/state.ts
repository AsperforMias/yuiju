import type { Dayjs } from "dayjs";
import type { ActionId } from "./action";

// 大场景
export enum MajorScene {
  Home = "家",
  School = "学校",
  Shop = "商店",
  Cafe = "咖啡店",
}

// 家的小场景
export enum HomeSubScene {
  House = "house",
}

// 学校的小场景
export enum SchoolSubScene {}

// 商店的小场景（预留）
export enum ShopSubScene {}

// 位置类型（判别联合）
export type Location =
  | { major: MajorScene.Home; minor?: HomeSubScene }
  | { major: MajorScene.School; minor?: SchoolSubScene }
  | { major: MajorScene.Shop; minor?: ShopSubScene }
  | { major: MajorScene.Cafe; minor?: undefined };

/**
 * 食物元数据
 */
export interface FoodMetadata {
  /** 体力恢复值 */
  stamina: number;
  /** 饱腹度恢复值 */
  satiety?: number;
}

/**
 * @description 预留
 * 材料元数据
 */
export type MaterialMetadata = {};

/**
 * 物品接口（判别联合类型）
 */
export type InventoryItem = {
  /** 物品名称 */
  name: string;
  /** 物品描述 */
  description: string;
  /** 物品类别 */
  category: "food" | "material";
  /** 数量 */
  quantity: number;
  /** 食物元数据 */
  metadata: FoodMetadata | MaterialMetadata;
};

export interface CharacterStateData {
  action: ActionId;
  location: Location;
  /**体力值 */
  stamina: number;
  satiety: number;
  mood: number;
  /** 金钱 */
  money: number;
  /** 今日已执行的动作列表 */
  dailyActionsDoneToday: ActionId[];
  /** 长期计划（一句话描述） */
  longTermPlan?: string;
  /** 短期计划（步骤列表） */
  shortTermPlan?: string[];
  /** 背包物品列表 */
  inventory?: InventoryItem[];
}

export interface ICharacterState extends CharacterStateData {
  setAction(action: ActionId): Promise<void>;
  /** 设置体力值 */
  setStamina(stamina: number): Promise<void>;
  setSatiety(satiety: number): Promise<void>;
  setMood(mood: number): Promise<void>;
  setLocation(location: Location): Promise<void>;
  /** 改变体力值 */
  changeStamina(delta: number): Promise<void>;
  changeSatiety(delta: number): Promise<void>;
  changeMood(delta: number): Promise<void>;
  /** 改变金钱 */
  changeMoney(delta: number): Promise<void>;
  /** 标记该动作已在今天执行 */
  markActionDoneToday(action: ActionId): Promise<void>;
  /** 清空今日动作 */
  clearDailyActions(): Promise<void>;
  /** 获取状态日志（深拷贝） */
  log(): CharacterStateData;

  /** 背包管理方法 */
  /** 添加物品到背包 */
  addItem(item: Omit<InventoryItem, "quantity">, quantity?: number): Promise<void>;
  /** 消费背包中的物品 */
  consumeItem(itemName: string, quantity?: number): Promise<boolean>;
  /** 获取背包中指定物品的数量 */
  getItemQuantity(itemName: string): number;
  /** 更新长期计划 */
  setLongTermPlan(plan?: string): Promise<void>;
  /** 更新短期计划 */
  setShortTermPlan(plans?: string[]): Promise<void>;
}

export interface WorldStateData {
  time: Dayjs;
}

export interface IWorldState extends WorldStateData {
  log(): WorldStateData;
  updateTime(newTime?: Dayjs): Promise<void>;
  reset(): Promise<void>;
}

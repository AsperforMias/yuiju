import { Dayjs } from 'dayjs';
import { ActionId } from './action';

// 大场景
export enum MajorScene {
  Home = 'home',
  School = 'school',
}

// 家的小场景
export enum HomeSubScene {
  House = 'house',
}

// 学校的小场景
export enum SchoolSubScene {}

// 位置类型（判别联合）
export type Location =
  | { major: MajorScene.Home; minor?: HomeSubScene }
  | { major: MajorScene.School; minor?: SchoolSubScene };

/**
 * 物品接口
 */
export interface InventoryItem {
  /** 物品名称 */
  name: string;
  /** 物品描述 */
  description?: string;
  /** 物品类别 */
  category: 'food' | 'material';
  /** 数量 */
  quantity: number;
  /** 体力恢复值（仅食物有效） */
  stamina?: number;
  /** 价格 */
  price?: number;
  /** 其他效果 */
  effect?: Record<string, any>;
}

/**
 * 商店物品接口
 */
export interface ShopItem {
  /** 物品名称 */
  name: string;
  /** 物品类别 */
  category: 'food' | 'tool' | 'material' | 'other';
  /** 价格 */
  price: number;
  /** 体力恢复值（仅食物有效） */
  stamina?: number;
  /** 其他效果 */
  effect?: Record<string, any>;
}

/**
 * 商店接口
 */
export interface Shop {
  /** 商店名称 */
  name: string;
  /** 商店位置 */
  location: Location;
  /** 可购买的物品列表 */
  items: ShopItem[];
}

export interface CharactorStateData {
  action: ActionId;
  location: Location;
  /**体力值 */
  stamina: number;
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

export interface ICharactorState extends CharactorStateData {
  setAction(action: ActionId): Promise<void>;
  /** 设置体力值 */
  setStamina(stamina: number): Promise<void>;
  /** 改变体力值 */
  changeStamina(delta: number): Promise<void>;
  /** 改变金钱 */
  changeMoney(delta: number): Promise<void>;
  /** 标记该动作已在今天执行 */
  markActionDoneToday(action: ActionId): Promise<void>;
  /** 清空今日动作 */
  clearDailyActions(): Promise<void>;
  /** 获取状态日志（深拷贝） */
  log(): CharactorStateData;

  /** 背包管理方法 */
  /** 添加物品到背包 */
  addItem(itemName: string, quantity?: number): Promise<void>;
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

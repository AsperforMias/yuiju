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
}

export interface WorldStateData {
  time: Dayjs;
}

export interface IWorldState extends WorldStateData {
  log(): WorldStateData;
  updateTime(newTime?: Dayjs): Promise<void>;
  reset(): Promise<void>;
}

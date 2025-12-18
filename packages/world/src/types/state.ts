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
}

export interface ICharactorState extends CharactorStateData {
  setAction(action: ActionId): void;
  /** 设置体力值 */
  setStamina(stamina: number): void;
  /** 改变体力值 */
  changeStamina(delta: number): void;
  /** 改变金钱 */
  changeMoney(delta: number): void;
  /** 是否已在今天执行该动作 */
  hasActionDoneToday(action: ActionId): boolean;
  /** 标记该动作已在今天执行 */
  markActionDoneToday(action: ActionId): void;
  /** 清空今日动作 */
  clearDailyActions(): void;
  /** 获取状态日志（深拷贝） */
  log(): CharactorStateData;
}

export interface WorldStateData {
  time: Dayjs;
}

export interface IWorldState extends WorldStateData {
  log(): WorldStateData;
}

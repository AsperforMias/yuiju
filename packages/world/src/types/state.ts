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

export interface ICharactorState {
  action: ActionId;
  location: Location;
  /**体力值 */
  stamina: number;
  /** 金钱 */
  money: number;

  setAction(action: ActionId): void;
  /** 设置体力值 */
  setStamina(stamina: number): void;
  /** 改变体力值 */
  changeStamina(delta: number): void;
  /** 改变金钱 */
  changeMoney(delta: number): void;
}

export interface IWorldState {
  time: Dayjs;
}

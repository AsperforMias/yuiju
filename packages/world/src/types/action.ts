import { ICharactorState, IWorldState } from './state';

export enum ActionId {
  /** 起床 */
  Wake_Up = 'wake_up',
  /** 再睡一会 */
  Sleep_For_A_Little = 'sleep_for_a_little',
  /** 吃早餐 */
  Eat_Breakfast = 'eat_breakfast',
  /** 去学校 */
  Go_To_School = 'go_to_school',
  /** 呆在家里 */
  Stay_At_Home = 'stay_at_home',
  /** 吃晚餐 */
  Eat_Dinner = 'eat_dinner',
  /** 睡觉 */
  Sleep = 'sleep',

  /** 吃午餐 */
  Eat_Lunch = 'eat_lunch',

  /** 在学校学习 */
  Study_At_School = 'study_at_school',
  /** 放学回家 */
  Go_Home_From_School = 'go_home_from_school',

  /** 空闲/发呆 */
  Idle = 'idle',
}

export interface ActionContext {
  charactorState: ICharactorState;
  worldState: IWorldState;
  eventDescription?: string;
}

export interface ActionMetadata {
  action: ActionId;
  /** action 描述 */
  description: string;
  /** 前置条件 */
  precondition: (context: ActionContext) => boolean | Promise<boolean>;
  executor: (context: ActionContext) => void | Promise<void>;
  /** 行动耗时 min。*/
  durationMin: number | ((context: ActionContext, llmDurationMin?: number) => Promise<number>);

  /**
   * Action 结束时产生的事件描述。
   * 该描述将作为事件 context 输入给下一次 tick 的 LLM，用于说明上一个动作结束时的状态或发生的事件。
   * 示例："闹钟响了，该起床了" 或 (ctx) => `你结束了${ctx.action}，感觉焕然一新`
   */
  completionEvent?: string | ((context: ActionContext) => string | Promise<string>);
}

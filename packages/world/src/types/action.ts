import { ICharactorState, IWorldState } from './state';

export enum ActionId {
  Wake_Up = 'wake_up',
  Eat_Breakfast = 'eat_breakfast',
  Go_To_School = 'go_to_school',
  Stay_At_Home = 'stay_at_home',
  Eat_Dinner = 'eat_dinner',
  Sleep = 'sleep',

  Eat_Lunch = 'eat_lunch',

  Study_At_School = 'study_at_school',
  Go_Home_From_School = 'go_home_from_school',

  Idle = 'idle',
}

export interface ActionContext {
  charactorState: ICharactorState;
  worldState: IWorldState;
}

export interface ActionMetadata {
  action: ActionId;
  /** action 描述 */
  description: string;
  /** 前置条件 */
  precondition: (context: ActionContext) => boolean | Promise<boolean>;
  executor: (context: ActionContext) => void | Promise<void>;
  /** 行动耗时 min。*/
  durationMin: number;
  /** 是否由 LLM 决定行动耗时 */
  useLLMDuration?: boolean;
}

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

  /** 吃指定食物 */
  Eat_Item = 'eat_item',
  /** 购买物品 */
  Buy_Item = 'buy_item',
}

export interface ActionContext {
  charactorState: ICharactorState;
  worldState: IWorldState;
  eventDescription?: string;
}

/**
 * Action 参数接口
 * 用于参数化行为的具体参数定义
 */
export interface ActionParameter {
  /** 参数值，如："苹果" */
  value: string;
  /** 参数描述，如："苹果可以恢复10点体力" */
  description: string;
  /** 额外信息，如：{ price: 5, stamina: 20 } */
  extra?: Record<string, any>;
}

/**
 * 参数选择 Agent 接口
 * 每种参数化行为都需要实现此接口
 */
export interface ParameterAgent {
  /** 对应的 Action ID */
  actionId: ActionId;
  /** 获取当前可用的参数列表 */
  getAvailableParameters: (context: ActionContext) => Promise<ActionParameter[]>;
  /** 从可用参数中选择最佳参数 */
  selectBestParameter: (availableParameters: ActionParameter[], context: ActionContext) => Promise<ActionParameter>;
}

/**
 * Action 决策结果
 */
export interface ActionAgentDecision {
  action: ActionId;
  reason: string;
  durationMinute?: number;
  updateShortTermPlan?: string[];
  updateLongTermPlan?: string;
}

export interface ParameterAgentDecision {
  selectedList: string[];
  reason: string;
}

export interface ActionMetadata {
  action: ActionId;
  /** action 描述 */
  description: string;
  /** 前置条件 */
  precondition: (context: ActionContext) => boolean | Promise<boolean>;

  /** 参数选择 Agent（可选，用于参数化行为） */
  parameterAgent?: (context: ActionContext) => Promise<ActionParameter[]>;

  /** 执行器，支持接收参数 */
  executor: (context: ActionContext, parameters?: ActionParameter[]) => void | Promise<void>;

  /** 行动耗时 min，支持参数化计算 */
  durationMin:
    | number
    | ((context: ActionContext, llmDurationMin?: number, parameters?: ActionParameter[]) => Promise<number>);

  /**
   * Action 结束时产生的事件描述。
   * 该描述将作为事件 context 输入给下一次 tick 的 LLM，用于说明上一个动作结束时的状态或发生的事件。
   * 示例："闹钟响了，该起床了" 或 (ctx) => `你结束了${ctx.action}，感觉焕然一新`
   */
  completionEvent?: string | ((context: ActionContext, parameters?: ActionParameter[]) => string | Promise<string>);
}

export interface ActionRecord {
  action: ActionId;
  reason: string;
  timestamp: number;
}

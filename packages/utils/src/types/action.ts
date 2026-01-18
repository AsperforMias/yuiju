import type { ICharacterState, IWorldState } from "./state";

export enum ActionId {
  /** 起床 */
  Wake_Up = "起床",
  /** 再睡一会 */
  Sleep_For_A_Little = "再睡一会",
  /** 吃早餐 */
  Eat_Breakfast = "吃早餐",
  /** 去学校 */
  Go_To_School_From_Home = "从家去学校",
  /** 待在家里 */
  Stay_At_Home = "待在家里",
  /** 吃晚餐 */
  Eat_Dinner = "吃晚餐",
  /** 睡觉 */
  Sleep = "睡觉",

  /** 吃午餐 */
  Eat_Lunch = "吃午餐",

  /** 在学校学习 */
  Study_At_School = "在学校学习",
  /** 放学回家 */
  Go_Home_From_School = "放学回家",

  /** 空闲/发呆 */
  Idle = "发呆",

  /** 吃指定食物 */
  Eat_Item = "吃东西",
  /** 在家前往商店 */
  Go_To_Shop_From_Home = "从家去商店",
  /** 在学校前往商店 */
  Go_To_Shop_From_School = "从学校去商店",
  /** 从商店回家 */
  Go_Home_From_Shop = "从商店回家",
  /** 从商店去学校 */
  Go_To_School_From_Shop = "从商店去学校",

  /** 在商店购买物品 */
  Buy_Item_At_Shop = "在商店购买物品",
}

export interface ActionContext {
  characterState: ICharacterState;
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
  /** 数量，默认为 1 */
  quantity?: number;
  /** 参数描述，如："苹果可以恢复10点体力" */
  description?: string;
  /** 参数决策原因，如："需要恢复体力" */
  reason?: string;
  /** 额外信息，如：{ price: 5, stamina: 20 } */
  extra?: Record<string, any>;
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
  selectedList: Array<{
    value: string;
    quantity: number;
    reason: string;
  }>;
}

export interface ActionMetadata {
  action: ActionId;
  /** action 描述 */
  description: string;
  /** 前置条件 */
  precondition: (context: ActionContext) => boolean | Promise<boolean>;

  /** 参数选择 Agent（可选，用于参数化行为） */
  parameterResolver?: (context: ActionContext) => Promise<ActionParameter[]>;

  /** 执行器，支持接收参数 */
  executor: (context: ActionContext, parameters?: ActionParameter[]) => void | Promise<void>;

  /** 行动耗时 min，支持参数化计算 */
  durationMin:
    | number
    | ((
        context: ActionContext,
        llmDurationMin?: number,
        parameters?: ActionParameter[],
      ) => Promise<number>);

  /**
   * Action 结束时产生的事件描述。
   * 该描述将作为事件 context 输入给下一次 tick 的 LLM，用于说明上一个动作结束时的状态或发生的事件。
   * 示例："闹钟响了，该起床了" 或 (ctx) => `你结束了${ctx.action}，感觉焕然一新`
   */
  completionEvent?:
    | string
    | ((context: ActionContext, parameters?: ActionParameter[]) => string | Promise<string>);
}

export interface BehaviorRecord {
  behavior: ActionId; // 改为 behavior，与数据库字段一致
  description: string; // 改为 description
  timestamp: number;
  parameters?: ActionParameter[];
}

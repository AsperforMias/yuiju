import Redis from 'ioredis';
import { type Tool } from 'ai';
import { z } from 'zod';
import { getRedis } from '../redis';
import { isDev } from '../env';

/**
 * 计划类型枚举
 * - long: 长期计划
 * - short: 短期计划
 */
export type PlanType = 'long' | 'short';

/**
 * 所有计划查询结果接口
 */
export interface AllPlansResponse {
  longTerm: string | null;
  shortTerm: string | null;
}

/**
 * 工具响应格式接口
 * 用于统一所有工具函数的返回格式
 */
export interface ToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 计划管理工具核心接口
 * 定义了计划管理的所有基础操作
 */
export interface PlanManagementTool {
  /**
   * 设置或更新计划
   * @param type 计划类型（long/short）
   * @param content 计划内容，空字符串表示清空计划
   * @returns 操作是否成功
   */
  setPlan(type: PlanType, content: string): Promise<boolean>;

  /**
   * 获取指定类型的计划
   * @param type 计划类型（long/short）
   * @returns 计划内容，不存在时返回null
   */
  getPlan(type: PlanType): Promise<string | null>;

  /**
   * 获取所有计划
   * @returns 包含长期和短期计划的对象
   */
  getAllPlans(): Promise<AllPlansResponse>;
}

/**
 * Redis存储key常量
 * 根据环境自动添加前缀以区分开发和生产环境
 */
export const REDIS_KEYS = {
  LONG_TERM_PLAN: isDev ? 'dev:yuiju:plan:long' : 'yuiju:plan:long',
  SHORT_TERM_PLAN: isDev ? 'dev:yuiju:plan:short' : 'yuiju:plan:short',
} as const;

/**
 * 错误消息常量
 */
export const ERROR_MESSAGES = {
  REDIS_CONNECTION_FAILED: 'Redis连接失败',
  INVALID_PLAN_TYPE: '无效的计划类型',
  PLAN_SET_FAILED: '计划设置失败',
  PLAN_GET_FAILED: '计划获取失败',
} as const;

/**
 * 默认配置常量
 */
export const DEFAULT_CONFIG = {
  REDIS_TTL: -1, // 不设置过期时间，永久存储
} as const;

/**
 * 获取Redis客户端实例
 * 复用utils包中的Redis连接配置
 * @returns Redis客户端实例
 */
export const getPlanRedisClient = (): Redis => {
  return getRedis();
};

/**
 * 根据计划类型获取对应的Redis key
 * @param type 计划类型
 * @returns Redis存储key
 */
export const getPlanRedisKey = (type: PlanType): string => {
  switch (type) {
    case 'long':
      return REDIS_KEYS.LONG_TERM_PLAN;
    case 'short':
      return REDIS_KEYS.SHORT_TERM_PLAN;
    default:
      throw new Error(ERROR_MESSAGES.INVALID_PLAN_TYPE);
  }
};

/**
 * 验证计划类型是否有效
 * @param type 待验证的计划类型
 * @returns 是否为有效的计划类型
 */
export const isValidPlanType = (type: string): type is PlanType => {
  return type === 'long' || type === 'short';
};

/**
 * 设置或更新计划
 * 如果内容为空字符串，则清空对应的计划
 * @param type 计划类型（long/short）
 * @param content 计划内容，空字符串表示清空计划
 * @returns 操作是否成功
 */
export const setPlan = async (type: PlanType, content: string): Promise<boolean> => {
  try {
    // 获取Redis客户端实例
    const redis = getPlanRedisClient();
    
    // 获取对应的Redis key
    const redisKey = getPlanRedisKey(type);
    
    // 如果内容为空字符串，删除该计划
    if (content === '') {
      await redis.del(redisKey);
      return true;
    }
    
    // 设置计划内容，不设置过期时间（永久存储）
    await redis.set(redisKey, content);
    return true;
    
  } catch (error) {
    // 记录错误但不抛出，确保不中断主流程
    console.error(`${ERROR_MESSAGES.PLAN_SET_FAILED}: ${error}`);
    return false;
  }
};

/**
 * 获取指定类型的计划
 * @param type 计划类型（long/short）
 * @returns 计划内容，不存在时返回null
 */
export const getPlan = async (type: PlanType): Promise<string | null> => {
  try {
    // 获取Redis客户端实例
    const redis = getPlanRedisClient();
    
    // 获取对应的Redis key
    const redisKey = getPlanRedisKey(type);
    
    // 查询计划内容
    const content = await redis.get(redisKey);
    
    // Redis GET 返回 null 表示 key 不存在
    return content;
    
  } catch (error) {
    // 记录错误但不抛出，返回null表示获取失败
    console.error(`${ERROR_MESSAGES.PLAN_GET_FAILED}: ${error}`);
    return null;
  }
};

/**
 * 获取所有计划（长期和短期）
 * 使用批量查询优化性能
 * @returns 包含长期和短期计划的对象
 */
export const getAllPlans = async (): Promise<AllPlansResponse> => {
  try {
    // 获取Redis客户端实例
    const redis = getPlanRedisClient();
    
    // 获取两个计划的Redis key
    const longTermKey = getPlanRedisKey('long');
    const shortTermKey = getPlanRedisKey('short');
    
    // 使用MGET批量获取两个计划，提高性能
    const [longTerm, shortTerm] = await redis.mget(longTermKey, shortTermKey);
    
    // 构造返回对象
    return {
      longTerm,
      shortTerm,
    };
    
  } catch (error) {
    // 记录错误但不抛出，返回空对象确保不中断主流程
    console.error(`${ERROR_MESSAGES.PLAN_GET_FAILED}: ${error}`);
    return {
      longTerm: null,
      shortTerm: null,
    };
  }
};

// ==================== Vercel AI SDK 工具定义 ====================

/**
 * 设置计划工具
 * 用于设置或更新长期计划或短期计划
 * 如果内容为空字符串则清空该计划
 */
export const setPlanTool: Tool = {
  name: 'set_plan',
  description: '设置或更新长期计划或短期计划。如果内容为空字符串则清空该计划。',
  inputSchema: z.object({
    type: z.enum(['long', 'short']).describe('计划类型：long（长期计划）或 short（短期计划）'),
    content: z.string().describe('计划内容，如果为空字符串则清空该计划')
  }),
  execute: async ({ type, content }) => {
    try {
      // 调用核心设置计划功能
      const success = await setPlan(type, content);
      
      if (success) {
        // 根据操作类型返回不同的成功消息
        const action = content === '' ? '清空' : '设置';
        const planTypeText = type === 'long' ? '长期计划' : '短期计划';
        
        return {
          success: true,
          message: `成功${action}${planTypeText}`,
          type,
          content: content === '' ? null : content
        };
      } else {
        return {
          success: false,
          error: '计划设置失败，请稍后重试'
        };
      }
    } catch (error) {
      // 捕获任何未预期的错误
      console.error('setPlanTool执行错误:', error);
      return {
        success: false,
        error: '计划设置过程中发生错误'
      };
    }
  }
};
/**
 * 获取计划工具
 * 用于查询指定类型的计划内容
 */
export const getPlanTool: Tool = {
  name: 'get_plan',
  description: '获取指定类型的计划内容（长期计划或短期计划）',
  inputSchema: z.object({
    type: z.enum(['long', 'short']).describe('计划类型：long（长期计划）或 short（短期计划）')
  }),
  execute: async ({ type }) => {
    try {
      // 调用核心获取计划功能
      const content = await getPlan(type);
      const planTypeText = type === 'long' ? '长期计划' : '短期计划';
      
      if (content !== null) {
        return {
          success: true,
          type,
          content,
          message: `成功获取${planTypeText}`
        };
      } else {
        return {
          success: true,
          type,
          content: null,
          message: `${planTypeText}暂未设置`
        };
      }
    } catch (error) {
      // 捕获任何未预期的错误
      console.error('getPlanTool执行错误:', error);
      const planTypeText = type === 'long' ? '长期计划' : '短期计划';
      return {
        success: false,
        error: `获取${planTypeText}时发生错误`
      };
    }
  }
};
/**
 * 获取所有计划工具
 * 用于同时查询长期计划和短期计划
 */
export const getAllPlansTool: Tool = {
  name: 'get_all_plans',
  description: '获取所有计划内容，包括长期计划和短期计划',
  inputSchema: z.object({}), // 无需参数
  execute: async () => {
    try {
      // 调用核心获取所有计划功能
      const plans = await getAllPlans();
      
      return {
        success: true,
        data: {
          longTerm: plans.longTerm,
          shortTerm: plans.shortTerm
        },
        message: '成功获取所有计划',
        summary: {
          hasLongTerm: plans.longTerm !== null,
          hasShortTerm: plans.shortTerm !== null,
          totalPlans: (plans.longTerm !== null ? 1 : 0) + (plans.shortTerm !== null ? 1 : 0)
        }
      };
    } catch (error) {
      // 捕获任何未预期的错误
      console.error('getAllPlansTool执行错误:', error);
      return {
        success: false,
        error: '获取计划列表时发生错误',
        data: {
          longTerm: null,
          shortTerm: null
        }
      };
    }
  }
};
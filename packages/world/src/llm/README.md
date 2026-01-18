# LLM 模块

## 模块概述

负责与 LLM 交互，实现行为决策和参数选择。使用 Vercel AI SDK 构建多 Agent 协作系统，支持行为选择 Agent 和参数化 Agent。

## 文件结构

```
llm/
├── coordinator.ts    # 决策协调器，协调整个决策流程
├── agent.ts          # Agent 实现（chooseActionAgent、chooseFoodAgent 等）
├── tools.ts          # LLM 工具函数（如 queryAvailableFood）
└── utils.ts          # 模型配置和中间件
```

## 核心概念

### 决策协调器

[coordinator.ts:23-83](coordinator.ts#L23-L83) 的 `coordinatorAgent()` 函数协调整个决策流程：

1. **调用行为选择 Agent** - 使用 `chooseActionAgent` 选择要执行的行为
2. **检查是否需要参数** - 查找 `Action2ParameterAgentMap` 判断是否为参数化行为
3. **解析参数列表** - 调用行为的 `parameterResolver` 获取可用参数
4. **调用参数选择 Agent** - 如果需要参数，调用对应的参数 Agent
5. **合并参数信息** - 将 LLM 选择的参数与参数列表合并，返回完整信息

### 行为选择 Agent

[agent.ts:19-80](agent.ts#L19-L80) 的 `chooseActionAgent()` 实现行为选择：

- **模型**：DeepSeek Reasoner（支持推理）
- **输入**：可用行为列表、角色状态、世界状态、历史记录、计划
- **输出**：选中的行为 ID、决策原因、持续时间、计划更新
- **工具**：`queryAvailableFood` - 查询背包中的食物
- **重试机制**：失败时最多重试 3 次

### 参数选择 Agent

[agent.ts:82-132](agent.ts#L82-L132) 的 `chooseFoodAgent()` 实现食物参数选择：

- **模型**：Qwen3-8B（通过 SiliconFlow）
- **输入**：可用食物列表、角色状态、世界时间、计划、历史记录
- **输出**：选择的食物列表（包含 value、quantity、reason）
- **重试机制**：失败时最多重试 3 次

### LLM 工具

[tools.ts:5-28](tools.ts#L5-L28) 定义了 LLM 可以调用的工具：

- `queryAvailableFood` - 查询当前背包中的食物列表，返回食物名称、描述和剩余数量

工具使用 Vercel AI SDK 的 `tool()` 函数定义，可以在 Agent 调用时被 LLM 主动调用。

### 模型配置

[utils.ts](utils.ts) 配置了使用的 LLM 模型：

- **model_deepseek_reasoner** - DeepSeek Reasoner，用于行为选择（支持推理）
- **model_qwen3_8B** - Qwen3-8B（通过 SiliconFlow），用于参数选择
- **logMiddleware** - 日志中间件，记录 LLM 的输出内容

### Agent 映射

[coordinator.ts:12-21](coordinator.ts#L12-L21) 定义了行为到参数 Agent 的映射：

```typescript
const Action2ParameterAgentMap: Record<string, ParameterAgentFunction> = {
  [ActionId.Eat_Item]: chooseFoodAgent,
  // 未来可以添加更多参数化行为的 Agent
};
```

## 提示词管理

提示词模板存储在 `@yuiju/source` 包中：
- `chooseActionPrompt` - 行为选择提示词
- `chooseFoodPrompt` - 食物选择提示词

## 输出格式

### 行为选择输出

定义见 [types/action.ts:59-68](../../../utils/src/types/action.ts#L59-L68)：
```typescript
{
  action: ActionId,           // 选中的行为 ID
  reason: string,             // 决策原因
  durationMinute?: number,    // 持续时间（可选）
  updateShortTermPlan?: string[],  // 短期计划更新（可选）
  updateLongTermPlan?: string,     // 长期计划更新（可选）
}
```

### 参数选择输出

定义见 [types/action.ts:70-76](../../../utils/src/types/action.ts#L70-L76)：
```typescript
{
  selectedList: [{
    value: string,      // 参数值
    quantity: number,   // 数量
    reason: string,     // 选择原因
  }]
}
```

## 错误处理

- **重试机制**：所有 Agent 最多重试 3 次
- **降级处理**：如果 LLM 返回无效行为，coordinator 返回空结果，由 engine 层处理
- **日志记录**：所有 LLM 调用和结果都会记录日志

## 添加新的参数化 Agent

1. **在 agent.ts 中实现新的 Agent 函数**
   ```typescript
   export async function chooseXxxAgent(
     parameterList: ActionParameter[],
     context: ActionContext,
     actionMemoryList: BehaviorRecord[],
   ): Promise<ParameterAgentDecision | undefined> {
     // 实现逻辑
   }
   ```

2. **在 coordinator.ts 的 Action2ParameterAgentMap 中注册**
   ```typescript
   [ActionId.Your_Action]: chooseXxxAgent,
   ```

3. **在 @yuiju/source 中添加对应的提示词模板**

## 相关文件

- [types/action.ts](../../../utils/src/types/action.ts) - 行为相关类型定义
- [action/index.ts](../action/index.ts) - 行为列表获取
- [engine/tick.ts](../engine/tick.ts) - Tick 执行逻辑
- [packages/source](../../source) - 提示词模板管理

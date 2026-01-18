## 项目概述

这是一个构建"悠酱"虚拟生活的模拟系统，使用 LLM 驱动的行为决策实现角色自主行动。系统采用 Monorepo 架构，包含 world（世界模拟）、server（消息服务）、utils（工具库）、source（资源数据）和 web（Web 界面）五个主要包。

## 开发命令

### 代码质量

```bash
# 代码检查和格式化
pnpm lint           # Biome 代码 lint
pnpm format         # 格式化代码检查
pnpm format:write   # 格式化代码并写入

# 类型检查
pnpm type-check:world
```

### 运行服务

```bash
# 开发环境
pnpm dev:server     # 启动消息服务（使用 terminal.ts 终端交互）
pnpm dev:world      # 启动世界模拟（开发模式）
pnpm dev:web        # 启动 Web 界面

# 生产环境
pnpm start:server   # 启动消息服务（使用 server.ts NapCat WebSocket）
pnpm start:world    # 启动世界模拟（生产模式）

# 测试
pnpm test:world     # 运行 world 包的测试
```

### 进程管理

项目使用 PM2 进行进程管理，配置文件为 [ecosystem.config.js](ecosystem.config.js)。

## 核心架构

### 包结构

- **@yuiju/world** - 世界模拟引擎
  - `engine/` - 核心循环引擎
  - `action/` - 行为定义（home.ts: 家中行为, school.ts: 学校行为, anywhere.ts: 通用行为）
  - `state/` - 状态管理（character-state.ts: 角色状态, world-state.ts: 世界状态）
  - `llm/` - LLM 决策客户端

每个模块下都有 REDEMD.md 文件，可以快速了解模块的作用，不用每次都读一遍代码。

- **@yuiju/server** - QQ 消息服务
  - `server.ts` - NapCat WebSocket 服务端（生产）
  - `terminal.ts` - 终端交互模式（开发）
  - `llm/manager.ts` - LLM 对话管理器

- **@yuiju/utils** - 共享工具库
  - `db/` - MongoDB 连接和 Mongoose Schema（[action.schema.ts](packages/utils/src/db/schema/action.schema.ts)）
  - `redis.ts` - Redis 客户端（角色状态缓存）
  - `env.ts` - 环境变量判断工具

- **@yuiju/source** - 静态资源（数据集、提示词、图片）

- **@yuiju/web** - Web 界面

### 状态管理架构

**重要**：角色状态采用"Redis 为准"的架构模式：

- [character-state.ts:36-81](packages/world/src/state/character-state.ts#L36-L81) - `load()` 从 Redis HGETALL 加载状态到内存
- [character-state.ts:83-95](packages/world/src/state/character-state.ts#L83-L95) - `save()` 持久化到 Redis
- 所有状态修改方法（setStamina, changeMoney, addItem, consumeItem 等）都会自动调用 `save()`

Redis Key 常量定义在 `@yuiju/utils` 的 [redis.ts](packages/utils/src/redis.ts) 中（如 REDIS_KEY_CHARACTER_STATE）。

### 行为决策流程

[tick.ts:38-143](packages/world/src/engine/tick.ts#L38-L143) 实现核心决策循环：

1. **获取可用行为** - [action/index.ts:8-30](packages/world/src/action/index.ts#L8-L30)
   - 特殊优先检查（precheckAction）处理起床/睡觉后的特殊选择
   - 根据位置（Home/School）加载场景特定行为
   - 过滤满足前置条件的行为

2. **LLM 选择行为** - [llm/coordinator.ts:23-83](packages/world/src/llm/coordinator.ts#L23-L83)
   - coordinatorAgent 协调行为选择和参数选择
   - chooseActionAgent 选择行为（DeepSeek Reasoner）
   - chooseFoodAgent 等参数 Agent 选择具体参数（Qwen3-8B）

3. **执行行为** - [tick.ts:94-95](packages/world/src/engine/tick.ts#L94-L95)
   - 调用行为的 executor 函数
   - 支持参数化行为（如 Eat_Item 接收食物列表）
   - 计算持续时间（支持动态计算）

4. **保存记录并等待下一次 tick**
   - 保存行为记录到 MongoDB（仅生产环境，[tick.ts:109-123](packages/world/src/engine/tick.ts#L109-L123)）
   - 根据 durationMin 等待（[runner.ts:18-34](packages/world/src/engine/runner.ts#L18-L34)）

### 行为定义规范

行为在 `action/` 目录下定义，类型定义在 [types/action.ts:78-108](packages/world/src/types/action.ts#L78-L108)：

```typescript
interface ActionMetadata {
  action: ActionId; // ActionId 枚举值
  description: string; // 行为描述
  precondition: (context) => boolean; // 前置条件函数
  parameterResolver?: (context) => Promise<ActionParameter[]>; // 可选：参数解析器
  executor: (context, parameters?) => void; // 执行函数，支持参数
  durationMin: number | ((context, llmDurationMin?, parameters?) => Promise<number>); // 持续时间
  completionEvent?: string | ((context, parameters?) => string); // 完成事件描述
}
```

**参数化行为**（如 [anywhere.ts:38-101](packages/world/src/action/anywhere.ts#L38-L101)）：

- 定义 `parameterResolver` 返回可用参数列表
- executor 接收 `parameters?: ActionParameter[]`
- 持续时间可根据参数动态计算

### LLM Agent 架构

- **coordinatorAgent** ([llm/coordinator.ts](packages/world/src/llm/coordinator.ts)) - 协调器
  - 先选择行为（chooseActionAgent）
  - 根据行为类型选择对应的参数 Agent（通过 Action2ParameterAgentMap 映射）

- **chooseActionAgent** ([llm/agent.ts:19-80](packages/world/src/llm/agent.ts#L19-80)) - 行为选择
  - 使用 DeepSeek Reasoner 模型
  - 支持工具调用（如 queryAvailableFood）
  - 返回 ActionAgentDecision（包含 action, reason, durationMinute, updateLongTermPlan, updateShortTermPlan）

- **chooseFoodAgent** ([llm/agent.ts:82-132](packages/world/src/llm/agent.ts#L82-L132)) - 食物参数选择
  - 使用 Qwen3-8B 模型（SiliconFlow）
  - 返回选择的食物列表和数量

- **模型配置** ([llm/utils.ts](packages/world/src/llm/utils.ts))：
  - model_deepseek_reasoner - DeepSeek Reasoner
  - model_qwen3_8B - SiliconFlow Qwen3-8B
  - 使用 logMiddleware 记录 LLM 输出

### 数据库 Schema

使用 Mongoose 定义模型：

- **BehaviorRecord** ([packages/utils/src/db/schema/action.schema.ts](packages/utils/src/db/schema/action.schema.ts))
  - behavior, description, timestamp, trigger (agent/user/system)
  - parameters (BehaviorParameter[]), duration_minutes

### 环境变量

项目使用 `.env` 文件配置，关键变量：

- `NODE_ENV` - development/production
- `DEEPSEEK_API_KEY` - DeepSeek API 密钥
- `SILICONFLOW_API_KEY` - SiliconFlow API 密钥
- `REDIS_URL` - Redis 连接 URL
- `MONGODB_URL` - MongoDB 连接 URL
- `NAPCAT_TOKEN` - NapCat WebSocket 访问令牌

环境判断使用 `@yuiju/utils/env.ts` 中的 `isDev`/`isProd`。

### 代码规范

- 使用 Biome 进行代码检查和格式化（配置：[biome.json](biome.json)）
- TypeScript 路径别名：`@/` 指向各包的 `src/` 目录
- 使用 tsx 直接运行 TypeScript（无需预编译）

### 测试

使用 Vitest 进行测试，测试文件位于 [packages/world/tests/](packages/world/tests/)。

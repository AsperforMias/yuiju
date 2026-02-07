## 项目概述

这是一个构建“悠酱”虚拟生活的模拟系统，使用 LLM 驱动的行为决策实现角色自主行动。系统采用 Monorepo 架构，包含 world（世界模拟）、message（消息服务）、utils（工具库）、source（资源数据）、web（Web 界面）与 python（长期记忆服务）等包。

## 开发命令

### 代码质量

- `pnpm lint`
- `pnpm format:write`
- `pnpm type-check`
- `pnpm type-check:world`
- `pnpm type-check:message`
- `pnpm type-check:utils`

### 运行服务

- 开发环境：`pnpm dev:message`、`pnpm dev:world`、`pnpm dev:web`
- 生产环境：`pnpm start:message`、`pnpm start:world`、`pnpm start:web`、`pnpm start:python`
- 构建：`pnpm build:web`

### 测试

- `pnpm test:world`

### 进程管理

项目使用 PM2 进行进程管理，配置文件为 [ecosystem.config.js](ecosystem.config.js)。

## 核心架构

### 包结构

- **@yuiju/world** - 世界模拟引擎
  - `engine/` - 核心循环引擎（runner/tick）
  - `action/` - 行为定义（home/school/shop/anywhere）
  - `state/` - 状态管理（character/world）
  - `llm/` - 行为选择与工具调用
  - `utils/` - 日志等运行工具
  - `tests/` - Vitest 测试
- **@yuiju/message** - 消息服务
  - `server.ts` - NapCat WebSocket 服务端
  - `terminal.ts` - 终端交互模式
  - `llm/manager.ts` - LLM 对话管理器
  - `chat-session-manager.ts` - 对话窗口与记忆写入
  - `tts.ts` - TTS 调用封装
- **@yuiju/utils** - 共享工具库
  - `db/` - MongoDB 连接与 Schema
  - `redis.ts` - Redis 客户端与 Key 常量
  - `env.ts` - 环境变量判断
  - `llm/tools/` - LLM 工具（状态/行为/记忆检索）
  - `memory/` - 记忆服务客户端
  - `types/` - 行为与状态类型
- **@yuiju/source** - 资源与提示词
  - `prompt/` - 角色卡、世界观等提示词
  - `dataset/` - 数据集
  - `picture/` - 项目素材
- **@yuiju/web** - Next.js Web 界面
  - `app/` - App Router 页面
  - `app/api/edge` - Hono Edge API
  - `app/api/nodejs` - Hono Node API（含状态接口）
- **@yuiju/python** - 长期记忆服务
  - `server.py` - FastAPI 服务（/healthz、/v1/episodes、/v1/search）
  - `graphiti_client.py` - Graphiti/Neo4j 客户端单例

world 子模块内的 `action/engine/state` 目录都有 README.md，可用于快速了解模块职责。

### 状态管理架构

**重要**：角色状态采用“Redis 为准”的架构模式：

- [character-state.ts:L37-L62](packages/world/src/state/character-state.ts#L37-L62) - `load()` 从 Redis 初始化状态，`save()` 持久化回 Redis
- 所有状态修改方法（setStamina、changeMoney、addItem、consumeItem 等）都会调用 `save()`

Redis Key 常量定义在 `@yuiju/utils` 的 [redis.ts](packages/utils/src/redis.ts) 中（如 `REDIS_KEY_CHARACTER_STATE`）。

### 行为决策流程

[tick.ts](packages/world/src/engine/tick.ts) 实现核心决策循环：

1. **构建上下文**：聚合角色状态、世界状态与上次完成事件
2. **获取可用行为**：`getActionList()` 根据前置条件与场景过滤行为
3. **拉取行为历史**：从 MongoDB 获取近期行为记录
4. **LLM 选择行为**：`chooseActionAgent()` 选择行为与持续时间
5. **执行与记录**：执行行为、推进世界时间、计算持续时间
6. **持久化**：生产环境写入 MongoDB；可用时写入记忆服务
7. **生成完成事件**：作为下一次 tick 的上下文

### 行为定义规范

行为在 `action/` 目录下定义，基类见 [types/action.ts](packages/utils/src/types/action.ts)：

- `action`：行为枚举
- `description`：行为描述
- `precondition`：前置条件
- `parameterResolver`：可选参数解析器
- `executor`：执行器，支持返回补充描述
- `durationMin`：固定值或动态函数
- `completionEvent`：完成事件描述

参数化行为示例见 [anywhere.ts](packages/world/src/action/anywhere.ts) 的“吃东西”实现。

### LLM 与记忆

- **世界决策**：`chooseActionAgent` 与 `chooseFoodAgent` 使用 DeepSeek Reasoner
- **工具调用**：`queryAvailableFood` 根据背包生成可选食物列表
- **消息服务**：DeepSeek Chat 结合 `memorySearchTool`、`queryCharacterStateTool` 等工具
- **记忆写入**：world 与 message 会向记忆服务写入 episode
- **记忆服务地址**：`http://localhost:9196`（当前由 `getMemoryServiceClientFromEnv()` 固定）

### 数据存储

- **Redis**：角色状态缓存与主存
- **MongoDB**：行为记录（BehaviorRecord）与 QQ 消息记录
- **Graphiti/Neo4j**：长期记忆（python 服务）

### 环境变量

项目使用 `.env` 文件配置，关键变量包括：

- `NODE_ENV`
- `DEEPSEEK_API_KEY`
- `SILICONFLOW_API_KEY`
- `REDIS_URL`
- `MONGO_URI`
- `NAPCAT_TOKEN`
- `MEM0AI_API_KEY`

环境判断使用 `@yuiju/utils/env.ts` 中的 `isDev`/`isProd`。

### 代码规范

- 使用 Biome 进行代码检查和格式化（配置：[biome.json](biome.json)）
- TypeScript 路径别名：`@/` 指向各包的 `src/` 目录
- 使用 tsx 直接运行 TypeScript
- 更改完代码后运行 `pnpm format:write`

### 测试

使用 Vitest，测试文件位于 [packages/world/tests/](packages/world/tests/)。

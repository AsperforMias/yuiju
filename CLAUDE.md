# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个构建"悠酱"虚拟生活的模拟系统，使用 LLM 驱动的行为树实现角色自主行动决策。系统采用 Monorepo 架构，包含 world（世界模拟）、message（消息服务）、utils（工具库）和 source（资源数据）四个主要包。

## 开发命令

### 代码质量
```bash
# 代码检查
pnpm check          # 使用 biome 检查代码
pnpm lint           # 代码 lint
pnpm format         # 格式化代码检查
pnpm format:write   # 格式化代码并写入

# 类型检查
pnpm --filter @yuiju/world run type-check
```

### 运行服务
```bash
# 开发环境
pnpm dev:message    # 启动消息服务（开发模式，使用 terminal.ts）
pnpm dev:world      # 启动世界模拟（开发模式）

# 生产环境
pnpm start:message  # 启动消息服务（生产模式，使用 server.ts）
pnpm start:world    # 启动世界模拟（生产模式）

# 测试
pnpm test:world     # 运行 world 包的测试
```

### 进程管理
项目使用 PM2 进行进程管理，配置文件为 `ecosystem.config.js`。

## 核心架构

### 包结构

- **@yuiju/world** - 世界模拟引擎
  - `engine/` - 核心循环引擎（runner.ts: tick 循环, tick.ts: 行为执行）
  - `action/` - 行为定义（home.ts: 家中行为, school.ts: 学校行为, anywhere.ts: 通用行为）
  - `state/` - 状态管理（charactor-state.ts: 角色状态, world-state.ts: 世界状态）
  - `llm/` - LLM 决策客户端

- **@yuiju/message** - QQ 消息服务
  - `server.ts` - NapCat WebSocket 服务端（生产）
  - `terminal.ts` - 终端交互模式（开发）
  - `llm/manager.ts` - LLM 对话管理器

- **@yuiju/utils** - 共享工具库
  - `db/` - MongoDB 连接和 Mongoose Schema（action.schema.ts, qqMessage.schema.ts）
  - `redis.ts` - Redis 客户端（角色状态缓存）
  - `llm-tools/` - LLM 工具（如计划管理工具）

- **@yuiju/source** - 静态资源（数据集、提示词、图片）

### 状态管理架构

**重要**：角色状态采用"Redis 为准"的架构模式：
- [charactor-state.ts:24-50](packages/world/src/state/charactor-state.ts#L24-L50) - `load()` 方法从 Redis HGETALL 加载状态到内存
- [charactor-state.ts:52-61](packages/world/src/state/charactor-state.ts#L52-L61) - `save()` 方法将状态持久化到 Redis
- 所有状态修改方法（setStamina, changeMoney 等）都会自动调用 `save()`

Redis Key 常量定义在 `@yuiju/utils` 的 `redis.ts` 中（如 REDIS_KEY_CHARACTOR_STATE）。

### 行为决策流程

[tick.ts:36-106](packages/world/src/engine/tick.ts#L36-L106) 实现了核心决策循环：

1. **获取可用行为** - [action/index.ts:8-30](packages/world/src/action/index.ts#L8-L30)
   - 根据位置（Home/School）加载场景特定行为
   - 过滤满足前置条件的行为

2. **LLM 选择行为** - [llm-client.ts](packages/world/src/llm/llm-client.ts)
   - 传入当前状态、可用行为列表、历史记录
   - 返回选中的行为 ID 和原因

3. **执行行为** - [tick.ts:73](packages/world/src/engine/tick.ts#L73)
   - 调用行为的 executor 函数
   - 计算持续时间（支持动态计算）
   - 保存行为记录到 MongoDB（生产环境）

4. **等待下一次 tick** - [runner.ts:18-32](packages/world/src/engine/runner.ts#L18-L32)
   - 根据行为持续时间等待
   - 更新世界时间

### 行为定义规范

行为在 `action/` 目录下定义，包含以下字段：
- `action` - ActionId 枚举值
- `precondition` - 前置条件函数（返回 boolean）
- `executor` - 执行函数（修改状态）
- `durationMin` - 持续时间（number 或动态函数）
- `completionEvent` - 完成事件描述（string 或函数）

参考：[action/home.ts](packages/world/src/action/home.ts), [action/anywhere.ts](packages/world/src/action/anywhere.ts)

### 数据库 Schema

使用 Mongoose 定义模型：
- **ActionRecord** ([db/schema/action.schema.ts](packages/utils/src/db/schema/action.schema.ts))
  - action_id, reason, create_time

- **QQMessage** ([db/schema/qqMessage.schema.ts](packages/utils/src/db/schema/qqMessage.schema.ts))
  - senderName, content, timestamp

### 环境变量

项目使用 `.env` 文件配置环境变量，关键变量包括：
- `NODE_ENV` - development/production
- `DEEPSEEK_API_KEY` - DeepSeek API 密钥
- `NAPCAT_TOKEN` - NapCat WebSocket 访问令牌
- MongoDB 和 Redis 连接配置

### 代码规范

- 使用 Biome 进行代码检查和格式化（配置：biome.json）
- TypeScript 路径别名配置：`@/` 指向各包的 `src/` 目录
- 使用 tsx 直接运行 TypeScript 文件（无需预编译）

### 测试

使用 Vitest 进行测试，测试文件位于 `packages/world/tests/`。

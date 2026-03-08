# ゆいじゅ（悠酱）

<p align="center">
  <img src="packages/source/picture/repo_avatar.png" alt="ゆいじゅ（悠酱）" width="150" />
</p>

幻想打造一个 ゆいじゅ 生活的世界。

# 项目介绍

这是一个 LLM 驱动的「角色自主生活模拟」项目，可以理解为 AI 驱动的模拟经营游戏，让一个角色在持续推进的世界里，基于自身状态与环境信息进行决策、执行行为，并留下可追溯的生活轨迹。目标是把“悠酱的一天”从脚本驱动变成“自己行动”的模拟系统。

## 特性

- **LLM 驱动决策**：每个 tick 从可用行为中做选择，并可细化到参数选择（比如吃什么、行动多久）。
- **状态驱动循环**：角色状态既是输入也是结果，让世界随着行动持续演进。
- **可观测/可复盘**：行为、参数与持续时间等信息可被记录，便于分析与回放。
- **行为易扩展**：通过行为定义与前置条件机制，能逐步丰富“能做什么”。
- **多入口交互**：可通过消息服务与 Web 界面观察世界运行并进行互动。

# Architecture

> 项目还处于早期开发阶段，有些功能并为按照架构图实现

![](./docs/architecture.png)

# 相关文档

## 面向新人快速上手

### 1) 项目介绍

`yuiju` 是一个 **LLM Agent 驱动的角色生活模拟系统**。  
核心目标是让角色通过 **State -> Decision -> Action -> Update** 的闭环持续演化，而不是依赖固定脚本。

项目采用 `pnpm workspace` 多包架构：

- `packages/world`：世界引擎（Tick 循环、动作系统、状态管理、LLM 决策）
- `packages/web`：Web 展示与 API 通道（Next.js + Hono）
- `packages/message`：消息服务入口
- `packages/utils`：公共能力（类型、DB、Redis、工具函数）
- `packages/source`：Prompt 与数据源

### 2) 项目能力

- **Agent Tick 决策闭环**：已实现 State -> Decision -> Action -> Update 的持续循环，支持角色行为持续演化。
- **参数化动作决策**：支持“做什么 / 做多久 / 如何执行（参数）”的细粒度规划，覆盖食物、商店、咖啡店等场景。
- **多端数据通道**：提供 Web API 与消息服务入口，支持角色状态、行为轨迹的查询与展示。
- **工程质量保障**：基于 TypeScript + Vitest，具备 lint / type-check / test 校验链路，便于持续迭代。

### 3) 如何启动

#### 运行环境

- Node.js：`24`（见 `.node-version`）
- pnpm：`10.14.x`（建议与仓库一致）
- Redis：本地可用
- MongoDB：本地可用

#### 环境变量

1. 复制环境变量模板：

```bash
cp .env.example .env
```

2. 至少确认以下配置：

- `DEEPSEEK_API_KEY`：LLM 调用凭据
- `MONGO_URI`：MongoDB 连接地址
- `REDIS_URL`：Redis 连接地址
- `PUBLIC_DEPLOYMENT`：是否对外展示（默认 `false`）
- `NAPCAT_TOKEN`：仅消息服务需要

#### 启动步骤（推荐）

1. 安装依赖：

```bash
pnpm install
```

2. 启动世界引擎：

```bash
pnpm dev:world
```

3. 启动 Web：

```bash
pnpm dev:web
```

4. 按需启动消息服务：

```bash
pnpm dev:message
```

#### 常用校验命令

```bash
pnpm lint
pnpm type-check
pnpm test:world
```

#### 常见问题

- 若 `git pull` 出现 `Could not read from remote repository`：通常是 SSH key 或仓库权限问题，不影响本地开发与运行。
- 若启动报 Redis/Mongo 连接错误：先确认本地服务是否启动、以及 `.env` 配置是否正确。

---

每个子应用内可能有自己的 README 文件，建议结合各子包文档阅读。

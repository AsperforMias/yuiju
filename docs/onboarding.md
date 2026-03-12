# 新人上手指南

## 1. 项目介绍

`yuiju` 是一个 **LLM Agent 驱动的角色生活模拟系统**。  
系统通过 **State -> Decision -> Action -> Update** 的闭环，让角色在动态环境中持续决策与行为演化，而不是依赖固定脚本。

项目采用 `pnpm workspace` 多包架构，主要模块如下：

- `packages/world`：世界引擎（Tick 循环、动作系统、状态管理、LLM 决策）
- `packages/web`：Web 展示与 API 通道（Next.js + Hono）
- `packages/message`：消息服务入口
- `packages/utils`：公共能力（类型、DB、Redis、工具函数）
- `packages/source`：Prompt 与数据源
- `packages/python`：Python 侧服务（按需使用）

## 2. 项目能力

- **Agent Tick 决策闭环**：已实现 State -> Decision -> Action -> Update 的持续循环，支持角色行为长期演化。
- **参数化动作决策**：支持“做什么 / 做多久 / 如何执行（参数）”的细粒度规划，覆盖食物、商店、咖啡店等行为场景。
- **多端数据通道**：提供 Web API 与消息服务入口，支持角色状态与行为轨迹的查询和展示。
- **工程质量保障**：基于 TypeScript + Vitest，具备 lint / type-check / test 校验链路，便于持续迭代。

## 3. 如何启动

### 3.1 运行环境

- Node.js：`24`（见根目录 `.node-version`）
- pnpm：`10.14.x`（建议与仓库声明版本一致）
- Redis：本地可用
- MongoDB：本地可用

### 3.2 环境变量

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

### 3.3 启动步骤（推荐）

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

### 3.4 常用校验命令

```bash
pnpm lint
pnpm type-check
pnpm test:world
```

### 3.5 常见问题

- `git pull` 报错 `Could not read from remote repository`：通常是 SSH key 或仓库权限问题，不影响本地开发。
- 启动时报 Redis/Mongo 连接错误：先确认本地服务是否启动，再检查 `.env` 中的 `REDIS_URL` 和 `MONGO_URI`。

## 4. 项目部署（PM2）

项目生产部署使用 PM2，配置文件为根目录 `ecosystem.config.js`。

### 4.1 PM2 管理的应用

- `yuiju-message`：消息服务（`pnpm run start:message`）
- `yuiju-world`：世界引擎（`pnpm run start:world`）
- `yuiju-web`：Web 服务（`pnpm run build:web && pnpm run start:web`）
- `yuiju-python`：Python 服务（`pnpm run start:python`）

### 4.2 常用部署命令

1. 首次启动全部应用：

```bash
pm2 start ecosystem.config.js
```

2. 查看运行状态与日志：

```bash
pm2 status
pm2 logs
```

3. 重启全部或单个应用：

```bash
pm2 restart ecosystem.config.js
pm2 restart yuiju-web
```

4. 停止和删除进程：

```bash
pm2 stop ecosystem.config.js
pm2 delete ecosystem.config.js
```

5. 设置开机自启（服务器场景）：

```bash
pm2 startup
pm2 save
```

### 4.3 部署注意事项

- 生产部署前建议先执行：

```bash
pnpm install
pnpm lint
pnpm type-check
```

- `.env` 需要在部署机器提前配置好，至少包含 `MONGO_URI`、`REDIS_URL`、`DEEPSEEK_API_KEY` 等关键变量。
- `ecosystem.config.js` 中当前配置了 `autorestart: false`，若需要异常自动拉起，需要按运维策略调整。

# 公共能力包 (@yuiju/utils)

`@yuiju/utils` 是整个仓库的基础能力层，负责提供跨子包复用的类型、环境变量、数据库连接、Redis 状态读写、时间处理和通用工具函数。

## 项目概述

这个子包不直接提供独立服务，而是作为所有业务包的公共依赖：

- `world` 用它管理状态、行为类型、数据库与 Redis
- `web` 用它读取状态、构建 API 响应
- `message` 用它连接数据库并保存聊天记录
- `source` 用它复用通用类型和工具函数

## 核心能力

- **类型定义**：行为、状态、商店、咖啡馆等核心领域类型
- **环境管理**：自动向上查找并加载根目录 `.env`
- **数据库能力**：MongoDB 连接、行为记录与消息记录 Schema
- **Redis 能力**：角色状态与世界状态初始化、读取和持久化
- **时间工具**：统一时间格式与时间相关辅助函数
- **LLM 工具**：记忆检索、状态查询等工具封装

## 导出模块

```text
src/
├── db/        # MongoDB 连接与 Schema
├── env.ts     # 环境变量加载与运行环境判断
├── llm/       # LLM 相关工具
├── memory/    # 长期记忆客户端封装
├── redis.ts   # Redis 客户端、Key、状态初始化
├── time.ts    # 时间相关工具
├── types/     # 领域类型定义
└── utils.ts   # 通用函数
```

## 典型使用场景

### 加载环境变量

```ts
import "@yuiju/utils/env";
```

### 获取 Redis 客户端

```ts
import { getRedis } from "@yuiju/utils";

const redis = getRedis();
```

### 初始化角色状态

```ts
import { initCharacterStateData } from "@yuiju/utils";

const state = await initCharacterStateData();
```

## 运行命令

```bash
# 类型检查
pnpm --filter @yuiju/utils run type-check
```

## 注意事项

- Redis 默认使用 `REDIS_URL`，未配置时回退到 `redis://localhost:6379`。
- `env.ts` 会从当前工作目录向上查找 `.env`，因此通常只需要维护仓库根目录的环境变量文件。
- 这个包不负责 UI 或业务流程，新增能力时优先保持“无业务偏置”的公共抽象。

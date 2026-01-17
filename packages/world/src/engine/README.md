# Engine 模块

## 模块概述

世界模拟的核心循环引擎，负责驱动悠酱的行为决策和执行。通过持续的 tick 循环，实现角色自主行动决策。

## 文件结构

```
engine/
├── runner.ts          # 主循环引擎，控制 tick 循环和等待时间
└── tick.ts            # 单次 tick 执行逻辑，包括 LLM 决策和行为执行
```

## 核心概念

### Tick 循环

[runner.ts:18-34](runner.ts#L18-L34) 的 `startRealtimeLoop()` 函数实现主循环：

1. **更新世界时间** - 推进游戏内时间
2. **执行 tick** - 调用 `tick()` 函数完成一次决策和执行
3. **等待** - 根据行为持续时间等待（实时模拟）
4. **重复** - 循环执行直到收到停止信号

### Tick 执行流程

[tick.ts:38-143](tick.ts#L38-L143) 的 `tick()` 函数实现单次决策和执行：

1. **构建上下文** - 收集角色状态、世界状态、上一次完成事件
2. **获取可用行为** - 调用 [action/index.ts](../action/index.ts) 的 `getActionList()`
3. **获取历史记录** - 从 MongoDB 读取最近的行为记录（生产环境）
4. **LLM 决策** - 调用 [coordinatorAgent](../llm/coordinator.ts) 选择行为和参数
5. **更新计划** - 如果 LLM 返回了计划更新，保存到角色状态
6. **执行行为** - 调用行为的 `executor` 函数
7. **计算持续时间** - 支持固定值或动态计算（[tick.ts:10-27](tick.ts#L10-L27)）
8. **保存记录** - 将行为记录保存到 MongoDB（生产环境）
9. **生成完成事件** - 作为下次 tick 的上下文

### 时间处理

- **世界时间** - 由 [world-state](../state/world-state.ts) 管理，每次 tick 推进
- **实时等待** - runner 根据 `durationMin` 进行真实的等待（1 游戏分钟 = 60 真实秒）
- **动态持续时间** - 支持根据上下文计算行为持续时间（如上课到下课时间）

### 行为记录

生产环境下，每次执行的 behavior 会保存到 MongoDB（[tick.ts:109-123](tick.ts#L109-L123)）：
- 行为 ID 和描述
- LLM 决策原因
- 执行时间戳
- 参数信息
- 持续时间

## 错误处理

- **无可用行为** - 默认执行 `Idle` 行为
- **LLM 返回无效行为** - 记录错误并执行 `Idle` 行为
- **进程信号** - 监听 SIGINT 和 SIGTERM，优雅退出（[runner.ts:9-16](runner.ts#L9-L16)）

## 环境判断

通过 `@yuiju/utils` 的 `isProd()` 判断当前环境：
- **生产环境** - 保存行为记录到 MongoDB
- **开发环境** - 不保存记录，仅输出日志

## 相关文件

- [action/index.ts](../action/index.ts) - 行为列表获取
- [action/utils.ts](../action/utils.ts) - 行为工具函数
- [llm/coordinator.ts](../llm/coordinator.ts) - LLM 决策协调器
- [state/character-state.ts](../state/charactor-state.ts) - 角色状态管理
- [state/world-state.ts](../state/world-state.ts) - 世界状态管理
- [utils/db/](../../utils/src/db) - 数据库连接和 Schema

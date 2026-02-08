# 技术方案

## 背景

当前项目的角色核心数值仅包含「体力」，而游戏玩法目标偏“休闲日常”。为了让 LLM 能围绕“休息/进食/娱乐/工作/外出”等选择产生稳定、可预测的权衡，需要在保持简单的前提下补齐：

- 饥饿（进食驱动）
- 心情（休闲与地点差异驱动）

数值设计锚点与行为模板见：[/docs/game/numerical-design.md](file:///Users/yixiaojiu/Code/everything/yuiju/docs/game/numerical-design.md)。

## 设计目标

- 保持规则简单：优先“少而清晰”的数值维度，避免复杂养成
- 行为可解释：每个行为对数值的影响可被 LLM 理解与稳定使用
- 数据可演进：新增字段不破坏已有 Redis 状态，支持线上平滑升级

## 数值语义与范围

为降低理解成本并与现有 clamp 机制保持一致，新增数值采用与体力相同的范围与存储方式（0-100 的整数）。

- 体力（stamina）：0-100，决定“能不能做”的硬约束（行动能力）
- 饥饿：采用「饱腹（satiety）」表达，0-100
  - 0 表示非常饿、100 表示非常饱
  - 对外文案仍可使用“饥饿系统”，但内部字段建议统一为 `satiety`（与数值设计文档一致）
- 心情（mood）：0-100，决定“更想做什么”的软驱动（偏好与氛围）

## 数值规则落地（与数值设计对齐）

### 体力规则

- 变化来源：仅由行为离散改变（高强度行为消耗更多，休息/睡觉恢复更多）
- 阈值策略（最小闭环）：
  - 体力 < 30：过滤高强度行为，偏向休息/短活动
  - 体力 < 15：强烈优先休息/睡觉

### 饱腹规则（饥饿系统）

- 自然下降：随时间缓慢下降（数值设计建议：每小时 -5）
- 行为改变：吃饭/零食/咖啡等提升饱腹；长时间外出/工作等轻度下降
- 阈值策略：
  - 饱腹 < 30：提高“吃饭/外卖/便利店”权重
  - 饱腹 < 15：强烈优先进食（不强制禁止行动，但应显著提高进食倾向）

### 心情规则

- 变化来源：主要由行为离散改变（娱乐/散步上升，工作/高负担活动可能下降）
- 阈值策略：
  - 心情 < 30：提高“放松/娱乐/散步”权重
  - 心情 < 15：降低高消耗或高压力行为权重

## 技术实现方案（按改动点拆分）

### 1) 类型层：扩展角色状态 schema

修改 [state.ts](file:///Users/yixiaojiu/Code/everything/yuiju/packages/utils/src/types/state.ts)：

- `CharacterStateData` 增加字段：`satiety`、`mood`
- `ICharacterState` 增加方法（对齐 stamina 的接口风格）：
  - `setSatiety(satiety: number) / changeSatiety(delta: number)`
  - `setMood(mood: number) / changeMood(delta: number)`

目标：让所有行为都通过统一入口修改数值，避免散落的 Redis 直改。

### 2) 数据层：Redis 默认值 + 兼容老数据

修改 [redis.ts](file:///Users/yixiaojiu/Code/everything/yuiju/packages/utils/src/redis.ts)：

- `DEFAULT_CHARACTER_STATE_DATA` 补齐默认值（建议：
  - `satiety: 70`（不饿但有空间触发进食）
  - `mood: 60`（偏中性略积极）
  - 默认值也可根据玩法再调整，但应保持 0-100）
- `initCharacterStateData()`：
  - Redis 为空：在 `REDIS_KEY_CHARACTER_STATE` 的 hash 中写入新增 fields（`satiety`、`mood`）
  - Redis 非空：若缺少字段则使用默认值兜底，并做 parse 与合法性校验

目标：无需迁移脚本即可平滑升级，老存档自动补齐新字段。

### 3) world 状态封装：load/save + clamp 规则

修改 [character-state.ts](file:///Users/yixiaojiu/Code/everything/yuiju/packages/world/src/state/character-state.ts)：

- 内存态增加 `satiety`、`mood`
- `load()` 从 `initCharacterStateData()` 同步新字段
- `save()` 将新字段写回 Redis hash
- 新增 `setSatiety/changeSatiety/setMood/changeMood` 并统一 clamp 到 0-100

### 4) “随时间下降”的落点：基于行为持续时间的离散衰减

由于当前世界循环为真实时间等待（见 [runner.ts](file:///Users/yixiaojiu/Code/everything/yuiju/packages/world/src/engine/runner.ts) 与 [tick.ts](file:///Users/yixiaojiu/Code/everything/yuiju/packages/world/src/engine/tick.ts)），且并未把世界时间按 `durationMin` 推进，因此建议采用“每次 tick 执行完毕后，按 `durationMin` 结算一次饱腹自然下降”的最小实现：

- 在 [tick.ts](file:///Users/yixiaojiu/Code/everything/yuiju/packages/world/src/engine/tick.ts) 中拿到 `durationMin` 后，追加结算逻辑：
  - `satietyDecay = ceil(durationMin / 60 * 5)`
  - `characterState.changeSatiety(-satietyDecay)`

该方案不依赖额外时间戳字段，逻辑简单，可解释性强，并与数值设计“每小时 -5”一致。

### 5) 行为系统：最小行为集接入 satiety / mood

本阶段只做“最小闭环”改动，确保 LLM 能产生稳定选择：

- 进食类行为：提升 `satiety`，同时小幅提升 `mood`（可选）
  - 行为落点通常在：
    - [home.ts](file:///Users/yixiaojiu/Code/everything/yuiju/packages/world/src/action/home.ts)
    - [anywhere.ts](file:///Users/yixiaojiu/Code/everything/yuiju/packages/world/src/action/anywhere.ts)
    - [cafe.ts](file:///Users/yixiaojiu/Code/everything/yuiju/packages/world/src/action/cafe.ts)
- 休闲类行为：提升 `mood`，同时小幅消耗 `stamina/satiety`
- 工作/学习类行为：消耗 `stamina/satiety`，可能小幅降低 `mood`

具体数值直接沿用 [/docs/game/numerical-design.md](file:///Users/yixiaojiu/Code/everything/yuiju/docs/game/numerical-design.md) 中的“行为模板示例”，后续扩展地点时按同一模板填表即可。

### 6) LLM 可见性：把 satiety / mood 注入 prompt 与工具

world 决策侧：

- 将 `satiety/mood` 注入决策上下文（[agent.ts](file:///Users/yixiaojiu/Code/everything/yuiju/packages/world/src/llm/agent.ts)）
- 在世界观/状态 prompt 中展示新字段（[world-view.ts](file:///Users/yixiaojiu/Code/everything/yuiju/packages/source/prompt/world-view.ts)）

message（聊天）侧：

- 工具实现层面会自动包含新字段（工具返回 `initCharacterStateData()` 的 state），但建议更新工具描述避免模型忽略：
  - [query-character-state.ts](file:///Users/yixiaojiu/Code/everything/yuiju/packages/utils/src/llm/tools/query-character-state.ts)

## 测试与验收

需要更新的测试类型：

- Redis 初始化测试：验证新字段默认值与兜底逻辑（[redis-init.test.ts](file:///Users/yixiaojiu/Code/everything/yuiju/packages/world/tests/state/redis-init.test.ts)）
- 行为测试：如使用了 mock 的 `ICharacterState`，需要补齐新增字段/方法以通过 type-check

验收标准（最小闭环）：

- 新字段能在 Redis 初始化后正确出现并可读写
- 至少一类进食行为能提升 `satiety`，至少一类休闲行为能提升 `mood`
- `satiety` 会随 `durationMin` 发生自然下降（与“每小时 -5”一致的结算方式）
- LLM 决策 prompt 中可见 `satiety/mood`，且阈值策略能影响行为倾向

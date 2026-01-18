# State 模块

## 模块概述

管理角色状态和世界状态，采用"Redis 为准"的架构模式。所有状态修改会自动持久化到 Redis，确保数据一致性。

## 文件结构

```
state/
├── index.ts              # 状态初始化入口
├── character-state.ts    # 角色状态管理（单例模式）
└── world-state.ts        # 世界状态管理（单例模式）
```

## 核心概念

### Redis 为准架构

状态管理采用以下模式：

1. **内存缓存** - 状态在内存中维护快速访问
2. **Redis 持久化** - 所有修改自动保存到 Redis
3. **启动加载** - 从 Redis 加载状态到内存（[index.ts:4-7](index.ts#L4-L7)）
4. **自动保存** - 状态修改方法自动调用 `save()`

### 角色状态

[character-state.ts:14-191](character-state.ts#L14-L191) 的 `CharacterState` 类管理角色状态：

**核心字段**：

- `action: ActionId` - 当前正在执行的行为
- `location: Location` - 当前位置（包含 major 和 minor）
- `stamina: number` - 体力值（0-100）
- `money: number` - 金钱数量
- `dailyActionsDoneToday: ActionId[]` - 今天已完成的行为列表
- `longTermPlan: string` - 长期计划（一句话描述）
- `shortTermPlan: string[]` - 短期计划（步骤列表）
- `inventory: InventoryItem[]` - 背包物品列表

**核心方法**：

- `load()` - [character-state.ts:36-81](character-state.ts#L36-L81) 从 Redis HGETALL 加载状态
- `save()` - [character-state.ts:83-95](character-state.ts#L83-L95) 保存状态到 Redis HSET
- `setAction()` - [character-state.ts:97-100](character-state.ts#L97-L100) 设置当前行为
- `setStamina() / changeStamina()` - [character-state.ts:102-110](character-state.ts#L102-L110) 设置/修改体力
- `setMoney() / changeMoney()` - [character-state.ts:112-121](character-state.ts#L112-L121) 设置/修改金钱
- `markActionDoneToday()` - [character-state.ts:123-130](character-state.ts#L123-L130) 标记行为已完成
- `clearDailyActions()` - [character-state.ts:132-135](character-state.ts#L132-L135) 清空每日行为记录
- `setLongTermPlan() / setShortTermPlan()` - [character-state.ts:137-145](character-state.ts#L137-L145) 设置计划
- `addItem()` - [character-state.ts:151-161](character-state.ts#L151-L161) 添加物品到背包
- `consumeItem()` - [character-state.ts:167-179](character-state.ts#L167-L179) 消费背包物品

**单例模式**：

- [character-state.ts:30-33](character-state.ts#L30-L33) 使用 `getInstance()` 获取唯一实例
- 导出 `characterState` 单例供全局使用

### 世界状态

[world-state.ts:6-47](world-state.ts#L6-L47) 的 `WorldState` 类管理世界状态：

**核心字段**：

- `time: Dayjs` - 当前世界时间

**核心方法**：

- `load()` - [world-state.ts:16-25](world-state.ts#L16-L25) 从 Redis 加载时间
- `save()` - [world-state.ts:27-30](world-state.ts#L27-L30) 保存时间到 Redis
- `updateTime()` - [world-state.ts:32-35](world-state.ts#L32-L35) 更新世界时间
- `reset()` - [world-state.ts:37-40](world-state.ts#L37-L40) 重置为当前时间
- `log()` - [world-state.ts:42-46](world-state.ts#L42-L46) 返回状态快照

**单例模式**：

- [world-state.ts:11-14](world-state.ts#L11-L14) 使用 `getInstance()` 获取唯一实例
- 导出 `worldState` 单例供全局使用

## Redis Key 常量

Redis Key 定义在 `@yuiju/utils` 的 `redis.ts` 中：

- `REDIS_KEY_CHARACTER_STATE` - 角色状态的 Redis HSET key
- `REDIS_KEY_WORLD_STATE` - 世界状态的 Redis HSET key

## 数据持久化

### 角色状态存储

使用 Redis HSET 存储角色状态，字段包括：

- `action` - 当前行为
- `location` - JSON 字符串
- `stamina` - 体力值
- `money` - 金钱
- `dailyActionsDoneToday` - JSON 数组字符串
- `longTermPlan` - 长期计划
- `shortTermPlan` - JSON 数组字符串
- `inventory` - JSON 数组字符串

### 世界状态存储

使用 Redis HSET 存储世界状态，字段包括：

- `time` - ISO 8601 时间字符串

## 状态初始化

[index.ts:4-7](index.ts#L4-L7) 的 `initState()` 函数：

在应用启动时调用，从 Redis 加载状态到内存。

## 重要说明

1. **自动保存**：所有状态修改方法都会自动调用 `save()`，无需手动保存
2. **体力限制**：体力值自动限制在 0-100 范围内
3. **金钱限制**：金钱值不能为负数
4. **单例模式**：使用单例确保全局状态一致
5. **类型安全**：使用 TypeScript 接口定义状态结构

## 相关文件

- [types/state.ts](../../../utils/src/types/state.ts) - 状态相关类型定义
- [utils/redis.ts](../../utils/src/redis.ts) - Redis 客户端和 Key 常量
- [action/utils.ts](../action/utils.ts) - 行为工具函数（使用状态判断）
- [engine/tick.ts](../engine/tick.ts) - Tick 执行逻辑（使用和修改状态）

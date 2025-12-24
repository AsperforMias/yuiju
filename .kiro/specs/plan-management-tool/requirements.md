# Requirements Document

## Introduction

为悠酱角色添加计划管理功能，使其能够制定和管理长期计划与短期计划，提升角色行为的连贯性和目标导向性。

## Glossary

- **Plan_Management_Tool**: 计划管理工具，用于创建、更新和查询计划
- **Long_Term_Plan**: 长期计划，存储为单个字符串，描述较长时间跨度的目标
- **Short_Term_Plan**: 短期计划，存储为单个字符串，描述短期内的具体安排
- **Redis_Storage**: Redis 存储系统，用于持久化计划数据
- **LLM_Function_Tool**: LLM 函数工具，可被 AI 模型调用的结构化函数

## Requirements

### Requirement 1: 计划创建与更新

**User Story:** 作为悠酱角色，我想要能够创建和更新我的计划，以便更好地安排我的生活和活动。

#### Acceptance Criteria

1. WHEN 需要设置长期计划时，THE Plan_Management_Tool SHALL 接受计划内容字符串并存储到 Redis_Storage 的固定 key
2. WHEN 需要设置短期计划时，THE Plan_Management_Tool SHALL 接受计划内容字符串并存储到 Redis_Storage 的固定 key
3. WHEN 更新现有计划时，THE Plan_Management_Tool SHALL 用新的计划内容完全替换原有内容
4. WHEN 计划内容为空时，THE Plan_Management_Tool SHALL 清空对应的计划存储

### Requirement 2: 计划查询

**User Story:** 作为悠酱角色，我想要能够查询我的现有计划，以便了解当前的目标和任务安排。

#### Acceptance Criteria

1. WHEN 查询长期计划时，THE Plan_Management_Tool SHALL 返回当前存储的长期计划字符串
2. WHEN 查询短期计划时，THE Plan_Management_Tool SHALL 返回当前存储的短期计划字符串
3. WHEN 查询所有计划时，THE Plan_Management_Tool SHALL 同时返回长期计划和短期计划内容
4. WHEN 计划不存在时，THE Plan_Management_Tool SHALL 返回空字符串或 null

### Requirement 3: Redis 数据持久化

**User Story:** 作为系统管理员，我想要计划数据能够持久化存储，以便角色重启后仍能保持计划连续性。

#### Acceptance Criteria

1. WHEN 存储长期计划时，THE Plan_Management_Tool SHALL 使用固定的 Redis key `plan:long` 存储字符串数据
2. WHEN 存储短期计划时，THE Plan_Management_Tool SHALL 使用固定的 Redis key `plan:short` 存储字符串数据
3. WHEN 存储计划数据时，THE Plan_Management_Tool SHALL 确保数据持久化不设置过期时间
4. WHEN 读取计划数据时，THE Plan_Management_Tool SHALL 正确处理 Redis 连接异常情况

### Requirement 4: LLM Function Tool 集成

**User Story:** 作为 AI 模型，我想要能够调用计划管理功能，以便在决策过程中考虑角色的计划安排。

#### Acceptance Criteria

1. WHEN AI 模型需要设置计划时，THE Plan_Management_Tool SHALL 提供结构化的函数接口供调用
2. WHEN AI 模型查询计划时，THE Plan_Management_Tool SHALL 返回格式化的计划信息用于决策参考
3. WHEN 集成到 chooseAction 流程时，THE Plan_Management_Tool SHALL 不影响现有的行为决策性能
4. WHEN 函数调用失败时，THE Plan_Management_Tool SHALL 返回友好的错误信息而不中断主流程
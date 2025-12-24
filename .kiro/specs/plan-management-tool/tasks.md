# Implementation Plan: Plan Management Tool

## Overview

实现一个简单高效的计划管理工具，提供长期计划和短期计划的设置、更新和查询功能。工具将作为 LLM Function Tool 集成到现有的行为决策系统中，使用 ioredis 进行 Redis 数据持久化。

## Tasks

- [x] 1. 创建基础工具模块结构
  - 在 `packages/utils/src/llm-tools/` 目录下创建 `plan-management-tool.ts` 文件
  - 定义基本的类型接口和常量
  - 设置 Redis 连接配置
  - _Requirements: 3.1, 3.2_

- [x] 2. 实现核心计划管理功能
  - [x] 2.1 实现 setPlan 功能
    - 创建设置计划的核心逻辑
    - 处理空字符串清空计划的情况
    - 使用正确的 Redis key 存储数据
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 实现 getPlan 功能
    - 创建查询单个计划的逻辑
    - 处理计划不存在的情况
    - 确保返回正确的数据格式
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 2.3 实现 getAllPlans 功能
    - 创建查询所有计划的逻辑
    - 同时获取长期和短期计划
    - 返回结构化的计划数据
    - _Requirements: 2.3_

- [x] 3. 创建 Vercel AI SDK 工具定义
  - [x] 3.1 定义 setPlan 工具
    - 使用 `tool` 函数创建工具定义
    - 配置 Zod schema 进行参数验证
    - 实现 execute 函数调用核心逻辑
    - _Requirements: 4.1_

  - [x] 3.2 定义 getPlan 工具
    - 创建查询单个计划的工具定义
    - 配置参数验证和描述
    - 实现执行逻辑
    - _Requirements: 4.1_

  - [x] 3.3 定义 getAllPlans 工具
    - 创建查询所有计划的工具定义
    - 无需参数的工具配置
    - 实现执行逻辑
    - _Requirements: 4.1_

- [ ] 4. 添加错误处理和数据验证
  - 实现 Redis 连接异常处理
  - 添加参数验证和错误信息返回
  - 确保工具调用失败时不中断主流程
  - _Requirements: 3.4, 4.4_

- [ ] 5. 导出工具模块
  - 在 `packages/utils/src/index.ts` 中导出计划管理工具
  - 确保工具可以被其他包正确引用
  - 添加必要的类型导出
  - _Requirements: 4.1, 4.2_

- [ ] 6. 集成到 LLM 客户端
  - 修改 `packages/world/src/llm/llm-client.ts`
  - 将计划管理工具添加到 `generateText` 或 `generateObject` 调用中
  - 确保工具可以在行为决策过程中被调用
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 7. 最终检查点
  - 确保所有功能正常工作，询问用户是否有问题

## Notes

- 所有任务都专注于核心功能实现
- 使用 TypeScript 进行类型安全
- 遵循项目现有的代码规范和结构
- 每个任务都明确引用了相关的需求条目
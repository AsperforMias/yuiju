# 提示词与数据源 (@yuiju/source)

`@yuiju/source` 负责沉淀项目中的提示词、训练数据与辅助脚本，是 LLM 行为决策与数据构造的来源层。

## 项目概述

这个子包本身不提供独立运行服务，主要提供三类内容：

- Prompt 模板：给 `world`、`message` 等子包使用
- 数据集：用于手工整理或生成训练数据
- 转换脚本：辅助 JSON / JSONL 数据处理

## 核心能力

- **行为决策 Prompt**：为 Agent 动作选择、参数选择提供提示词模板
- **设定资料 Prompt**：角色卡、世界观、地图等内容生成
- **数据资产管理**：维护手写样本、模板样本、生成样本
- **辅助脚本**：支持数据格式转换与导出

## 目录结构

```text
prompt/
├── index.ts          # Prompt 统一导出
├── character-card.ts # 角色卡相关 Prompt
├── world-map.ts      # 地图与场景相关 Prompt
├── world-view.ts     # 世界观相关 Prompt
└── utils.ts          # Prompt 工具函数

dataset/
├── handwritten.jsonl
├── template.jsonl
├── train.jsonl
└── llm-generation.jsonl

scripts/
└── jsonl-transfer.ts # 数据转换脚本
```

## 依赖关系

- `world`：使用 Prompt 进行动作与参数决策
- `message`：使用 Prompt 组织对话相关上下文
- `utils`：提供基础类型与通用工具

## 使用方式

### 在业务包中引入 Prompt

```ts
import { chooseActionPrompt } from "@yuiju/source";
```

### 处理数据集

若需要运行数据脚本，可结合 `tsx` 在根目录执行对应脚本，例如：

```bash
pnpm tsx packages/source/scripts/jsonl-transfer.ts
```

## 注意事项

- 该包目前没有独立脚本命令，更多是被其他包以 workspace 依赖方式消费。
- 数据集文件较多，修改时建议保持字段结构稳定，避免影响下游 Prompt 或训练流程。
- Prompt 文案的调整会直接影响 Agent 的行为决策结果，建议配合 `world` 测试一起验证。

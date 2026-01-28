# 技术方案

## 目标

- 为“悠酱”引入可检索、可沉淀、可演进的长期记忆能力
- 统一接入两类信息源：
  - 聊天侧（IM 消息）：用户与悠酱的文本交互
  - 世界侧（虚拟世界）：行为记录（行动/结果/参数/计划变化等）
- 记忆能力对上游提供两类能力：
  - 写入（Ingestion）：将“高价值信息”以 episode 的形式写入图谱
  - 检索（Retrieval）：在生成回复或决策时，按需检索相关记忆片段

## 非目标

- 不替代现有 MongoDB/Redis 的“状态与流水”存储：它们仍是审计、回放、状态一致性的基础
- 不追求首期就实现复杂的多模态记忆（图片/音频）、复杂的权限体系与 UI 展示
- 不在首期强制对所有世界 tick/所有消息逐条入图，优先保证成本可控与召回质量

## 现状概览（基于项目代码）

- 聊天侧：对话历史主要在内存中短窗口保存（小时级 + 条数限制），缺少跨天可检索记忆
- 世界侧：行为流水在生产环境写入 MongoDB，可读取“最近 N 条”作为上下文，但不具备长期语义检索
- 记忆工具：已有基于 mem0 的 `memorySearchTool`（向量搜索），尚未与 graphiti_core 打通
- Python 侧：仓库内已有 `packages/memory`，可作为 graphiti_core 接入起点

## Python 技术选型（Memory HTTP Service）

- Web 框架：FastAPI
  - 原因：类型提示友好、生态成熟、路由与依赖注入清晰，适合快速搭建稳定的 HTTP API
- ASGI Server：uvicorn
  - 原因：与 FastAPI 配套、性能与部署体验成熟
- Graph/存储：graphiti_core + Neo4j
  - 原因：graphiti_core 提供 episode 写入与图谱检索能力；Neo4j 作为图数据库后端
- 运行模型：async/await 全异步
  - 原因：graphiti_core 本身以异步调用为主，服务端保持异步可提升吞吐并简化并发处理
- 配置方式：环境变量
  - 原因：避免在代码中硬编码任何密钥/连接信息，便于本地与生产环境切换

## 模块改动（落地到本项目）

本节补齐落地时 `@yuiju/message` 与 `@yuiju/world` 的具体改动点，确保方案可直接进入实现阶段。

### `@yuiju/message`（聊天侧）需要的改动

目标：实现“按时间窗合并”的准实时写入 + 在生成回复前检索记忆注入（工具检索）。

改动点（建议按优先级从上到下落地）：

1) 原始消息落库（用于审计/补偿）
- 改动文件：
  - `packages/message/src/server.ts`
  - `packages/utils/src/db/schema/qq-message.schema.ts`（当前仅定义，需在 message 侧使用）
- 行为：
  - 收到用户消息：写入一条 `{ senderName/user_name, content, timestamp }`
  - 发送给用户的回复：也写入一条（建议在 schema 中增加 role 字段；如果不改 schema，至少以 senderName 区分来源会很别扭）

2) 会话片段合并（按时间窗合并）
- 改动位置（实现形式二选一）：
  - 位置一：在 `packages/message/src/conversation.ts` 增强为“可结算的时间窗缓冲区”
  - 位置二：在 `packages/message/src/llm/manager.ts` 内维护一个按 user 隔离的写入缓冲区
- 关键规则：
  - 默认时间窗 10 分钟（可配置）
  - 超过时间窗无新消息：结算上一个片段并写入 Memory Service
  - 命中高价值触发（偏好/设定/关系变化等）：立即结算（可选）
- 产物：
  - 生成结构化 JSON episode（包含 user_name、window_start/window_end、messages 列表等）

3) Memory Service Client（HTTP 调用封装）
- 改动文件：
  - 新增一个轻量 client（建议放在 `packages/message/src/memory/` 或 `packages/utils/src/memory/`，用于复用）
- 能力：
  - `writeEpisode(...)`：写入 episode（带超时控制）
  - `searchMemory(...)`：检索记忆（带超时）

4) 替换/扩展记忆检索工具（用于 LLM 工具检索）
- 改动文件：
  - `packages/message/src/llm/tools/memorySearchTool.ts`
- 行为：
  - 将当前 mem0 检索替换为调用 Memory Service 的 `/v1/search`
  - 输入使用 `user_name`（与 IM 消息侧保持一致）
  - 输出保持 “[{ memory, time }]” 这种易注入格式，避免塞入过长原文

5) 在生成回复前注入检索结果
- 改动文件：
  - `packages/message/src/llm/manager.ts`
- 行为：
  - 在构造 messages/systemPrompt 之前或生成过程中，通过工具检索与当前输入相关的记忆
  - 将命中的记忆以固定格式注入（工具检索结果 → 提示词片段）
  - 约束注入条数/长度，确保 token 可控（例如 top_k=5，且每条 memory 限长）

### `@yuiju/world`（世界侧）需要的改动

目标：将“行为完成事件”转为可检索的世界记忆 episode，并在需要时辅助决策。

改动点：

1) 行为完成后生成世界 episode 并写入
- 改动文件：
  - `packages/world/src/engine/tick.ts`
- 行为：
  - 在行为执行完成并生成 `description/parameters/duration` 后，构造结构化 JSON episode
  - 过滤低价值行为（例如 Idle/重复动作），避免噪声
  - 调用 Memory Service 的写入接口（建议异步，不阻塞 tick 主流程）

2) 为世界记忆设置合理的隔离维度
- 世界侧记忆主体固定为“ゆいじゅ”：
  - 写入 episode 时固定 `user_name = "ゆいじゅ"`

## 总体架构（HTTP Memory Service）

采用“Node 业务侧 + Python 记忆服务”的边界分层：

- Node（业务侧）
  - 负责采集原始事件、落库、合并策略、调用检索工具
  - 不直接依赖 graphiti_core
- Python（记忆服务）
  - 常驻 HTTP 服务进程，封装 graphiti_core 与 Neo4j 的连接、写入与检索
  - 提供稳定的 API 合约，便于替换/扩展

### 组件划分

1) Memory HTTP Service（Python）
- 职责：episode 写入、记忆检索、基础健康检查
- 内部依赖：graphiti_core、Neo4j、LLM/Embedding/Rerank 配置

2) Memory Client（Node）
- 职责：封装对 Python 服务的 HTTP 调用（含超时控制）
- 使用位置：
  - 聊天侧：作为 LLM 工具（Tool）在生成前检索
  - 写入侧：异步推送 episode（聊天片段、世界行为摘要）

3) Ingestion Aggregator（Node）
- 职责：将原始事件（IM 消息/行为记录）合并成“可写入 episode”
- 策略：
  - 聊天侧采用“按时间窗合并”的准实时写入（建议默认 10 分钟，可配置）
  - 世界侧按“行为完成事件”写入，必要时过滤低价值/高噪声行为

## 数据流设计

### A. 聊天写入（IM 消息 → 片段 episode）

1) 采集：每条 IM 消息进入 Node 消息处理链路
2) 落库（原始事件）：写入数据库（用于审计与异步补偿）
3) 合并（按时间窗合并）
- 将连续消息按时间窗（例如 10 分钟）合并为一个“会话片段”
- 触发条件：
  - 超过时间窗无新消息：结算上一个片段
  - 命中“高价值触发”：立即结算（可选）
4) 写入（episode）：Node 调用 Python Memory Service 的写入 API

#### 片段内容建议（结构化 JSON）

使用 JSON episode 以降低 token、提升可解析性：

- user_name：用户名称（来自 IM 昵称；首期以此作为记忆主体标识）
- window_start / window_end：片段时间范围
- messages：[{ role: "user" | "assistant", content, ts }]
- tags：可选标签（例如 preference/relationship/profile/task）

### B. 世界写入（行为流水 → 行为 episode）

1) 采集：世界引擎每次行为完成后已有行为记录
2) 落库：MongoDB 保存全量行为流水
3) 写入 episode（建议默认开启）
- 对每次“行为完成事件”生成 1 条 episode（结构化 JSON）
- 对低价值行为可过滤（如 Idle/重复无信息动作）

#### 行为 episode 内容建议（结构化 JSON）

- user_name：固定为 "ゆいじゅ"
- ts：发生时间
- action：行为类型
- reason/description：决策原因 + 执行结果摘要
- parameters：行为参数（如吃了什么/买了什么）
- state_delta（可选）：关键状态变化（体力/金钱/位置/计划变更）

## 检索设计（Retrieval）

### 检索触发点

- 聊天侧：在生成回复前，通过工具检索与当前用户输入相关的记忆片段

### 召回策略

- 输入：query（用户输入/问题）、user_name、top_k
- 输出：返回可直接注入提示词的“记忆摘要列表”
  - 每条包含：memory（简短事实/摘要）、time（可选）、source（chat/world）、confidence（可选）

### 注入方式

优先使用“工具检索”而非无脑拼接到 system prompt：

- 优点：token 可控、只在需要时检索、便于调试与观测
- 在提示词中以固定格式注入，例如“相关记忆：- ...”

## Memory Service API 合约（建议）

### 1) Health

- GET /healthz
  - 返回服务状态、Neo4j 连接可用性（可选）

### 2) 写入 episode

- POST /v1/episodes
  - body：
    - user_name：记忆主体名称（聊天侧为 IM 用户名；世界侧固定为 "ゆいじゅ"）
    - type："chat_window" | "world_action" | "fact"
    - content：string | object（优先 object）
    - reference_time：ISO 时间
  - response：episode_id、写入状态

### 3) 检索

- POST /v1/search
  - body：
    - user_name
    - query
    - top_k
    - filters（可选：type/source/time_range）
  - response：[{ memory, time, source, score }]

## 成本与 token 控制策略

已知频率：

- 世界侧：平均 30 分钟/次行为 ≈ 48 次/天
- 聊天侧：约 50 条消息/天（无轮次概念）

控制要点：

- 聊天侧不要“每条消息一条 episode”，采用“时间窗合并”减少 episode 数量与固定开销
- 世界侧按“行为完成事件”写入，48 条/天通常可控；必要时对噪声行为过滤
- 优先结构化 JSON episode，减少冗余自然语言，降低写入 token

## 可靠性设计

- 写入顺序：同一 `user_name` 的写入建议按时间顺序提交，避免片段乱序导致检索体验下降

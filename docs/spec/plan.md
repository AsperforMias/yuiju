# 代码实现 plan（记忆模块接入）

## 目标

- 新增一个 Python HTTP 记忆服务，提供写入 episode 与检索记忆两个能力
- `@yuiju/message`：
  - 保存 IM 原始消息（用户消息 + 悠酱回复）
  - 按时间窗（默认 10 分钟）合并为“聊天片段 episode”，写入记忆服务
  - 定义一个检索相关记忆的 function tool，在生成回复时，LLM 可以选择调用工具
- `@yuiju/world`：
  - 每次行为完成后构造“世界行为 episode”，写入记忆服务（记忆主体固定为「ゆいじゅ」）

## 交付物清单

### 1) Python：Memory HTTP Service

目标：实现最小可用 HTTP API。

- 位置：`packages/memory/`
- 依赖：
  - FastAPI
  - uvicorn
  - graphiti_core
- API：
  - `GET /healthz`
  - `POST /v1/episodes`
    - 入参：`{ user_name, type, content, reference_time }`
    - 行为：将 content（string/object）写入 graphiti episode
  - `POST /v1/search`
    - 入参：`{ user_name, query, top_k, filters? }`
    - 行为：调用 graphiti search，返回记忆摘要列表

实现步骤：

1. 在 `packages/memory` 内新增 FastAPI 应用入口 server.py
2. 抽一个 Graphiti 初始化模块（如 `graphiti_client.py`），负责：
   - 从环境变量读取 Neo4j/LLM/Embedding 配置
   - 启动时初始化 Graphiti 实例并复用（全局单例）
3. 实现 `/v1/episodes`：
   - 统一将 content 转为字符串（若为 object 则 JSON 序列化）
   - `name` 字段用可读的方式拼出来（例如：`{user_name}-{type}-{reference_time}`）
4. 实现 `/v1/search`：
   - 返回结构统一：`[{ memory, time, source, score }]`
   - `source` 可直接回传 `type` 或固定为 `graphiti`

### 2) Node：`@yuiju/message`（聊天侧）

目标：打通“写入（聊天片段）+ 检索注入”。

改动文件（预期）：

- `packages/message/src/server.ts`
- `packages/message/src/llm/manager.ts`
- `packages/message/src/llm/tools/memorySearchTool.ts`
- `packages/message/src/conversation.ts`（若选择在此实现时间窗缓冲）
- `packages/utils/src/db/schema/qq-message.schema.ts`（扩展字段）
- 新增：一个 Memory Service HTTP Client（建议放在 `packages/message/src/memory/` 或 `packages/utils/src/memory/`）

实现步骤：

1. 扩展 QQ 消息 schema（建议字段）：
   - `user_name: string`（原 senderName 可保留或重命名）
   - `role: "user" | "assistant"`
   - `content: string`
   - `timestamp: Date`
2. 在 `server.ts` 中：
   - 收到用户消息时写入一条 `{ user_name, role: "user", content, timestamp }`
   - 得到 LLM 回复后写入一条 `{ user_name, role: "assistant", content, timestamp }`
3. 实现“按时间窗合并”的缓冲器：
   - 每个 `user_name` 维护一个 buffer（messages 列表 + window_start + last_ts）
   - 规则：
     - 当前消息与 last_ts 间隔 > 10 分钟：先把上一段结算为 episode 并写入；再开启新窗口
     - 否则追加到当前窗口
   - 结算时生成 `chat_window` episode：
     - `{ user_name, window_start, window_end, messages: [...] }`
4. 新增 Memory Service Client：
   - `writeEpisode({ user_name, type, content, reference_time })`
   - `searchMemory({ user_name, query, top_k })`
5. 替换 `memorySearchTool.ts`：
   - 由 mem0 改为调用 Memory Service `/v1/search`
   - 入参：`{ query, userName }` 保持不变，但内部映射为 `user_name`
6. 在 `llm/manager.ts` 中注入检索结果：
   - 在调用 `generateText` 前先检索 `top_k=5`
   - 将检索结果以固定文本块注入到 systemPrompt（或作为一条 system/user message 注入）
   - 限制单条记忆长度（例如截断到 200 字），避免 prompt 过长

### 3) Node：`@yuiju/world`（世界侧）

目标：每次行为完成后写入 world_action episode，主体固定为「ゆいじゅ」。

改动文件（预期）：

- `packages/world/src/engine/tick.ts`
- 新增/复用 Memory Service Client（建议复用 `@yuiju/utils` 内的 client，避免 message/world 各写一套）

实现步骤：

1. 在 `tick.ts` 行为执行完成后（已有 description/parameters/duration 的位置）构造 episode：
   - `user_name: "ゆいじゅ"`
   - `type: "world_action"`
   - `reference_time: 行为完成时间`
   - `content`（JSON）：
     - `ts`
     - `action`
     - `reason/description`
     - `parameters`
     - `duration_minutes`
2. 增加简单过滤规则（首期最小）：
   - `action === Idle` 时不写入
3. 调用 Memory Service `/v1/episodes` 写入

## 联调顺序建议

1. 先把 Python Memory Service 跑通（health + episodes + search）
2. 接入 `@yuiju/message` 的检索工具（先检索再注入）
3. 接入 `@yuiju/message` 的聊天片段写入（按时间窗合并）
4. 接入 `@yuiju/world` 的行为写入（过滤 Idle）

## 验收标准

- 聊天侧：同一用户在 10 分钟内的多条消息会合并写入为 1 条 chat_window episode
- 聊天侧：生成回复前能检索出相关记忆，并注入到模型上下文
- 世界侧：每次非 Idle 行为完成后写入 1 条 world_action episode，`user_name` 固定为「ゆいじゅ」
- Memory Service：提供 health、写入、检索三个接口可用，并能完成端到端联调

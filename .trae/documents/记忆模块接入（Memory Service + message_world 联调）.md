## 背景与现状（已核对代码）
- Python 侧已有 [main.py](file:///Users/yixiaojiu/Code/everything/yuiju/packages/memory/main.py) 示例脚本，但不是 HTTP 服务，且包含硬编码密钥/密码（需要改为环境变量读取）。
- message 侧已有 [memorySearchTool.ts](file:///Users/yixiaojiu/Code/everything/yuiju/packages/message/src/llm/tools/memorySearchTool.ts)（mem0ai），但目前 **没有被** [LLMManager](file:///Users/yixiaojiu/Code/everything/yuiju/packages/message/src/llm/manager.ts) 注册为工具，也没有手动检索注入，因此实际不生效。
- world 侧（[tick.ts](file:///Users/yixiaojiu/Code/everything/yuiju/packages/world/src/engine/tick.ts)）没有任何记忆写入/检索逻辑。

## 目标（严格对齐 docs/spec/plan.md）
- Python：提供最小可用 Memory HTTP Service：`GET /healthz`、`POST /v1/episodes`、`POST /v1/search`。
- message：
  - 落库保存原始 IM 消息（用户 + 悠酱回复）；
  - 按时间窗（默认 10 分钟）合并为 `chat_window` episode 写入记忆服务；
  - 提供 memory search function tool；并在生成回复前做一次检索并注入上下文。
- world：每次非 Idle 行为完成后写入 `world_action` episode（主体固定 `user_name="ゆいじゅ"`）。

## 总体方案（去复杂化）
- **统一“记忆服务接口”**：Node 侧通过一个轻量 `MemoryServiceClient`（基于原生 `fetch`）访问 Python HTTP 服务，避免 message/world 各写一套。
- **episode 结构稳定**：
  - `chat_window`：包含窗口起止时间与 messages 列表（每条含 role/content/timestamp）。
  - `world_action`：包含行为、原因/描述、参数、耗时、时间戳。
- **检索注入方式固定**：回复生成前先 `top_k=5` 检索，把结果截断后以固定文本块追加到 system prompt（可控且稳定）；同时把 tool 注册给模型按需调用。

## 详细实施步骤（按交付物）

### 1) Python：Memory HTTP Service（packages/memory）
1. **重构为 FastAPI 服务入口**
   - 新增 `server.py`：创建 FastAPI app，挂载 `/healthz`、`/v1/episodes`、`/v1/search`。
   - 新增 `graphiti_client.py`：
     - 从环境变量读取 Neo4j/LLM/Embedding 配置；
     - 启动时初始化 Graphiti 单例并复用；
     - shutdown 时关闭连接。
2. **/v1/episodes**
   - 入参：`{ user_name, type, content, reference_time }`（Pydantic 校验）。
   - 逻辑：
     - `content` 若为 object → `json.dumps`；统一写入 Graphiti episode_body；
     - `name = f"{user_name}-{type}-{reference_time}"`（可读且可追溯）；
     - `source` 使用 `type` 或固定字符串（按你文档里建议优先用 `type`）。
3. **/v1/search**
   - 入参：`{ user_name, query, top_k, filters? }`。
   - 逻辑：调用 graphiti search，返回统一结构：`[{ memory, time, source, score }]`。
     - `memory`：优先用 `result.fact`（Graphiti search 返回的事实字符串）。
     - `time/score`：若 Graphiti 返回对象没有对应字段，则置空或给默认值（保证 API 形状稳定）。
4. **依赖与安全**
   - 更新 `pyproject.toml`：补齐 FastAPI/uvicorn（仅最小依赖）。
   - 清理/改造现有 `main.py`：移除硬编码密钥与密码，全部改从环境变量读取（避免泄露）。

### 2) Node：@yuiju/utils 提供 Memory Service Client（共享）
1. 在 `packages/utils/src/` 新增一个 `memory/` 目录（并从 `utils/src/index.ts` 导出）。
2. 实现 `MemoryServiceClient`：
   - `writeEpisode({ user_name, type, content, reference_time })` → POST `/v1/episodes`
   - `searchMemory({ user_name, query, top_k, filters? })` → POST `/v1/search`
   - baseURL 通过环境变量（例如 `MEMORY_SERVICE_URL`）配置。
3. 实现保持“简单但可用”的错误处理：`res.ok` 检查 + 失败抛错（不引入重试/降级）。

### 3) Node：@yuiju/message（聊天侧写入 + 检索注入）
1. **扩展 QQ 消息 schema**
   - 修改 [qq-message.schema.ts](file:///Users/yixiaojiu/Code/everything/yuiju/packages/utils/src/db/schema/qq-message.schema.ts)：增加 `user_name`、`role: "user"|"assistant"`；保留 `senderName` 兼容或改为非必填（按你确认）。
2. **server.ts 落库与缓冲**
   - 在 [server.ts](file:///Users/yixiaojiu/Code/everything/yuiju/packages/message/src/server.ts) 收到用户消息时写一条 role=user；生成回复后写一条 role=assistant。
   - 同时把两条消息喂给 `chat_window` 缓冲器。
3. **实现 10 分钟窗口合并缓冲器**
   - 新增 `chatEpisodeBuffer.ts`（建议放 `packages/message/src/memory/`）：
     - 按 `user_name` 维护：`messages[] + window_start + last_ts`。
     - 当 `now - last_ts > 10min`：结算上一段 → 调用 `MemoryServiceClient.writeEpisode(type="chat_window")`。
     - 结算内容：`{ user_name, window_start, window_end, messages }`。
4. **替换 memorySearchTool 为 Memory Service 版**
   - 改造 [memorySearchTool.ts](file:///Users/yixiaojiu/Code/everything/yuiju/packages/message/src/llm/tools/memorySearchTool.ts) ：
     - 保持 tool 入参 `{ query, userName }`；内部映射为 `user_name`；
     - 调用 `MemoryServiceClient.searchMemory(top_k=5)`；
     - 输出固定：`[{ memory, time, source, score }]`（或简化成 `{memory,time}`，按你确认）。
5. **LLMManager 注入检索结果 + 注册 tool**
   - 修改 [manager.ts](file:///Users/yixiaojiu/Code/everything/yuiju/packages/message/src/llm/manager.ts)：
     - `generateText` 前先 `searchMemory(user_name=userName, query=input, top_k=5)`；
     - 将结果截断（每条 ≤200 字）后以固定块追加到 `systemPrompt`；
     - 给 `generateText` 传 `tools`，让模型可选调用 `memorySearchTool`。

### 4) Node：@yuiju/world（行为写入 episode）
1. 在 [tick.ts](file:///Users/yixiaojiu/Code/everything/yuiju/packages/world/src/engine/tick.ts) 行为执行完成、算出 `durationMin/description/parameters` 后：
   - 若 `selectedAction.action === ActionId.Idle` 则跳过；
   - 调用 `MemoryServiceClient.writeEpisode`：
     - `user_name: "ゆいじゅ"`
     - `type: "world_action"`
     - `reference_time: 行为完成时间（new Date().toISOString()）`
     - `content`（JSON）：`{ ts, action, reason/description, parameters, duration_minutes }`
2. 记忆服务 baseURL 未配置时直接不写入（避免影响本地运行）。

## 验证方式（实现后我会按此自测）
- Python：
  - `/healthz` 返回 200；
  - `/v1/episodes` 写入后可通过 `/v1/search` 检索到相关 `memory`。
- message：
  - 同一用户 10 分钟内多条消息会被合并为 1 条 `chat_window` episode（窗口结算时写入）；
  - 生成回复前会检索 `top_k=5` 并注入到 system prompt；tool 也可被调用。
- world：
  - 每次非 Idle 行为完成后写入 1 条 `world_action` episode，`user_name` 固定为「ゆいじゅ」。

## 需要你确认的点（我不擅自决定）
1. **chat_window 的“写入时机”**：只在“超过 10 分钟无新消息”时结算写入，是否符合你的预期？（这样能保证“10 分钟内只写 1 条”，但窗口未结束前不会立刻落到记忆服务。）
2. **QQMessage schema 兼容性**：`senderName` 要不要保留为必填字段，还是改为可选并以 `user_name` 为主？
3. **memorySearchTool 的返回结构**：你希望 tool 返回 `[{ memory, time, source, score }]`（与服务一致），还是继续保持当前简化版 `[{ memory, time }]`？

你确认后，我再开始逐文件写代码与加注释。
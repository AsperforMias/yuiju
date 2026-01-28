# yuiju-memory

悠酱项目的长期记忆服务，基于 [Graphiti](https://github.com/getgether/graphiti-core) 构建的图知识库记忆系统。

## 项目概述

提供语义化的长期记忆存储与检索能力，支持：

- 将各类事件（Episode）写入图知识库
- 基于语义相似度的智能检索
- 用户隔离的记忆管理

## 核心功能

### 1. Episode 写入

将结构化数据写入图知识库，支持：

- 多类型内容（文本 / JSON）
- 用户隔离（user_name）
- 时间相关性（reference_time）
- 自动语义提取与关系构建

### 2. 语义检索

基于向量检索 + 重排序的混合搜索：

- 支持自然语言查询
- 返回相关性评分的记忆片段
- 可选的 Graphiti SearchFilters 过滤

## 技术架构

```
Graphiti (图知识库)
    ├── Neo4j (图数据库)
    ├── OpenAI-compatible LLM (语义提取)
    ├── OpenAI-compatible Embedding (向量化)
    └── Cross-encoder Reranker (重排序)
         ↓
FastAPI HTTP 服务
```

## API 接口

### POST /v1/episodes - 写入 Episode

**请求体**：

```json
{
  "user_name": "yuiju",
  "type": "chat_message",
  "content": "今天天气真好，想去公园散步",
  "reference_time": "2025-01-28T12:00:00Z"
}
```

**响应**：

```json
{
  "ok": true
}
```

### POST /v1/search - 语义检索

**请求体**：

```json
{
  "user_name": "yuiju",
  "query": "悠酱最近喜欢做什么？",
  "top_k": 5,
  "filters": null
}
```

**响应**：

```json
[
  {
    "memory": "悠酱喜欢在天气好的时候去公园散步",
    "time": "2025-01-28T12:00:00Z",
    "source": "yuiju-chat_message-2025-01-28T12:00:00Z",
    "score": 0.95
  }
]
```

## 环境变量配置

所有敏感配置均从环境变量读取，**禁止在代码中硬编码**。

### Neo4j 配置（必需）

```bash
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
```

### LLM 配置（必需）

```bash
MEMORY_LLM_API_KEY=sk-xxx
MEMORY_LLM_BASE_URL=https://api.siliconflow.cn/v1
MEMORY_LLM_MODEL=Qwen/Qwen2.5-72B-Instruct
MEMORY_LLM_SMALL_MODEL=Qwen/Qwen2.5-7B-Instruct  # 可选，默认使用 LLM_MODEL
```

### Embedding 配置（必需）

```bash
MEMORY_EMBEDDING_API_KEY=sk-xxx  # 可选，默认复用 LLM_API_KEY
MEMORY_EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1  # 可选，默认复用 LLM_BASE_URL
MEMORY_EMBEDDING_MODEL=BAAI/bge-large-zh-v1.5
```

### Reranker 配置（可选）

```bash
MEMORY_RERANKER_API_KEY=sk-xxx  # 可选，默认复用 LLM_API_KEY
MEMORY_RERANKER_BASE_URL=https://api.siliconflow.cn/v1  # 可选，默认复用 LLM_BASE_URL
MEMORY_RERANKER_MODEL=BAAI/bge-reranker-v2-m3  # 可选，默认使用 LLM_SMALL_MODEL
```

## 目录结构

```
packages/memory/
├── graphiti_client.py    # Graphiti 客户端单例管理
│   ├── GraphitiEnv       # 环境变量配置数据类
│   ├── load_graphiti_env # 加载环境变量
│   ├── get_graphiti      # 获取全局单例
│   └── close_graphiti    # 关闭连接
├── server.py             # FastAPI HTTP 服务
│   ├── /healthz          # 健康检查
│   ├── /v1/episodes      # Episode 写入接口
│   └── /v1/search        # 语义检索接口
├── main.py               # 本地快速验证脚本（仅开发用）
└── pyproject.toml        # Python 项目配置
```

## 开发说明

### 安装依赖

```bash
cd packages/memory
uv sync
```

### 本地验证（使用 main.py）

```bash
# 确保已配置所有环境变量（见上方"环境变量配置"章节）
uv run python main.py
```

### 启动服务（使用 server.py）

```bash
uv run uvicorn server:app --host 0.0.0.0 --port 8000
```

### 健康检查

```bash
curl http://localhost:8000/healthz
```

## 设计要点

1. **用户隔离**：在检索时自动注入 `只检索 user_name={user_name} 的相关事实` 提示，在写入时将 user_name 混入 episode_body 的 meta 字段，确保记忆隔离。

2. **全局单例**：`get_graphiti()` 使用单例模式 + 锁机制，避免重复建连和重复建索引。

3. **时间感知**：所有 episode 都有 `reference_time`，支持时间相关的检索（如"最近的记忆"）。

4. **内容序列化**：`_stringify_episode_content` 将任意 JSON 内容统一转为字符串，保持 meta 信息的一致性。

5. **混合检索**：使用 `COMBINED_HYBRID_SEARCH_CROSS_ENCODER` 配置，结合向量检索和重排序，提高检索精度。

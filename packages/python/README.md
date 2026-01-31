# python 服务

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

## API 接口

### POST /v1/episodes - 写入 Episode

**请求体**：

```json
{
  "user_name": "yuiju",
  "is_dev": true,
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
  "is_dev": true,
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

### 启动服务（使用 server.py）

```bash
uv run uvicorn server:app --host 0.0.0.0 --port 8096
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

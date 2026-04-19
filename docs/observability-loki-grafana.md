# 服务日志观测（Loki + Grafana）

本文档说明如何为 `@yuiju/world` 和 `@yuiju/message` 引入 Loki/Grafana 日志观测，并在 `web` 页面内检索日志。

## 1. 启动 observability 服务

在项目根目录执行：

```bash
pnpm run obs:up
```

查看状态：

```bash
pnpm run obs:ps
```

查看日志：

```bash
pnpm run obs:logs
```

停止服务：

```bash
pnpm run obs:down
```

## 2. 访问地址

- Loki: `http://localhost:3100`
- Grafana: `http://localhost:3002`（默认账号密码 `admin / admin`）

Grafana 已通过 provisioning 自动添加 Loki 数据源。

并且会自动加载预置 Dashboard：`Yuiju Logs Overview`（文件位于 `observability/grafana/provisioning/dashboards/json/yuiju-logs-overview.json`）。

## 3. 日志采集范围

Promtail 会采集以下目录下的日志文件：

- `packages/world/logs/*.log`
- `packages/message/logs/*.log`

采集标签包括：

- `service=world|message`
- `job=yuiju-world|yuiju-message`
- `level`（从日志文本解析）

## 4. Web 日志页

`@yuiju/web` 新增了日志页面：

- 页面路径：`/logs`
- API 路径：`/api/nodejs/logs/search`

支持筛选项：

- 服务（world/message/all）
- 级别（debug/info/warn/error）
- 关键词
- 日期范围（startDate/endDate）

## 5. 预置 Dashboard 包含内容

`Yuiju Logs Overview` 默认包含：

- 日志量趋势（按服务）
- 服务日志占比（饼图）
- 错误日志流（Logs Panel）

适合快速查看最近 6 小时整体日志健康度，再跳转到 `web` 的 `/logs` 页面做细粒度检索。

## 6. 常见问题

- 页面没有日志：
  - 确认 `world` / `message` 服务至少启动过一次并已产生日志文件。
  - 确认 `pnpm run obs:up` 已启动。
- Web 查询 Loki 失败：
  - 确认 Loki 在 `http://127.0.0.1:3100` 可访问。
  - 如需改地址，可设置环境变量 `LOKI_BASE_URL` 给 `web` 进程。

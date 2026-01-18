## 目标
- 在 `packages/web/app/api/nodejs/[[...route]]` 下新增一个 Hono 子路由：提供“给悠酱零花钱（金币）”的 demo 接口。
- 金币写入 Redis 成功后，写入一条行为记录到 MongoDB（复用 `saveBehaviorRecord`），不写 `parameters`。
- 通过 `NODE_ENV=development` 区分线上环境：该接口仅在 development 允许执行，避免误改线上数据。

## 环境区分策略（关键点）
- 复用 `@yuiju/utils/env` 中的 `isDev/isProd`（当前 web nodejs route 已 `import "@yuiju/utils/env"` 会加载 .env 并读取 `NODE_ENV`）。
- 在接口 handler 开头加保护：
  - 若 `isProd`（或 `!isDev`）则直接返回 `403`：`{ code: 403, data: null, message: "demo only (development)" }`
- 说明：Redis key 已天然按 `isDev` 切分（`dev:yuiju:charactor:state` vs `yuiju:charactor:state`），因此确保 `NODE_ENV=development` 时不会碰线上 key。

## 路由结构
- 新增文件：`packages/web/app/api/nodejs/[[...route]]/allowance.ts`
  - 导出 `registerAllowanceRoutes(app)`，在其中注册：`POST /allowance`
- 修改聚合入口：`packages/web/app/api/nodejs/[[...route]]/route.ts`
  - `import { registerAllowanceRoutes } from "./allowance"` 并调用注册函数
  - 保持现有 `GET/POST = handle(app)` 不变

## 接口契约
- `POST /api/nodejs/allowance`
- Request JSON：
  - `amount: number`（必须为有限整数，且 `> 0`）
  - `reason?: string`（可选，用于落库描述）
  - `mode?: "add" | "set"`（可选；默认 `add`）
- Response JSON（成功）：
  - `{ code: 0, data: { previousMoney, currentMoney, delta, mode }, message: "ok" }`
- Response JSON（参数错误）：
  - `{ code: 400, data: null, message: "..." }`

## 金币更新（Redis）
- 复用 `@yuiju/utils`：`getRedis`、`REDIS_KEY_CHARACTER_STATE`、`initCharacterStateData`
- 先 `await initCharacterStateData()` 确保角色状态 Hash 已初始化
- 默认 `mode = "add"`：
  - `currentMoney = await redis.hincrby(REDIS_KEY_CHARACTER_STATE, "money", amount)`
  - `previousMoney = currentMoney - amount`
- 若显式 `mode = "set"`：
  - 使用 `MULTI`：`HGET money` -> `HSET money` -> `HGET money`，得到前后值

## 行为记录（MongoDB）
- 复用 `@yuiju/utils`：`connectDB`、`saveBehaviorRecord`
- 在 web route 内增加“连接缓存”封装，避免每个请求重复 `mongoose.connect`：
  - 模块级 `connectPromise`（首次调用初始化并复用）
- 写入字段（不写 parameters）：
  - `behavior: "翊小久给悠酱零花钱"`
  - `description: "翊小久给悠酱零花钱：+{amount}（{previousMoney} -> {currentMoney}）"`，若有 reason 追加 `"；原因：{reason}"`
  - `trigger: "user"`
  - `timestamp` 不传，使用 schema 默认值

## 错误处理
- 非 development：403（不抛异常）
- 参数错误：400（不抛异常）
- Redis/Mongo 失败：抛出给现有 `app.onError` 统一返回 500

## 验证方式
- `pnpm dev:web`（Next dev 默认 `NODE_ENV=development`）后 curl 调用：
  - 不传 mode（默认 add）验证累加
  - 选做：传 `mode=set` 验证设置余额
- 验证 MongoDB BehaviorRecord 当天新增一条记录（按 timestamp 倒序查看）。

确认以上方案后，我将开始新增 `allowance.ts`、改造聚合 `route.ts`，并完成本地自测。
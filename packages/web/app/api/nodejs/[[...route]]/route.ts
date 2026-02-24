import "@yuiju/utils/env";
import { connectDB } from "@yuiju/utils";
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { activityRoute } from "./activity";
import { chatRoute } from "./chat";
import { homeRoute } from "./home";
import { profileRoute } from "./profile";
import { stateRoute } from "./state";

// 数据库连接状态管理
let dbConnectionStatus: "connected" | "connecting" | "failed" | "not_configured" = "not_configured";

const initializeDatabase = async () => {
  if (!process.env.MONGO_URI) {
    dbConnectionStatus = "not_configured";
    console.warn("MONGO_URI is not set; skip database connection.");
    return;
  }

  dbConnectionStatus = "connecting";
  try {
    await connectDB();
    dbConnectionStatus = "connected";
    console.log("Database connected successfully");
  } catch (err) {
    dbConnectionStatus = "failed";
    console.error("Database connection failed:", err);
    // 这里可以添加降级逻辑，比如使用内存存储或文件存储
  }
};

// 初始化数据库连接
initializeDatabase();

export const runtime = "nodejs";

const app = new Hono().basePath("/api/nodejs");

app.get("/hello", async (context) => {
  return context.json({ hello: "world" });
});

// 数据库连接状态检查中间件
const checkDatabaseConnection = async (context: any, next: any) => {
  if (dbConnectionStatus === "failed") {
    return context.json(
      {
        code: 503,
        data: null,
        message: "数据库连接失败，服务暂时不可用",
      },
      503,
    );
  }

  if (dbConnectionStatus === "connecting") {
    return context.json(
      {
        code: 503,
        data: null,
        message: "数据库连接中，请稍后重试",
      },
      503,
    );
  }

  await next();
};

// 应用数据库连接检查中间件
app.use("/home", checkDatabaseConnection);
app.use("/activity", checkDatabaseConnection);
app.use("/state", checkDatabaseConnection);

app.route("/home", homeRoute);
app.route("/activity", activityRoute);
app.route("/chat", chatRoute);
app.route("/profile", profileRoute);
app.route("/state", stateRoute);

// 全局错误处理
app.onError((err, context) => {
  context.status(500);
  console.error(err);

  return context.json({
    code: 500,
    data: null,
    message: err.message,
  });
});

export const GET = handle(app);
export const POST = handle(app);

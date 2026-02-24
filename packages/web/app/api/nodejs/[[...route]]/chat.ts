import { deepseek } from "@ai-sdk/deepseek";
import { getCharacterCardPrompt } from "@yuiju/source";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import { Hono } from "hono";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const DEFAULT_USER_NAME = "yixiaojiu";
const MAX_HISTORY = 20;

const normalizeText = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const sanitizeHistory = (value: unknown): ChatMessage[] => {
  if (!Array.isArray(value)) return [];
  const items = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const role = (item as ChatMessage).role;
      const content = normalizeText((item as ChatMessage).content);
      if ((role !== "user" && role !== "assistant") || !content) return null;
      return { role, content };
    })
    .filter((item): item is ChatMessage => Boolean(item));

  if (items.length <= MAX_HISTORY) return items;
  return items.slice(items.length - MAX_HISTORY);
};

export const chatRoute = new Hono();

// 简单的内存速率限制器
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1分钟
const RATE_LIMIT_MAX = 10; // 每分钟最多10次请求

const checkRateLimit = (identifier: string): boolean => {
  const now = Date.now();
  const key = identifier;

  const current = rateLimitStore.get(key);
  if (!current || now > current.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX) {
    return false;
  }

  current.count++;
  return true;
};

// 清理过期的记录
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW);

chatRoute.post("/send", async (context) => {
  // API密钥验证 - 提前返回503错误
  if (!process.env.DEEPSEEK_API_KEY) {
    return context.json(
      {
        code: 503,
        data: null,
        message: "DEEPSEEK_API_KEY is not configured",
      },
      503,
    );
  }

  // 获取客户端标识进行速率限制
  const clientIP =
    context.req.header("x-forwarded-for") || context.req.header("x-real-ip") || "unknown";
  const rateLimitKey = `chat:${clientIP}`;

  if (!checkRateLimit(rateLimitKey)) {
    return context.json(
      {
        code: 429,
        data: null,
        message: "请求过于频繁，请稍后再试",
      },
      429,
    );
  }

  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    return context.json(
      {
        code: 400,
        data: null,
        message: "invalid JSON body",
      },
      400,
    );
  }

  const payload = body as { message?: unknown; userName?: unknown; history?: unknown };
  const message = normalizeText(payload.message);
  if (!message) {
    return context.json(
      {
        code: 400,
        data: null,
        message: "message is required",
      },
      400,
    );
  }

  const userName = normalizeText(payload.userName) || DEFAULT_USER_NAME;
  const history = sanitizeHistory(payload.history);
  const systemPrompt = getCharacterCardPrompt({ userName });

  const messages: ModelMessage[] = history.map((item) => ({
    role: item.role,
    content: item.content,
  }));
  messages.push({ role: "user", content: message });

  const result = await generateText({
    model: deepseek("deepseek-chat"),
    messages,
    system: systemPrompt,
    stopWhen: stepCountIs(5),
  });

  const reply = (result.text || "").trim() || "呜…这句话我一时没理解呢。";

  return context.json({
    code: 0,
    data: {
      reply,
    },
    message: "ok",
  });
});

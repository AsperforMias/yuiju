import "@yuiju/utils/env";

import { deepseek } from "@ai-sdk/deepseek";
import { getCharacterCardPrompt } from "@yuiju/source";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";

const DEFAULT_USER_NAME = "yixiaojiu";
const MAX_HISTORY = 20;

const RATE_LIMIT_WINDOW = 60 * 1000; // 1分钟
const RATE_LIMIT_MAX = 10; // 每分钟最多10次请求

// Review: 后续功能。对ip进行限流，每个 IP 每天只可以访问 x 次
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

type MessageMetadata = {
  createdAt?: number;
};

const checkRateLimit = (identifier: string): boolean => {
  const now = Date.now();
  const current = rateLimitStore.get(identifier);

  if (!current || now > current.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX) {
    return false;
  }

  current.count += 1;
  return true;
};

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return Response.json(
      {
        code: 503,
        data: null,
        message: "DEEPSEEK_API_KEY is not configured",
      },
      { status: 503 },
    );
  }

  const clientIP =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const rateLimitKey = `chat:${clientIP}`;

  if (!checkRateLimit(rateLimitKey)) {
    return Response.json(
      {
        code: 429,
        data: null,
        message: "请求过于频繁，请稍后再试",
      },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        code: 400,
        data: null,
        message: "invalid JSON body",
      },
      { status: 400 },
    );
  }

  const payload = body as { messages?: unknown; userName?: unknown };
  const trimmedUserName = typeof payload.userName === "string" ? payload.userName.trim() : "";
  const userName = trimmedUserName || DEFAULT_USER_NAME;

  const incomingMessages = Array.isArray(payload.messages)
    ? (payload.messages as UIMessage<MessageMetadata>[])
    : [];

  const recentMessages = incomingMessages.slice(-MAX_HISTORY);
  let modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>;
  try {
    modelMessages = await convertToModelMessages(recentMessages);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid messages";
    return Response.json(
      {
        code: 400,
        data: null,
        message,
      },
      { status: 400 },
    );
  }

  const systemPrompt = getCharacterCardPrompt({ userName });

  const result = await streamText({
    model: deepseek("deepseek-chat"),
    messages: modelMessages,
    system: systemPrompt,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: () => ({ createdAt: Date.now() }),
  });
}

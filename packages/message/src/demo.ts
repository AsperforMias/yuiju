import process from "node:process";
import { getMemoryServiceClientFromEnv, isDev, type MemorySearchItem } from "@yuiju/utils";
import { ChatSessionManager } from "./chat-session-manager";

const COUNTERPARTY_NAME = "翊小久";
const MEMORY_SERVICE_URL = "http://localhost:8096";

const printSearchResults = (query: string, items: MemorySearchItem[]) => {
  console.log(`\n=== search: ${query} ===`);
  if (items.length === 0) {
    console.log("(empty)");
    return;
  }
  for (const item of items) {
    console.log(
      JSON.stringify(
        {
          memory: item.memory,
          time: item.time ?? null,
          source: item.source ?? null,
          score: item.score ?? null,
        },
        null,
        2,
      ),
    );
  }
};

const checkMemoryServiceHealth = async () => {
  try {
    const res = await fetch(new URL("/healthz", MEMORY_SERVICE_URL));
    const text = await res.text().catch(() => "");
    console.log(`[memory] healthz: ${res.status} ${text}`);
    return res.ok;
  } catch (err) {
    console.log(`[memory] healthz error: ${(err as Error).message}`);
    return false;
  }
};

const writeMockChatWindows = async (chatSessionManager: ChatSessionManager) => {
  const base = new Date();

  const window1 = [
    {
      role: "user" as const,
      content: "你好ゆいじゅ，我是翊小久。你可以叫我小久。",
      at: new Date(base.getTime() + 1_000),
    },
    {
      role: "assistant" as const,
      content: "你好小久！为了之后更好相处，你有什么偏好或雷区吗？",
      at: new Date(base.getTime() + 3_000),
    },
    {
      role: "user" as const,
      content:
        "有的：我更喜欢按步骤来，别给太多分支方案；饮食上我不太喜欢香菜；饮料我更喜欢无糖乌龙茶。",
      at: new Date(base.getTime() + 7_000),
    },
    {
      role: "assistant" as const,
      content: "收到：小久偏好简洁步骤、不喜欢香菜、喜欢无糖乌龙茶。我会按这个风格来交流。",
      at: new Date(base.getTime() + 10_000),
    },
  ];

  for (const msg of window1) {
    chatSessionManager.recordMessage({
      counterparty_name: COUNTERPARTY_NAME,
      role: msg.role,
      content: msg.content,
      timestamp: msg.at,
    });
  }
  await chatSessionManager.flushUserWindow(COUNTERPARTY_NAME);

  const window2Base = new Date(base.getTime() + 15 * 60 * 1000);
  const window2 = [
    {
      role: "user" as const,
      content: "我也想了解一下：你（ゆいじゅ）这边有什么偏好？",
      at: new Date(window2Base.getTime() + 2_000),
    },
    {
      role: "assistant" as const,
      content:
        "我喜欢被叫「ゆいじゅ」；我更喜欢用中文、语气轻松一点；另外我很喜欢草莓牛奶，不太喜欢被突然催促。",
      at: new Date(window2Base.getTime() + 5_000),
    },
    {
      role: "user" as const,
      content:
        "了解：叫你ゆいじゅ、中文沟通、轻松语气、喜欢草莓牛奶、不喜欢被突然催促。我会注意节奏。",
      at: new Date(window2Base.getTime() + 8_000),
    },
    {
      role: "assistant" as const,
      content: "谢谢小久！那我们就按这个相处规则来继续聊天吧。",
      at: new Date(window2Base.getTime() + 12_000),
    },
  ];

  for (const msg of window2) {
    chatSessionManager.recordMessage({
      counterparty_name: COUNTERPARTY_NAME,
      role: msg.role,
      content: msg.content,
      timestamp: msg.at,
    });
  }
  await chatSessionManager.flushUserWindow(COUNTERPARTY_NAME);
};

const searchMockMemories = async () => {
  const client = getMemoryServiceClientFromEnv();
  if (!client) {
    console.log("[memory] client not configured");
    return;
  }
  const queries = [
    "翊小久 喜欢什么？",
    "翊小久 不喜欢什么？",
    "翊小久 偏好的表达风格是什么？",
    "ゆいじゅ 喜欢什么？",
    "ゆいじゅ 不喜欢什么？",
    "ゆいじゅ 希望被怎么称呼？",
  ];

  for (const query of queries) {
    try {
      const items = await client.searchMemory({
        query,
        top_k: 5,
        counterparty_name: COUNTERPARTY_NAME,
        is_dev: isDev,
      });
      printSearchResults(query, items);
    } catch (err) {
      console.log(`[memory] search error: ${(err as Error).message}`);
    }
  }
};

const main = async () => {
  const ok = await checkMemoryServiceHealth();
  if (!ok) {
    console.log(`[memory] service not ready at ${MEMORY_SERVICE_URL}`);
  }

  const memoryClient = getMemoryServiceClientFromEnv();
  if (!memoryClient) {
    console.log("[memory] client not configured");
    return;
  }
  if (process.env.WRITE_MOCK_CHAT_WINDOWS === "1") {
    const chatSessionManager = new ChatSessionManager({
      memoryClient,
      windowMs: 10 * 60 * 1000,
    });
    await writeMockChatWindows(chatSessionManager);
  }
  await searchMockMemories();
};

void main();

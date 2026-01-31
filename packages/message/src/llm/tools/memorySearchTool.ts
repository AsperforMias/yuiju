import process from "node:process";
import { getMemoryServiceClientFromEnv } from "@yuiju/utils";
import type { Tool } from "ai";
import { z } from "zod";

export const memorySearchTool: Tool = {
  description: "通过向量查询，搜索相关记忆（主体固定为 ゆいじゅ）",
  inputSchema: z.object({
    query: z.string().describe("搜索内容"),
  }),
  execute: async ({ query }) => {
    const client = getMemoryServiceClientFromEnv();
    if (!client) return [];

    const memoryList = await client.searchMemory({
      query,
      top_k: 5,
      is_dev: process.env.NODE_ENV !== "production",
    });

    return memoryList;
  },
};

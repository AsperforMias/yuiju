import { getMemoryServiceClientFromEnv } from "@yuiju/utils";
import type { Tool } from "ai";
import { z } from "zod";

export const memorySearchTool: Tool = {
  description: "通过向量查询，搜索相关记忆",
  inputSchema: z.object({
    query: z.string().describe("搜索内容"),
    userName: z
      .string()
      .describe(
        "用户名，指定要搜索哪个主体的记忆。如果你要查询自己的记忆，请使用你的名字 ゆいじゅ",
      ),
  }),
  execute: async ({ query, userName }) => {
    const client = getMemoryServiceClientFromEnv();
    if (!client) return [];

    const memoryList = await client.searchMemory({
      user_name: userName,
      query,
      top_k: 5,
    });

    return memoryList;
  },
};

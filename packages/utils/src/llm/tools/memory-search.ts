import type { Tool } from "ai";
import { z } from "zod";
import { isDev } from "../../env";
import { getMemoryServiceClientFromEnv } from "../../memory";

export const memorySearchTool: Tool = {
  description: "搜索相关记忆",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "具体的搜索内容。如果你要搜索自己的记忆，请使用你的日文名（ゆいじゅ）。例如：ゆいじゅ喜欢草莓吗？",
      ),
  }),
  execute: async ({ query }) => {
    const client = getMemoryServiceClientFromEnv();
    if (!client) return [];

    const memoryList = await client.searchMemory({
      query,
      top_k: 5,
      is_dev: isDev(),
    });

    return memoryList;
  },
};

import type { Tool } from "ai";
import { z } from "zod";
import { searchStructuredMemory } from "../../memory";

export const memorySearchTool: Tool = {
  description: "搜索相关记忆，可按计划、事实、原始事件三种模式查询。",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "具体的搜索内容。如果你要搜索自己的记忆，请使用你的日文名（ゆいじゅ）。例如：ゆいじゅ喜欢草莓吗？",
      ),
    mode: z
      .enum(["auto", "episode", "fact", "plan"])
      .default("auto")
      .describe("查询模式：auto 自动路由，episode 查原始事件，fact 查长期事实，plan 查当前计划。"),
    timeRange: z
      .enum(["today", "recent_3d", "recent_7d", "all"])
      .default("all")
      .describe("事件检索的时间范围过滤。"),
  }),
  execute: async ({ query, mode, timeRange }) => {
    return await searchStructuredMemory({
      query,
      mode,
      timeRange,
    });
  },
};

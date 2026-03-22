import type { Tool } from "ai";
import { z } from "zod";
import { memoryQueryRouter } from "../../memory";

const sharedFields = {
  query: z
    .string()
    .describe(
      "具体的搜索内容。如果你要搜索自己的记忆，请使用你的日文名（ゆいじゅ）。例如：ゆいじゅ喜欢草莓吗？",
    ),
  counterpartyName: z
    .string()
    .optional()
    .describe("可选，对特定对象进行过滤，例如某位聊天对象或关系主体。"),
  topK: z.number().int().min(1).max(20).optional().describe("返回结果上限，默认 5。"),
};

const episodeSearchSchema = z.strictObject({
  ...sharedFields,
  memoryType: z.literal("episode").describe("查询今天的事件经过。该模式不接受跨日时间筛选参数。"),
  timeSort: z
    .enum(["asc", "desc"])
    .default("desc")
    .describe("今天内结果的时间排序方向：asc 为按时间正序，desc 为按时间倒序。"),
});

const diarySearchSchema = z.strictObject({
  ...sharedFields,
  memoryType: z.literal("diary").describe("查询昨天及更早的日记回忆。"),
  startTime: z.string().optional().describe("可选，精确开始时间，格式必须为 YYYY-MM-DD HH:mm:ss。"),
  endTime: z.string().optional().describe("可选，精确结束时间，格式必须为 YYYY-MM-DD HH:mm:ss。"),
});

const factSearchSchema = z.strictObject({
  ...sharedFields,
  memoryType: z.literal("fact").describe("查询长期事实、偏好、关系等稳定认知。"),
});

export const memorySearchTool: Tool = {
  description:
    "统一记忆查询入口。必须显式选择记忆类型：episode 用于查今天发生的事，diary 用于查昨天及更早的经历回忆，fact 用于查长期事实/偏好/关系。不同记忆类型只接受各自需要的参数。",
  inputSchema: z.discriminatedUnion("memoryType", [
    episodeSearchSchema,
    diarySearchSchema,
    factSearchSchema,
  ]),
  execute: async (input) => {
    return await memoryQueryRouter.search({
      query: input.query,
      memoryType: input.memoryType,
      startTime: "startTime" in input ? input.startTime : undefined,
      endTime: "endTime" in input ? input.endTime : undefined,
      timeSort: input.memoryType === "episode" ? input.timeSort : undefined,
      counterpartyName: input.counterpartyName,
      topK: input.topK,
    });
  },
};

import type { Tool } from "ai";
import { z } from "zod";
import { memoryQueryRouter } from "../../memory";

const sharedFields = {
  query: z
    .string()
    .optional()
    .describe(
      "仅 fact 查询有效。用于搜索长期事实、偏好、关系等语义内容；episode 和 diary 会忽略该字段。",
    ),
  topK: z.number().int().min(1).max(20).optional().describe("返回结果上限，默认 5。"),
};

/**
 * 工具 schema 的根节点必须是 object。
 *
 * 说明：
 * - 部分模型提供商不接受 discriminatedUnion 直接作为工具入参 schema；
 * - 因此这里改成单一 object + superRefine 做条件校验；
 * - 这样既能保持参数约束，又能生成稳定的 JSON Schema。
 */
const memorySearchInputSchema = z
  .strictObject({
    ...sharedFields,
    memoryType: z
      .enum(["episode", "diary", "fact"])
      .describe(
        "记忆类型：episode 查询今天的事件，diary 查询昨天及更早的日记，fact 查询长期事实。",
      ),
    timeSort: z
      .enum(["asc", "desc"])
      .optional()
      .describe(
        "仅 episode 查询有效。今天内结果的时间排序方向：asc 为按时间正序，desc 为按时间倒序。",
      ),
    startTime: z
      .string()
      .optional()
      .describe("仅 diary 查询有效。可选，开始自然日时间，格式必须为 YYYY-MM-DD HH:mm:ss。"),
    endTime: z
      .string()
      .optional()
      .describe("仅 diary 查询有效。可选，结束自然日时间，格式必须为 YYYY-MM-DD HH:mm:ss。"),
  })
  .superRefine((input, ctx) => {
    if (input.memoryType === "episode") {
      if (input.startTime || input.endTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "episode 查询不接受 startTime 或 endTime，请改用 timeSort。",
        });
      }

      return;
    }

    if (input.memoryType === "diary") {
      if (input.timeSort) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "diary 查询不接受 timeSort 参数。",
        });
      }

      return;
    }

    if (!input.query?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fact 查询必须提供 query 参数。",
      });
    }

    if (input.timeSort) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fact 查询不接受 timeSort 参数。",
      });
    }

    if (input.startTime || input.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fact 查询不接受 startTime 或 endTime 参数。",
      });
    }
  });

export const memorySearchTool: Tool = {
  description:
    "统一记忆查询入口。必须显式选择记忆类型：episode 用于查今天的事件，忽略 query；diary 用于查昨天及更早的日记，忽略 query；fact 用于查长期事实/偏好/关系，必须提供 query。不同记忆类型只接受各自需要的参数。",
  inputSchema: memorySearchInputSchema,
  execute: async (input) => {
    const result = await memoryQueryRouter.search({
      query: input.query,
      memoryType: input.memoryType,
      startTime: "startTime" in input ? input.startTime : undefined,
      endTime: "endTime" in input ? input.endTime : undefined,
      timeSort: input.memoryType === "episode" ? (input.timeSort ?? "desc") : undefined,
      topK: input.topK,
    });
    console.log(11, input, result);
    return result;
  },
};

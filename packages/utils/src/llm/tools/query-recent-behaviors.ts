import type { Tool } from "ai";
import dayjs from "dayjs";
import { z } from "zod";
import { getRecentBehaviorRecords } from "../../db";
import { getTimeWithWeekday } from "../../time";

export const queryRecentBehaviorsTool: Tool = {
  description:
    "查询ゆいじゅ今天最近的 action 记录，返回结构化文本（包含时间、行为、描述、参数）。返回内容为客观事实。",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(50).optional().describe("返回的记录数量，默认 5"),
  }),
  execute: async ({ limit }) => {
    const docs = await getRecentBehaviorRecords(limit ?? 5);

    if (!docs.length) {
      return { text: "（无）" };
    }

    const text = docs
      .map((item) => {
        const timeText = getTimeWithWeekday(dayjs(item.timestamp), "HH:mm");

        return `- [${item.behavior}] (时间 ${timeText})：${item.description}`;
      })
      .join("\n");

    return { text };
  },
};

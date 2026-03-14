import type { Tool } from "ai";
import dayjs from "dayjs";
import { z } from "zod";
import { getRecentMemoryEpisodes } from "../../db";
import { DEFAULT_MEMORY_SUBJECT_ID } from "../../memory/episode";
import { getTimeWithWeekday } from "../../time";
import { isDev } from "../../env";

export const queryRecentBehaviorsTool: Tool = {
  description:
    "查询ゆいじゅ今天最近的 action 记录，返回结构化文本（包含时间、行为、描述、参数）。返回内容为客观事实。",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(50).optional().describe("返回的记录数量，默认 5"),
  }),
  execute: async ({ limit }) => {
    const docs = await getRecentMemoryEpisodes({
      limit: limit ?? 5,
      types: ["behavior"],
      subjectId: DEFAULT_MEMORY_SUBJECT_ID,
      isDev: isDev(),
      onlyToday: true,
    });

    if (!docs.length) {
      return { text: "（无）" };
    }

    const text = docs
      .map((item) => {
        const timeText = getTimeWithWeekday(dayjs(item.happenedAt), "HH:mm");
        const actionText = String(item.payload.action ?? "未知行为");
        const reasonText = String(item.payload.reason ?? item.summaryText);

        return `- [${actionText}] (时间 ${timeText})：${reasonText}`;
      })
      .join("\n");

    return { text };
  },
};

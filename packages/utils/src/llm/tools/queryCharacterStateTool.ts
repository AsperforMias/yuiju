import { initCharacterStateData } from "../../redis";
import { getTimeWithWeekday } from "../../time";
import type { Tool } from "ai";
import dayjs from "dayjs";
import { z } from "zod";

export const queryCharacterStateTool: Tool = {
  description:
    "查询ゆいじゅ的当前状态（当前时间、正在做的事情、位置、体力、金币等）。返回内容为客观事实。",
  inputSchema: z.object({}),
  execute: async () => {
    const state = await initCharacterStateData();

    const locationText = state.location?.major
      ? `${state.location.major}${state.location.minor ? ` - ${state.location.minor}` : ""}`
      : "未知";

    const now = dayjs();

    return {
      currentTimeText: getTimeWithWeekday(now, "MM-DD HH:mm"),
      currentTimeISO: now.toISOString(),
      locationText,
      state,
    };
  },
};

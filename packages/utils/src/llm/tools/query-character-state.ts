import type { Tool } from "ai";
import dayjs from "dayjs";
import { z } from "zod";
import { initCharacterStateData } from "../../redis";
import { getTimeWithWeekday } from "../../time";

export const queryCharacterStateTool: Tool = {
  description:
    "查询ゆいじゅ的当前状态（当前时间、正在做的事情、位置、体力、饱腹、心情、金币等）。返回内容为客观事实。",
  inputSchema: z.object({}),
  execute: async () => {
    const state = await initCharacterStateData();

    const now = dayjs();

    return {
      currentTime: getTimeWithWeekday(now, "MM-DD HH:mm"),
      state,
    };
  },
};

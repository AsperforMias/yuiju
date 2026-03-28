import { tool } from "ai";
import { z } from "zod";
import {
  worldMapDsl,
  worldMapLinks,
  worldMapPlaces,
  worldMapTerminalUi,
} from "../../prompt/world-map";

/**
 * 查询星见町的世界地图。
 *
 * 返回结构化地点与连线信息，供 LLM 在需要时自行推导：
 * - 地点相对方位
 * - 两地之间的直接移动耗时与消耗
 * - 是否存在中间节点（如家 -> 公园 -> 神社）
 */
export const queryWorldMapTool = tool({
  description:
    "查询星见町的世界地图，返回结构化地点与移动连线信息，可用于判断地点关系、方位、相邻地点与移动耗时。",
  inputSchema: z.object({}),
  execute: async () => {
    return {
      places: worldMapPlaces,
      links: worldMapLinks,
      dsl: worldMapDsl,
      terminalUi: worldMapTerminalUi,
    };
  },
});

import { MajorScene } from "../types/state";

export type WorldMapPlaceId = "HOME" | "SCHOOL" | "SHOP" | "CAFE" | "PARK" | "SHRINE";

export interface WorldMapPlace {
  id: WorldMapPlaceId;
  name: string;
}

export interface WorldMapLink {
  from: WorldMapPlaceId;
  to: WorldMapPlaceId;
  timeMinutes: number;
  stamina: number;
  satiety?: number;
  dir: "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
}

/**
 * 星见町的结构化地图数据。
 *
 * 说明：
 * - 这里作为地图事实源，被 prompt 与 function tool 共同复用；
 * - 行为实现中的移动时间/消耗应尽量与这里保持一致，避免模型获取到互相矛盾的地图信息。
 */
export const worldMapPlaces: WorldMapPlace[] = [
  { id: "HOME", name: MajorScene.Home },
  { id: "SCHOOL", name: MajorScene.School },
  { id: "SHOP", name: MajorScene.Shop },
  { id: "CAFE", name: MajorScene.Cafe },
  { id: "PARK", name: MajorScene.Park },
  { id: "SHRINE", name: MajorScene.Shrine },
];

export const worldMapLinks: WorldMapLink[] = [
  { from: "HOME", to: "SCHOOL", timeMinutes: 30, stamina: -7, satiety: -4, dir: "N" },
  { from: "SCHOOL", to: "HOME", timeMinutes: 30, stamina: -7, satiety: -4, dir: "S" },

  { from: "HOME", to: "SHOP", timeMinutes: 20, stamina: -5, satiety: -3, dir: "NE" },
  { from: "SHOP", to: "HOME", timeMinutes: 20, stamina: -5, satiety: -3, dir: "SW" },

  { from: "HOME", to: "CAFE", timeMinutes: 20, stamina: -5, satiety: -3, dir: "NW" },
  { from: "CAFE", to: "HOME", timeMinutes: 20, stamina: -3, dir: "SE" },

  { from: "SCHOOL", to: "SHOP", timeMinutes: 10, stamina: -3, satiety: -2, dir: "E" },
  { from: "SHOP", to: "SCHOOL", timeMinutes: 10, stamina: -3, satiety: -2, dir: "W" },

  { from: "SCHOOL", to: "CAFE", timeMinutes: 10, stamina: -3, satiety: -2, dir: "W" },
  { from: "CAFE", to: "SCHOOL", timeMinutes: 10, stamina: -3, dir: "E" },

  { from: "HOME", to: "PARK", timeMinutes: 10, stamina: -2, satiety: -1, dir: "S" },
  { from: "PARK", to: "HOME", timeMinutes: 10, stamina: -2, satiety: -1, dir: "N" },

  { from: "PARK", to: "SHRINE", timeMinutes: 10, stamina: -2, satiety: -1, dir: "S" },
  { from: "SHRINE", to: "PARK", timeMinutes: 10, stamina: -2, satiety: -1, dir: "N" },
];

export const worldMapDsl = [
  ...worldMapPlaces.map((place) => `place ${place.id} "${place.name}"`),
  "",
  ...worldMapLinks.map((link) => {
    const details = [
      `timeMinutes=${link.timeMinutes}`,
      `stamina=${link.stamina}`,
      ...(link.satiety !== undefined ? [`satiety=${link.satiety}`] : []),
      `dir=${link.dir}`,
    ];

    return `link ${link.from} -> ${link.to} (${details.join(", ")})`;
  }),
].join("\n");

/**
 * 给人看的，不是给 LLM 看的
 */
export const worldMapTerminalUi = `
              ┌────────┐
              │  学校  │
              └───┬────┘
                  │
        ┌─────────┼─────────┐
    ┌───┴───┐     │     ┌───┴───┐
    │ 咖啡店 │     │     │  商店  │
    └───┬───┘     │     └───┬───┘
        └─────────┼─────────┘
                  │
              ┌───┴────┐
              │   家   │
              └───┬────┘
                  │
              ┌───┴────┐
              │  公园  │
              └───┬────┘
                  │
              ┌───┴────┐
              │  神社  │
              └────────┘
`.trim();

export type WorldMapPlaceId = "HOME" | "SCHOOL" | "SHOP" | "CAFE" | "PARK" | "SHRINE";

export interface WorldMapPlace {
  id: WorldMapPlaceId;
  name: string;
  description: string;
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
  { id: "HOME", name: "家", description: "悠酱独自生活的地方。" },
  { id: "SCHOOL", name: "学校", description: "悠酱上学的地方。" },
  { id: "SHOP", name: "商店", description: "可以买零食和日用品的地方。" },
  { id: "CAFE", name: "咖啡店", description: "可以点咖啡，也可以兼职打工的地方。" },
  { id: "PARK", name: "公园", description: "适合散步放松、转换心情的地方。" },
  { id: "SHRINE", name: "神社", description: "可以参拜、投币祈愿的安静场所。" },
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

import { Hono } from "hono";

export const homeRoute = new Hono();

homeRoute.get("/", (context) => {
  return context.json({
    code: 0,
    data: {
      status: {
        behavior: "发呆",
        location: "家",
        stamina: { current: 68, max: 100 },
        money: 128,
      },
      todayActions: ["起床", "上学", "吃饭", "发呆"],
      inventory: [
        { name: "苹果", count: 2 },
        { name: "面包", count: 1 },
        { name: "水", count: 1 },
      ],
      plans: {
        longTerm: "认真上学，变得更厉害",
        shortTerm: ["复习", "逛商店", "做饭"],
      },
      world: {
        time: "2026-02-07 19:32",
      },
    },
    message: "ok",
  });
});

import { initCharacterStateData, initWorldStateData } from "@yuiju/utils";
import { Hono } from "hono";

export const homeRoute = new Hono();

const STAMINA_MAX = 100;

homeRoute.get("/index", async (context) => {
  const [state, world] = await Promise.all([initCharacterStateData(), initWorldStateData()]);

  const inventory =
    state.inventory?.map((item) => ({
      name: item.name,
      count: Number.isFinite(item.quantity) ? item.quantity : 0,
    })) ?? [];

  const staminaMax = Math.max(STAMINA_MAX, state.stamina);

  return context.json({
    code: 0,
    data: {
      status: {
        behavior: state.action,
        location: state.location.major,
        stamina: { current: state.stamina, max: staminaMax },
        money: state.money,
      },
      todayActions: state.dailyActionsDoneToday,
      inventory,
      plans: {
        longTerm: state.longTermPlan,
        shortTerm: state.shortTermPlan,
      },
      world: {
        time: world.time.format("YYYY-MM-DD HH:mm"),
      },
    },
    message: "ok",
  });
});

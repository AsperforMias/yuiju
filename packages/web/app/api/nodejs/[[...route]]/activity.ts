import { getRecentBehaviorRecords, type IBehaviorRecord } from "@yuiju/utils";
import dayjs from "dayjs";
import { Hono } from "hono";
import { rejectPublicRequest } from "./public-guard";

export const activityRoute = new Hono();

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const parseLimit = (value: string | undefined) => {
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  if (parsed <= 0) return DEFAULT_LIMIT;
  if (parsed > MAX_LIMIT) return MAX_LIMIT;
  return parsed;
};

activityRoute.use("*", async (context, next) => {
  const blocked = rejectPublicRequest(context);
  if (blocked) {
    return blocked;
  }
  await next();
});

activityRoute.get("/activity", async (context) => {
  const limit = parseLimit(context.req.query("limit"));
  let docs: IBehaviorRecord[] = [];
  try {
    docs = await getRecentBehaviorRecords(limit);
  } catch (error) {
    console.error("getRecentBehaviorRecords failed:", error);
    docs = [];
  }

  const events = docs
    .slice()
    .reverse()
    .map((item) => ({
      time: dayjs(item.timestamp).format("HH:mm"),
      behavior: item.behavior,
      desc: item.description,
      trigger: item.trigger,
      duration: item.duration_minutes ?? 0,
    }));

  return context.json({
    code: 0,
    data: {
      count: events.length,
      events,
    },
    message: "ok",
  });
});

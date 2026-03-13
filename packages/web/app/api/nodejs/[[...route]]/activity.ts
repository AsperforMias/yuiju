import {
  DEFAULT_MEMORY_SUBJECT_ID,
  getRecentMemoryEpisodes,
  isDev,
  type IMemoryEpisode,
} from "@yuiju/utils";
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
  let docs: IMemoryEpisode[] = [];
  try {
    docs = await getRecentMemoryEpisodes({
      limit,
      types: ["behavior", "system"],
      subjectId: DEFAULT_MEMORY_SUBJECT_ID,
      isDev: isDev(),
      onlyToday: true,
    });
  } catch (error) {
    console.error("getRecentMemoryEpisodes failed:", error);
    docs = [];
  }

  const events = docs
    .slice()
    .reverse()
    .map((item) => ({
      time: dayjs(item.happenedAt).format("HH:mm"),
      behavior: String(item.payload.action ?? item.payload.eventName ?? item.type),
      desc: item.summaryText,
      trigger: item.type === "system" ? "system" : "agent",
      duration: Number(item.payload.durationMinutes ?? 0),
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

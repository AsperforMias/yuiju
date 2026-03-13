import dayjs from "dayjs";
import { getRecentMemoryEpisodes } from "../db";
import { isDev } from "../env";
import { initPlanStateData } from "../redis";
import { getTimeWithWeekday } from "../time";
import { DEFAULT_MEMORY_SUBJECT_ID } from "./episode";
import { getMemoryServiceClientFromEnv } from "./memory-service-client";

export type MemorySearchMode = "auto" | "episode" | "fact" | "plan";

export interface StructuredMemorySearchItem {
  kind: "episode" | "fact" | "plan";
  summary: string;
  time?: string | null;
  score?: number | null;
  source?: string | null;
  planId?: string | null;
}

function scoreEpisode(query: string, summaryText: string): number {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return 0;
  }

  let score = 0;
  for (const token of normalizedQuery.split(/\s+/)) {
    if (summaryText.includes(token)) {
      score += 1;
    }
  }

  return score;
}

async function searchEpisodes(query: string): Promise<StructuredMemorySearchItem[]> {
  const docs = await getRecentMemoryEpisodes({
    limit: 20,
    subjectId: DEFAULT_MEMORY_SUBJECT_ID,
    isDev: isDev(),
  });

  return docs
    .map((doc) => ({
      doc,
      score: scoreEpisode(query, doc.summaryText),
    }))
    .filter((item) => item.score > 0 || !query.trim())
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map(({ doc, score }) => ({
      kind: "episode" as const,
      summary: doc.summaryText,
      time: getTimeWithWeekday(dayjs(doc.happenedAt), "MM-DD HH:mm"),
      score,
      source: doc.type,
      planId:
        typeof doc.payload?.relatedPlanId === "string"
          ? doc.payload.relatedPlanId
          : typeof doc.payload?.planId === "string"
            ? doc.payload.planId
            : null,
    }));
}

async function searchFacts(query: string): Promise<StructuredMemorySearchItem[]> {
  const client = getMemoryServiceClientFromEnv();
  if (!client) {
    return [];
  }

  const facts = await client.searchMemory({
    query,
    top_k: 5,
    is_dev: isDev(),
  });

  return facts.map((item) => ({
    kind: "fact" as const,
    summary: item.memory,
    time: item.time,
    score: item.score,
    source: item.source,
    planId: null,
  }));
}

async function searchPlanState(): Promise<StructuredMemorySearchItem[]> {
  const planState = await initPlanStateData();
  const items: StructuredMemorySearchItem[] = [];

  if (planState.mainPlan) {
    items.push({
      kind: "plan",
      summary: `当前主计划：${planState.mainPlan.title}`,
      time: planState.mainPlan.updatedAt,
      source: "plan_state",
      planId: planState.mainPlan.id,
    });
  }

  for (const plan of planState.activePlans) {
    items.push({
      kind: "plan",
      summary: `当前活跃计划：${plan.title}`,
      time: plan.updatedAt,
      source: "plan_state",
      planId: plan.id,
    });
  }

  return items;
}

export async function searchStructuredMemory(input: {
  query: string;
  mode: MemorySearchMode;
}): Promise<StructuredMemorySearchItem[]> {
  if (input.mode === "episode") {
    return await searchEpisodes(input.query);
  }

  if (input.mode === "fact") {
    return await searchFacts(input.query);
  }

  if (input.mode === "plan") {
    const planItems = await searchPlanState();
    if (planItems.length > 0) {
      return planItems;
    }
    return await searchEpisodes(input.query);
  }

  const planItems = /计划|打算|目标|安排|今天要做什么|近期/.test(input.query)
    ? await searchPlanState()
    : [];
  if (planItems.length > 0) {
    return planItems;
  }

  const factItems = await searchFacts(input.query);
  if (factItems.length > 0) {
    return factItems;
  }

  return await searchEpisodes(input.query);
}

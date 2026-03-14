import dayjs from "dayjs";
import { getRecentMemoryEpisodes } from "../db";
import { isDev } from "../env";
import { initPlanStateData } from "../redis";
import { DEFAULT_MEMORY_SUBJECT_ID } from "./episode";
import { getMemoryServiceClientFromEnv, type MemorySearchItem } from "./memory-service-client";
import { rerankEpisodesWithSiliconFlow } from "./rerank";

export type MemoryQueryType = "auto" | "episode" | "fact" | "plan";
export type MemoryQueryTimeRange = "today" | "recent_3d" | "recent_7d" | "all";

export interface MemorySearchInput {
  query: string;
  memoryType?: MemoryQueryType;
  timeRange?: MemoryQueryTimeRange;
  counterpartyName?: string;
  topK?: number;
}

export interface MemorySearchResult {
  source: "episode" | "fact" | "plan";
  score: number;
  summary: string;
  happenedAt?: string;
  validFrom?: string;
  validTo?: string;
  evidenceIds: string[];
  metadata?: Record<string, unknown>;
}

interface MemoryQueryRouter {
  search(input: MemorySearchInput): Promise<MemorySearchResult[]>;
}

const DEFAULT_TOP_K = 5;
const EPISODE_SEARCH_LIMIT = 20;
const EPISODE_RERANK_THRESHOLD = 3;
const PLAN_QUERY_PATTERN = /计划|打算|目标|安排|今天要做什么|近期/;

function normalizeTopK(topK?: number): number {
  if (!Number.isFinite(topK)) {
    return DEFAULT_TOP_K;
  }

  return Math.max(1, Math.min(Number(topK), 20));
}

function normalizeInput(input: MemorySearchInput): Required<MemorySearchInput> {
  return {
    query: input.query.trim(),
    memoryType: input.memoryType ?? "auto",
    timeRange: input.timeRange ?? "all",
    counterpartyName: input.counterpartyName?.trim() ?? "",
    topK: normalizeTopK(input.topK),
  };
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

function scorePlan(query: string, title: string): number {
  const score = scoreEpisode(query, title);
  return score > 0 ? score : 1;
}

function getTimeRangeBounds(timeRange: MemoryQueryTimeRange): {
  happenedAfter?: Date;
  happenedBefore?: Date;
  onlyToday?: boolean;
} {
  if (timeRange === "today") {
    return {
      onlyToday: true,
    };
  }

  if (timeRange === "recent_3d") {
    return {
      happenedAfter: dayjs().subtract(3, "day").toDate(),
      happenedBefore: dayjs().add(1, "minute").toDate(),
    };
  }

  if (timeRange === "recent_7d") {
    return {
      happenedAfter: dayjs().subtract(7, "day").toDate(),
      happenedBefore: dayjs().add(1, "minute").toDate(),
    };
  }

  return {};
}

function getPlanIdFromPayload(payload: Record<string, unknown> | undefined): string | null {
  if (typeof payload?.relatedPlanId === "string") {
    return payload.relatedPlanId;
  }
  if (typeof payload?.planId === "string") {
    return payload.planId;
  }
  return null;
}

function normalizeEvidenceIds(item: MemorySearchItem): string[] {
  if (Array.isArray(item.evidenceIds)) {
    return item.evidenceIds.filter((value): value is string => typeof value === "string");
  }

  if (Array.isArray(item.evidence_ids)) {
    return item.evidence_ids.filter((value): value is string => typeof value === "string");
  }

  return [];
}

function normalizeFactMetadata(item: MemorySearchItem): Record<string, unknown> | undefined {
  const metadata = item.metadata ?? {};

  const rawExtras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    if (
      key === "memory" ||
      key === "time" ||
      key === "source" ||
      key === "score" ||
      key === "validFrom" ||
      key === "validTo" ||
      key === "valid_from" ||
      key === "valid_to" ||
      key === "evidenceIds" ||
      key === "evidence_ids" ||
      key === "metadata"
    ) {
      continue;
    }
    rawExtras[key] = value;
  }

  const mergedMetadata: Record<string, unknown> = {
    ...rawExtras,
    ...metadata,
  };

  if (item.source) {
    mergedMetadata.source = item.source;
  }

  return Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined;
}

function getSortableTimestamp(result: MemorySearchResult): number {
  const value = result.happenedAt ?? result.validFrom ?? result.validTo;
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function mergeAndRankResults(results: MemorySearchResult[], topK: number): MemorySearchResult[] {
  return [...results]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return getSortableTimestamp(right) - getSortableTimestamp(left);
    })
    .slice(0, topK);
}

function buildEpisodeRerankDocument(doc: {
  summaryText: string;
  type: string;
  counterpartyId?: string;
  payload?: Record<string, unknown>;
}): string {
  const action =
    typeof doc.payload?.action === "string" ? `行为: ${doc.payload.action}` : undefined;
  const planId = getPlanIdFromPayload(doc.payload);
  const counterparty = doc.counterpartyId ? `对象: ${doc.counterpartyId}` : undefined;

  return [
    doc.summaryText,
    `类型: ${doc.type}`,
    action,
    counterparty,
    planId ? `计划: ${planId}` : undefined,
  ]
    .filter((item): item is string => Boolean(item))
    .join("\n");
}

/**
 * 查询 Episode 记忆。
 *
 * 说明：
 * - 统一在 Mongo Episode 集合中按时间窗口与对象过滤；
 * - 返回结构会补充 episodeType / planId 等 metadata，供上游稳定消费。
 */
export async function searchEpisodes(input: MemorySearchInput): Promise<MemorySearchResult[]> {
  const normalized = normalizeInput(input);
  const timeRangeFilter = getTimeRangeBounds(normalized.timeRange);
  const docs = await getRecentMemoryEpisodes({
    limit: Math.max(normalized.topK, EPISODE_SEARCH_LIMIT),
    subjectId: DEFAULT_MEMORY_SUBJECT_ID,
    isDev: isDev(),
    counterpartyId: normalized.counterpartyName || undefined,
    ...timeRangeFilter,
  });

  const candidates = docs
    .map((doc, index) => {
      const score = scoreEpisode(normalized.query, doc.summaryText);
      const planId = getPlanIdFromPayload(doc.payload);

      return {
        item: {
          source: "episode" as const,
          score,
          summary: doc.summaryText,
          happenedAt: dayjs(doc.happenedAt).toISOString(),
          evidenceIds: [String(doc._id)],
          metadata: {
            episodeType: doc.type,
            planId,
            source: doc.source,
            displayTime: dayjs(doc.happenedAt).format("MM-DD HH:mm"),
          },
        },
        document: buildEpisodeRerankDocument(doc),
        result: {
          source: "episode" as const,
          score,
          summary: doc.summaryText,
          happenedAt: dayjs(doc.happenedAt).toISOString(),
          evidenceIds: [String(doc._id)],
          metadata: {
            episodeType: doc.type,
            planId,
            source: doc.source,
            displayTime: dayjs(doc.happenedAt).format("MM-DD HH:mm"),
          },
        },
      };
    })
    .filter((item) => item.result.score > 0 || !normalized.query)
    .sort((left, right) => {
      if (right.result.score !== left.result.score) {
        return right.result.score - left.result.score;
      }

      return getSortableTimestamp(right.result) - getSortableTimestamp(left.result);
    });

  if (
    normalized.query &&
    candidates.length > EPISODE_RERANK_THRESHOLD &&
    process.env.SILICONFLOW_API_KEY?.trim()
  ) {
    const reranked = await rerankEpisodesWithSiliconFlow({
      query: normalized.query,
      topK: normalized.topK,
      candidates,
    });

    if (reranked) {
      return reranked;
    }
  }

  return candidates.slice(0, normalized.topK).map((candidate) => candidate.result);
}

/**
 * 查询长期事实记忆。
 *
 * 说明：
 * - 当前调用 Python memory service；
 * - 服务端证据字段尚未完全稳定时，这里负责兼容新旧返回结构。
 */
export async function searchFacts(input: MemorySearchInput): Promise<MemorySearchResult[]> {
  const normalized = normalizeInput(input);
  const client = getMemoryServiceClientFromEnv();
  if (!client) {
    return [];
  }

  const facts = await client.searchMemory({
    query: normalized.query,
    top_k: normalized.topK,
    counterparty_name: normalized.counterpartyName || undefined,
    is_dev: isDev(),
  });

  return facts.slice(0, normalized.topK).map((item) => ({
    source: "fact" as const,
    score: item.score ?? 0,
    summary: item.memory,
    happenedAt: item.time ?? undefined,
    validFrom: item.validFrom ?? item.valid_from ?? undefined,
    validTo: item.validTo ?? item.valid_to ?? undefined,
    evidenceIds: normalizeEvidenceIds(item),
    metadata: normalizeFactMetadata(item),
  }));
}

/**
 * 查询当前计划状态。
 *
 * 说明：
 * - 计划读取直接以 Redis plan_state 为准；
 * - 返回 planId 作为 evidenceIds，便于后续与计划历史串联。
 */
export async function searchPlans(input: MemorySearchInput): Promise<MemorySearchResult[]> {
  const normalized = normalizeInput(input);
  const planState = await initPlanStateData();
  const items: MemorySearchResult[] = [];

  if (planState.mainPlan) {
    items.push({
      source: "plan",
      score: scorePlan(normalized.query, planState.mainPlan.title),
      summary: `当前主计划：${planState.mainPlan.title}`,
      happenedAt: planState.mainPlan.updatedAt,
      evidenceIds: [planState.mainPlan.id],
      metadata: {
        planId: planState.mainPlan.id,
        scope: planState.mainPlan.scope,
        status: planState.mainPlan.status,
      },
    });
  }

  for (const plan of planState.activePlans) {
    items.push({
      source: "plan",
      score: scorePlan(normalized.query, plan.title),
      summary: `当前活跃计划：${plan.title}`,
      happenedAt: plan.updatedAt,
      evidenceIds: [plan.id],
      metadata: {
        planId: plan.id,
        scope: plan.scope,
        status: plan.status,
      },
    });
  }

  return items.slice(0, normalized.topK);
}

class DefaultMemoryQueryRouter implements MemoryQueryRouter {
  async search(input: MemorySearchInput): Promise<MemorySearchResult[]> {
    const normalized = normalizeInput(input);

    if (normalized.memoryType === "episode") {
      return await searchEpisodes(normalized);
    }

    if (normalized.memoryType === "fact") {
      return await searchFacts(normalized);
    }

    if (normalized.memoryType === "plan") {
      return await searchPlans(normalized);
    }

    const results: MemorySearchResult[] = [];
    if (PLAN_QUERY_PATTERN.test(normalized.query)) {
      results.push(...(await searchPlans(normalized)));
    }
    results.push(...(await searchFacts(normalized)));
    results.push(...(await searchEpisodes(normalized)));

    return mergeAndRankResults(results, normalized.topK);
  }
}

export const memoryQueryRouter: MemoryQueryRouter = new DefaultMemoryQueryRouter();

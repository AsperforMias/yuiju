import { deepseek } from "@ai-sdk/deepseek";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { MemoryEpisode } from "./episode";

/**
 * 当前支持进入 Graphiti 的事实类型。
 */
export type FactCandidateType = "preference" | "relation" | "plan";

/**
 * 进入 Graphiti 前的业务候选事实。
 *
 * 说明：
 * - id 是“本次候选事实”的唯一标识，用于 TS 与 Python 之间回传、回写 extractedFactIds；
 * - dedupeKey 是“语义去重键”，用于在补偿重跑、批量回灌或多条 episode 指向同一事实时识别重复事实；
 * - evidenceEpisodeId 让图事实始终可追溯到真相层事件。
 */
export interface FactCandidate {
  id: string;
  dedupeKey: string;
  type: FactCandidateType;
  subject: string;
  predicate: string;
  object: string;
  summary: string;
  confidence: number;
  evidenceEpisodeId: string;
  validAt: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryExtractor {
  extract(episode: MemoryEpisode): Promise<FactCandidate[]>;
}

/**
 * 生成候选事实 ID。
 *
 * 说明：
 * - id 只负责标识“这一条候选事实记录”，不承担语义去重职责；
 * - 语义去重由 dedupeKey 负责，因此这里直接使用随机 UUID 即可。
 */
function createFactId(): string {
  return `fact_${crypto.randomUUID()}`;
}

/**
 * 生成语义去重键。
 *
 * 说明：
 * - dedupeKey 需要在相同语义事实上保持稳定，因此使用能表达事实语义的核心字段拼接；
 * - 当前先采用可读、可调试的稳定字符串，不额外引入 hash，以便后续排查重复写入。
 */
function createFactDedupeKey(parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("|");
}

const extractedFactSchema = z.object({
  facts: z.array(
    z.object({
      type: z.enum(["preference", "relation", "plan"]),
      subject: z.string().min(1),
      predicate: z.string().min(1),
      object: z.string().min(1),
      summary: z.string().min(1),
      confidence: z.number().min(0).max(1),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
});

function buildExtractorPrompt(episode: MemoryEpisode): string {
  return [
    "你是记忆系统的事实提炼器，需要从 episode 中提炼值得写入长期记忆图谱的候选事实。",
    "只允许输出以下三类事实：preference、relation、plan。",
    "不要输出原始事件复述，不要输出不确定、无长期价值、纯一次性的细节。",
    "如果没有合适事实，返回空数组。",
    "提炼规则：",
    "- preference：稳定偏好、喜恶、长期倾向。",
    "- relation：与某人的关系态度、互动倾向。",
    "- plan：当前主计划、活跃计划、计划推进倾向。",
    "输出要求：subject/predicate/object 必须简洁稳定，summary 使用中文，confidence 取 0-1。",
    `episode_type=${episode.type}`,
    `subject_id=${episode.subjectId}`,
    `counterparty_id=${episode.counterpartyId ?? ""}`,
    `happened_at=${episode.happenedAt.toISOString()}`,
    `summary_text=${episode.summaryText}`,
    `payload=${JSON.stringify(episode.payload, null, 2)}`,
  ].join("\n");
}

function normalizeExtractedFacts(
  episode: MemoryEpisode,
  output: z.infer<typeof extractedFactSchema>,
): FactCandidate[] {
  const episodeId = episode.id;
  if (!episodeId) {
    return [];
  }

  return output.facts.map((fact) => ({
    id: createFactId(),
    dedupeKey: createFactDedupeKey([fact.type, fact.subject, fact.predicate, fact.object]),
    type: fact.type,
    subject: fact.subject,
    predicate: fact.predicate,
    object: fact.object,
    summary: fact.summary,
    confidence: fact.confidence,
    evidenceEpisodeId: episodeId,
    validAt: episode.happenedAt.toISOString(),
    metadata: fact.metadata,
  }));
}

/**
 * 基于 LLM 的同步 extractor。
 *
 * 说明：
 * - 使用结构化 schema 约束模型输出，避免自由文本污染图谱；
 * - 候选事实仍由业务侧定义类型边界，Graphiti 只接收提炼后的结果。
 */
export const llmMemoryExtractor: MemoryExtractor = {
  async extract(episode) {
    if (!episode.id) {
      return [];
    }

    const { output } = await generateText({
      model: deepseek("deepseek-chat"),
      output: Output.object({
        schema: extractedFactSchema,
      }),
      prompt: buildExtractorPrompt(episode),
    });

    return normalizeExtractedFacts(episode, output);
  },
};

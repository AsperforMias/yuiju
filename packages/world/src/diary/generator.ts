import { deepseek } from "@ai-sdk/deepseek";
import { buildDiarySystemPrompt } from "@yuiju/source";
import {
  DEFAULT_DIARY_SUBJECT,
  DEFAULT_MEMORY_SUBJECT_ID,
  getRecentMemoryEpisodes,
  type IMemoryEpisode,
  upsertMemoryDiary,
} from "@yuiju/utils";
import { generateText, Output } from "ai";
import dayjs from "dayjs";
import { z } from "zod";
import { logger } from "@/utils/logger";

const MAX_EPISODES_PER_DAY = 500;
const RAW_CONVERSATION_CHAR_BUDGET = 6000;
const SINGLE_CONVERSATION_CHAR_LIMIT = 2200;
const CONVERSATION_CHUNK_CHAR_LIMIT = 1400;
const CONVERSATION_CHUNK_MESSAGE_LIMIT = 10;

const conversationSummarySchema = z.object({
  topicSummary: z.string().min(1),
  emotionSummary: z.string().min(1),
  preferenceSignals: z.array(z.string()).max(4),
  relationSignals: z.array(z.string()).max(4),
  representativeQuotes: z.array(z.string()).max(3),
});

type ConversationSummary = z.infer<typeof conversationSummarySchema>;

interface ConversationMessage {
  speaker_name: string;
  content: string;
  timestamp: string;
}

interface ConversationPayload {
  counterpartyName?: string;
  subjectName?: string;
  windowStart?: string;
  windowEnd?: string;
  messageCount?: number;
  messages?: ConversationMessage[];
}

interface DiaryMaterialItem {
  type: string;
  happenedAt: string;
  content: string;
}

export interface GenerateDiaryForDateInput {
  diaryDate: Date;
  subject?: string;
  isDev: boolean;
}

export interface DiaryGeneratorDependencies {
  loadEpisodes?: (input: {
    diaryDate: Date;
    subjectId: string;
    isDev: boolean;
  }) => Promise<IMemoryEpisode[]>;
  saveDiary?: typeof upsertMemoryDiary;
  summarizeConversationChunk?: (input: {
    counterpartyName: string;
    chunkLabel: string;
    messages: ConversationMessage[];
  }) => Promise<ConversationSummary>;
  mergeConversationSummaries?: (input: {
    counterpartyName: string;
    chunkSummaries: ConversationSummary[];
  }) => Promise<ConversationSummary>;
  writeDiaryText?: (input: {
    subject: string;
    diaryDate: Date;
    materials: DiaryMaterialItem[];
  }) => Promise<string>;
}

function getConversationPayload(episode: IMemoryEpisode): ConversationPayload {
  return (episode.payload ?? {}) as ConversationPayload;
}

function getConversationMessages(episode: IMemoryEpisode): ConversationMessage[] {
  const payload = getConversationPayload(episode);
  return Array.isArray(payload.messages) ? payload.messages : [];
}

function estimateConversationChars(episode: IMemoryEpisode): number {
  return getConversationMessages(episode).reduce((total, message) => {
    return total + message.speaker_name.length + message.content.length + message.timestamp.length;
  }, 0);
}

function chunkConversationMessages(messages: ConversationMessage[]): ConversationMessage[][] {
  const chunks: ConversationMessage[][] = [];
  let currentChunk: ConversationMessage[] = [];
  let currentChars = 0;

  for (const message of messages) {
    const messageChars =
      message.speaker_name.length + message.content.length + message.timestamp.length;
    const shouldFlush =
      currentChunk.length >= CONVERSATION_CHUNK_MESSAGE_LIMIT ||
      currentChars + messageChars > CONVERSATION_CHUNK_CHAR_LIMIT;

    if (shouldFlush && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChars = 0;
    }

    currentChunk.push(message);
    currentChars += messageChars;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function renderConversationSummary(counterpartyName: string, summary: ConversationSummary): string {
  const segments = [
    `对话对象：${counterpartyName}`,
    `核心话题：${summary.topicSummary}`,
    `情绪变化：${summary.emotionSummary}`,
    summary.preferenceSignals.length > 0
      ? `偏好/信号：${summary.preferenceSignals.join("；")}`
      : undefined,
    summary.relationSignals.length > 0
      ? `关系/互动：${summary.relationSignals.join("；")}`
      : undefined,
    summary.representativeQuotes.length > 0
      ? `代表性原话：${summary.representativeQuotes.join(" | ")}`
      : undefined,
  ];

  return segments.filter((item): item is string => Boolean(item)).join("\n");
}

function buildRawConversationMaterial(episode: IMemoryEpisode): DiaryMaterialItem {
  const payload = getConversationPayload(episode);
  const messages = getConversationMessages(episode)
    .map((message) => `${message.timestamp} ${message.speaker_name}：${message.content}`)
    .join("\n");

  return {
    type: "conversation",
    happenedAt: dayjs(episode.happenedAt).toISOString(),
    content: [
      `对话对象：${payload.counterpartyName ?? episode.counterpartyId ?? "未知对象"}`,
      `窗口摘要：${episode.summaryText}`,
      messages ? `消息记录：\n${messages}` : undefined,
    ]
      .filter((item): item is string => Boolean(item))
      .join("\n"),
  };
}

function buildEpisodeMaterial(episode: IMemoryEpisode): DiaryMaterialItem {
  return {
    type: episode.type,
    happenedAt: dayjs(episode.happenedAt).toISOString(),
    content: episode.summaryText,
  };
}

async function defaultSummarizeConversationChunk(input: {
  counterpartyName: string;
  chunkLabel: string;
  messages: ConversationMessage[];
}): Promise<ConversationSummary> {
  const { output } = await generateText({
    model: deepseek("deepseek-chat"),
    output: Output.object({
      schema: conversationSummarySchema,
    }),
    prompt: [
      "你是日记生成前的聊天压缩器，需要把一段聊天窗口素材压缩成稳定摘要。",
      "目标不是生成文艺文风，而是保留后续写日记真正需要的信息。",
      "请重点保留：对话对象、核心话题、情绪变化、明确表达的偏好/关系信号、少量有代表性的原话。",
      "不要编造没有发生的内容，不要输出与材料无关的推断。",
      `对话对象：${input.counterpartyName}`,
      `分段标识：${input.chunkLabel}`,
      `聊天记录：\n${input.messages
        .map((message) => `${message.timestamp} ${message.speaker_name}：${message.content}`)
        .join("\n")}`,
    ].join("\n"),
  });

  return output;
}

async function defaultMergeConversationSummaries(input: {
  counterpartyName: string;
  chunkSummaries: ConversationSummary[];
}): Promise<ConversationSummary> {
  if (input.chunkSummaries.length === 1) {
    return input.chunkSummaries[0];
  }

  const { output } = await generateText({
    model: deepseek("deepseek-chat"),
    output: Output.object({
      schema: conversationSummarySchema,
    }),
    prompt: [
      "你需要把多段聊天摘要合并成一条适合写日记的对话摘要。",
      "保留最重要的话题、情绪变化、偏好/关系信号与少量代表性原话，不要重复，不要编造。",
      `对话对象：${input.counterpartyName}`,
      `待合并摘要：\n${input.chunkSummaries
        .map((summary, index) => {
          return [
            `## 摘要 ${index + 1}`,
            `核心话题：${summary.topicSummary}`,
            `情绪变化：${summary.emotionSummary}`,
            `偏好/信号：${summary.preferenceSignals.join("；") || "无"}`,
            `关系/互动：${summary.relationSignals.join("；") || "无"}`,
            `代表性原话：${summary.representativeQuotes.join(" | ") || "无"}`,
          ].join("\n");
        })
        .join("\n\n")}`,
    ].join("\n"),
  });

  return output;
}

async function defaultWriteDiaryText(input: {
  subject: string;
  diaryDate: Date;
  materials: DiaryMaterialItem[];
}): Promise<string> {
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    system: buildDiarySystemPrompt({
      subject: input.subject,
      diaryDate: input.diaryDate,
    }),
    prompt: [
      "以下是今天真实发生过的素材，请严格基于这些内容写日记。",
      JSON.stringify(
        input.materials.map((item) => ({
          type: item.type,
          happenedAt: item.happenedAt,
          content: item.content,
        })),
        null,
        2,
      ),
    ].join("\n"),
  });

  return result.text.trim();
}

async function loadEpisodesForDiary(input: {
  diaryDate: Date;
  subjectId: string;
  isDev: boolean;
}): Promise<IMemoryEpisode[]> {
  return await getRecentMemoryEpisodes({
    limit: MAX_EPISODES_PER_DAY,
    subjectId: input.subjectId,
    isDev: input.isDev,
    onlyDate: input.diaryDate,
    sortDirection: "asc",
  });
}

async function buildConversationMaterial(
  episode: IMemoryEpisode,
  dependencies: DiaryGeneratorDependencies,
) {
  const payload = getConversationPayload(episode);
  const counterpartyName = payload.counterpartyName ?? episode.counterpartyId ?? "未知对象";
  const summarizeConversationChunk =
    dependencies.summarizeConversationChunk ?? defaultSummarizeConversationChunk;
  const mergeConversationSummaries =
    dependencies.mergeConversationSummaries ?? defaultMergeConversationSummaries;
  const messages = getConversationMessages(episode);
  const chunks = chunkConversationMessages(messages);
  const chunkSummaries: ConversationSummary[] = [];

  for (const [index, chunk] of chunks.entries()) {
    chunkSummaries.push(
      await summarizeConversationChunk({
        counterpartyName,
        chunkLabel: `第 ${index + 1} 段，共 ${chunks.length} 段`,
        messages: chunk,
      }),
    );
  }

  const mergedSummary = await mergeConversationSummaries({
    counterpartyName,
    chunkSummaries,
  });

  return {
    type: "conversation_summary",
    happenedAt: dayjs(episode.happenedAt).toISOString(),
    content: renderConversationSummary(counterpartyName, mergedSummary),
  } satisfies DiaryMaterialItem;
}

/**
 * 将同一天的 Episode 转换成适合写日记的素材列表。
 *
 * 说明：
 * - world 侧事件直接保留原始摘要；
 * - message 侧若总量超限，则改走“两段总结”压缩，避免长聊天把日记 prompt 撑爆。
 */
export async function buildDiaryMaterials(
  episodes: IMemoryEpisode[],
  dependencies: DiaryGeneratorDependencies = {},
): Promise<DiaryMaterialItem[]> {
  const nonConversationMaterials = episodes
    .filter((episode) => episode.type !== "conversation")
    .map(buildEpisodeMaterial);

  const conversationEpisodes = episodes.filter((episode) => episode.type === "conversation");
  const totalConversationChars = conversationEpisodes.reduce((total, episode) => {
    return total + estimateConversationChars(episode);
  }, 0);

  const conversationMaterials: DiaryMaterialItem[] = [];
  const shouldSummarizeConversations = totalConversationChars > RAW_CONVERSATION_CHAR_BUDGET;

  for (const episode of conversationEpisodes) {
    if (
      !shouldSummarizeConversations &&
      estimateConversationChars(episode) <= SINGLE_CONVERSATION_CHAR_LIMIT
    ) {
      conversationMaterials.push(buildRawConversationMaterial(episode));
      continue;
    }

    conversationMaterials.push(await buildConversationMaterial(episode, dependencies));
  }

  return [...nonConversationMaterials, ...conversationMaterials].sort((left, right) => {
    return dayjs(left.happenedAt).valueOf() - dayjs(right.happenedAt).valueOf();
  });
}

/**
 * 为指定自然日生成或覆盖一篇 Diary。
 */
export async function generateDiaryForDate(
  input: GenerateDiaryForDateInput,
  dependencies: DiaryGeneratorDependencies = {},
): Promise<boolean> {
  const subject = input.subject ?? DEFAULT_DIARY_SUBJECT;
  const loadEpisodes = dependencies.loadEpisodes ?? loadEpisodesForDiary;
  const saveDiary = dependencies.saveDiary ?? upsertMemoryDiary;
  const writeDiaryText = dependencies.writeDiaryText ?? defaultWriteDiaryText;

  const episodes = await loadEpisodes({
    diaryDate: input.diaryDate,
    subjectId: DEFAULT_MEMORY_SUBJECT_ID,
    isDev: input.isDev,
  });

  if (episodes.length === 0) {
    logger.debug("[generateDiaryForDate] no episodes found", {
      subject,
      diaryDate: dayjs(input.diaryDate).format("YYYY-MM-DD"),
    });
    return false;
  }

  const materials = await buildDiaryMaterials(episodes, dependencies);
  if (materials.length === 0) {
    logger.debug("[generateDiaryForDate] no diary materials built", {
      subject,
      diaryDate: dayjs(input.diaryDate).format("YYYY-MM-DD"),
    });
    return false;
  }

  const diaryText = await writeDiaryText({
    subject,
    diaryDate: input.diaryDate,
    materials,
  });

  if (!diaryText.trim()) {
    logger.warn("[generateDiaryForDate] generated empty diary text", {
      subject,
      diaryDate: dayjs(input.diaryDate).format("YYYY-MM-DD"),
    });
    return false;
  }

  await saveDiary({
    subject,
    diaryDate: input.diaryDate,
    text: diaryText,
    isDev: input.isDev,
  });

  logger.info("[generateDiaryForDate] diary generated", {
    subject,
    diaryDate: dayjs(input.diaryDate).format("YYYY-MM-DD"),
  });

  return true;
}

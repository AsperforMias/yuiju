import {
  getPendingMemoryEpisodes,
  type IMemoryEpisode,
  saveMemoryEpisode,
  updateMemoryEpisodeExtraction,
} from "../db";
import type { MemoryEpisode, MemoryEpisodeWriteInput } from "./episode";
import { llmMemoryAdmissionClassifier, type MemoryAdmissionClassifier } from "./memory-classifier";
import { getMemoryServiceClientFromEnv, type MemoryServiceClient } from "./memory-service-client";

export interface EpisodeProcessorDependencies {
  classifier?: MemoryAdmissionClassifier;
  memoryClient?: MemoryServiceClient | null;
}

export interface ProcessPendingEpisodesOptions extends EpisodeProcessorDependencies {
  limit?: number;
  statuses?: IMemoryEpisode["extractionStatus"][];
  isDev?: boolean;
}

function toDomainEpisode(episode: IMemoryEpisode): MemoryEpisode {
  return {
    id: episode.id,
    source: episode.source,
    type: episode.type,
    subject: episode.subject,
    counterparty: episode.counterparty,
    happenedAt: episode.happenedAt,
    summaryText: episode.summaryText,
    payload: episode.payload,
    extractionStatus: episode.extractionStatus,
    extractedFactIds: episode.extractedFactIds,
    isDev: episode.isDev,
  };
}

/**
 * 处理单条待抽取 Episode。
 *
 * 说明：
 * - processor 与主链路分离，便于后续做定时扫描、失败重试、历史回灌；
 * - 当前阶段 TS 侧只做“是否送入长期图谱”的保守判断，实体/关系抽取交给 Python + Graphiti；
 * - 如果没有记忆服务，也会把状态回写完成，保证本地状态机可闭环。
 */
export async function processMemoryEpisode(
  episode: IMemoryEpisode,
  dependencies: EpisodeProcessorDependencies = {},
): Promise<void> {
  const classifier = dependencies.classifier ?? llmMemoryAdmissionClassifier;
  const memoryClient = dependencies.memoryClient ?? getMemoryServiceClientFromEnv();
  const episodeId = episode.id;

  if (!episodeId) {
    return;
  }

  try {
    await updateMemoryEpisodeExtraction(episodeId, {
      extractionStatus: "processing",
    });

    const decision = await classifier.classify({
      ...toDomainEpisode(episode),
      extractionStatus: "processing",
    });

    if (!decision.shouldWrite) {
      await updateMemoryEpisodeExtraction(episodeId, {
        extractionStatus: "skipped",
        extractedFactIds: [],
      });
      return;
    }

    const writtenIds = memoryClient
      ? await memoryClient.writeEpisode({
          is_dev: episode.isDev,
          episode: toDomainEpisode(episode),
        })
      : [];

    await updateMemoryEpisodeExtraction(episodeId, {
      extractionStatus: "done",
      extractedFactIds: writtenIds,
    });
  } catch (error) {
    console.error("[processMemoryEpisode] failed to classify/write episode", error);
    await updateMemoryEpisodeExtraction(episodeId, {
      extractionStatus: "failed",
    });
  }
}

/**
 * 扫描并处理待抽取 Episode。
 */
export async function processPendingMemoryEpisodes(
  options: ProcessPendingEpisodesOptions = {},
): Promise<number> {
  const episodes = await getPendingMemoryEpisodes({
    limit: options.limit,
    statuses: options.statuses,
    isDev: options.isDev,
  });

  for (const episode of episodes) {
    await processMemoryEpisode(episode, options);
  }

  return episodes.length;
}

/**
 * 统一 Episode 发射入口。
 *
 * 当前阶段说明：
 * - 主链路只负责先写 Mongo 作为事件真相源；
 * - 异步抽取由独立 processor 负责，可由 tick/chat 后置触发，也可由扫描器补偿。
 */
export async function emitMemoryEpisode(episode: MemoryEpisodeWriteInput): Promise<string | null> {
  const savedEpisode = await saveMemoryEpisode({
    ...episode,
    extractionStatus: episode.extractionStatus ?? "pending",
  });

  return savedEpisode.id ?? null;
}

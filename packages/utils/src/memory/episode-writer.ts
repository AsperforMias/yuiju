import type { MemoryEpisodeWriteInput } from "./episode";
import { saveMemoryEpisode, updateMemoryEpisodeExtraction } from "../db";
import { getMemoryServiceClientFromEnv } from "./memory-service-client";
import { ruleBasedMemoryExtractor } from "./fact";

/**
 * 统一 Episode 发射入口。
 *
 * 当前阶段说明：
 * - 先写 Mongo 作为事件真相源；
 * - 再同步执行 extractor，将高价值事实写入 Graphiti；
 * - Graphiti 失败不会阻塞主链路，但会回写 extractionStatus 便于后续补偿。
 */
export async function emitMemoryEpisode(episode: MemoryEpisodeWriteInput): Promise<void> {
  const savedEpisode = await saveMemoryEpisode(episode);
  const episodeId = savedEpisode.id;
  const memoryClient = getMemoryServiceClientFromEnv();

  if (!episodeId) {
    return;
  }

  try {
    await updateMemoryEpisodeExtraction(episodeId, {
      extractionStatus: "processing",
    });

    const extractedFacts = ruleBasedMemoryExtractor.extract({
      ...episode,
      id: episodeId,
    });

    if (extractedFacts.length === 0) {
      await updateMemoryEpisodeExtraction(episodeId, {
        extractionStatus: "skipped",
        extractedFactIds: [],
      });
      return;
    }

    const factIds = memoryClient
      ? await memoryClient.writeFacts({
          is_dev: episode.isDev,
          facts: extractedFacts,
        })
      : extractedFacts.map((fact) => fact.id);

    await updateMemoryEpisodeExtraction(episodeId, {
      extractionStatus: "done",
      extractedFactIds: factIds,
    });
  } catch (error) {
    console.error("[emitMemoryEpisode] failed to extract/write facts", error);
    await updateMemoryEpisodeExtraction(episodeId, {
      extractionStatus: "failed",
    });
  }
}

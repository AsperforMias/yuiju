import { beforeEach, describe, expect, it, vi } from "vitest";
import { processMemoryEpisode, processPendingMemoryEpisodes } from "./episode-writer";

const { mockGetPendingMemoryEpisodes, mockUpdateMemoryEpisodeExtraction } = vi.hoisted(() => ({
  mockGetPendingMemoryEpisodes: vi.fn(),
  mockUpdateMemoryEpisodeExtraction: vi.fn(),
}));

vi.mock("../db", () => ({
  getPendingMemoryEpisodes: mockGetPendingMemoryEpisodes,
  saveMemoryEpisode: vi.fn(),
  updateMemoryEpisodeExtraction: mockUpdateMemoryEpisodeExtraction,
}));

describe("episode writer processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("处理成功时会推进到 done 并回写 fact ids", async () => {
    const episode = {
      id: "episode_1",
      source: "world_tick",
      type: "behavior",
      subjectId: "ゆいじゅ",
      happenedAt: new Date("2026-03-14T10:00:00.000Z"),
      summaryText: "悠酱在学校学习",
      importance: 0.6,
      payload: { action: "study" },
      extractionStatus: "pending" as const,
      isDev: true,
    };

    await processMemoryEpisode(episode as never, {
      extractor: {
        extract: vi.fn(async () => [
          {
            id: "fact_1",
            dedupeKey: "plan|ゆいじゅ|current_main_plan|准备考试",
            type: "plan" as const,
            subject: "ゆいじゅ",
            predicate: "current_main_plan",
            object: "准备考试",
            summary: "悠酱当前主计划是准备考试",
            confidence: 0.9,
            evidenceEpisodeId: "episode_1",
            validAt: "2026-03-14T10:00:00.000Z",
          },
        ]),
      },
      memoryClient: {
        writeFacts: vi.fn(async () => ["fact_1"]),
        searchMemory: vi.fn(),
      } as never,
    });

    expect(mockUpdateMemoryEpisodeExtraction).toHaveBeenNthCalledWith(1, "episode_1", {
      extractionStatus: "processing",
    });
    expect(mockUpdateMemoryEpisodeExtraction).toHaveBeenNthCalledWith(2, "episode_1", {
      extractionStatus: "done",
      extractedFactIds: ["fact_1"],
    });
  });

  it("没有抽取结果时会标记 skipped", async () => {
    const episode = {
      id: "episode_2",
      source: "chat",
      type: "conversation",
      subjectId: "ゆいじゅ",
      happenedAt: new Date("2026-03-14T12:00:00.000Z"),
      summaryText: "一次普通聊天",
      importance: 0.3,
      payload: { messages: [] },
      extractionStatus: "pending" as const,
      isDev: true,
    };

    await processMemoryEpisode(episode as never, {
      extractor: {
        extract: vi.fn(async () => []),
      },
      memoryClient: null,
    });

    expect(mockUpdateMemoryEpisodeExtraction).toHaveBeenNthCalledWith(2, "episode_2", {
      extractionStatus: "skipped",
      extractedFactIds: [],
    });
  });

  it("批量扫描时会逐条处理 pending / failed episode", async () => {
    mockGetPendingMemoryEpisodes.mockResolvedValue([
      {
        id: "episode_3",
        source: "system",
        type: "system",
        subjectId: "ゆいじゅ",
        happenedAt: new Date("2026-03-14T12:30:00.000Z"),
        summaryText: "金币增加",
        importance: 0.2,
        payload: {},
        extractionStatus: "pending",
        isDev: true,
      },
      {
        id: "episode_4",
        source: "system",
        type: "system",
        subjectId: "ゆいじゅ",
        happenedAt: new Date("2026-03-14T12:40:00.000Z"),
        summaryText: "金币减少",
        importance: 0.2,
        payload: {},
        extractionStatus: "failed",
        isDev: true,
      },
    ]);

    const processed = await processPendingMemoryEpisodes({
      extractor: {
        extract: vi.fn(async () => []),
      },
      memoryClient: null,
      isDev: true,
      limit: 5,
    });

    expect(processed).toBe(2);
    expect(mockGetPendingMemoryEpisodes).toHaveBeenCalledWith({
      limit: 5,
      statuses: undefined,
      isDev: true,
    });
    expect(mockUpdateMemoryEpisodeExtraction).toHaveBeenCalledTimes(4);
  });
});

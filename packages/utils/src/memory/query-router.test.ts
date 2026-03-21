import dayjs from "dayjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getRecentMemoryEpisodesMock = vi.fn();
const getMemoryDiariesMock = vi.fn();
const getMemoryServiceClientFromEnvMock = vi.fn();

vi.mock("../db", () => ({
  getRecentMemoryEpisodes: getRecentMemoryEpisodesMock,
  getMemoryDiaries: getMemoryDiariesMock,
}));

vi.mock("../env", () => ({
  isDev: () => false,
}));

vi.mock("./memory-service-client", () => ({
  getMemoryServiceClientFromEnv: getMemoryServiceClientFromEnvMock,
}));

vi.mock("./rerank", () => ({
  rerankEpisodesWithSiliconFlow: vi.fn(),
}));

function createEpisodeDoc(input: { id: string; summaryText: string; happenedAt: string }) {
  return {
    _id: input.id,
    summaryText: input.summaryText,
    happenedAt: new Date(input.happenedAt),
    payload: {},
    type: "conversation",
    source: "chat",
  };
}

function createDiaryDoc(input: { id: string; text: string; diaryDate: string }) {
  return {
    _id: input.id,
    subject: "ゆいじゅ",
    text: input.text,
    diaryDate: new Date(input.diaryDate),
  };
}

describe("query-router", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-18T09:00:00+08:00"));
    getRecentMemoryEpisodesMock.mockReset();
    getMemoryDiariesMock.mockReset();
    getMemoryServiceClientFromEnvMock.mockReset();
    getMemoryServiceClientFromEnvMock.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("精确时间优先于快捷时间，并将时间正序传递到底层查询", async () => {
    getRecentMemoryEpisodesMock.mockResolvedValueOnce([]);

    const { searchEpisodes } = await import("./query-router");
    await searchEpisodes({
      query: "散步",
      memoryType: "episode",
      timeRange: "today",
      startTime: "2026-03-18 08:00:00",
      endTime: "2026-03-18 21:30:00",
      timeSort: "asc",
    });

    expect(getRecentMemoryEpisodesMock).toHaveBeenCalledTimes(1);
    const options = getRecentMemoryEpisodesMock.mock.calls[0][0];

    expect(options.sortDirection).toBe("asc");
    expect(options.onlyDate).toBeUndefined();
    expect(dayjs(options.happenedAfter).format("YYYY-MM-DD HH:mm:ss")).toBe("2026-03-18 08:00:00");
    expect(dayjs(options.happenedBefore).format("YYYY-MM-DD HH:mm:ss")).toBe("2026-03-18 21:30:00");
  });

  it("非法精确时间会被忽略，并回退到 today 过滤", async () => {
    getRecentMemoryEpisodesMock.mockResolvedValueOnce([]);

    const { searchEpisodes } = await import("./query-router");
    await searchEpisodes({
      query: "散步",
      memoryType: "episode",
      timeRange: "today",
      startTime: "not-a-time",
      timeSort: "desc",
    });

    expect(getRecentMemoryEpisodesMock).toHaveBeenCalledTimes(1);
    const options = getRecentMemoryEpisodesMock.mock.calls[0][0];

    expect(options.happenedAfter).toBeUndefined();
    expect(options.happenedBefore).toBeUndefined();
    expect(dayjs(options.onlyDate).format("YYYY-MM-DD")).toBe("2026-03-18");
  });

  it("episode 查询昨天内容时会直接返回空结果", async () => {
    const { searchEpisodes } = await import("./query-router");
    const results = await searchEpisodes({
      query: "散步",
      memoryType: "episode",
      timeRange: "yesterday",
    });

    expect(results).toEqual([]);
    expect(getRecentMemoryEpisodesMock).not.toHaveBeenCalled();
  });

  it("同分数 Episode 会按 timeSort 升序排序", async () => {
    getRecentMemoryEpisodesMock.mockResolvedValueOnce([
      createEpisodeDoc({
        id: "later",
        summaryText: "和小久一起散步",
        happenedAt: "2026-03-16T18:00:00+08:00",
      }),
      createEpisodeDoc({
        id: "earlier",
        summaryText: "和小久一起散步",
        happenedAt: "2026-03-15T09:00:00+08:00",
      }),
    ]);

    const { searchEpisodes } = await import("./query-router");
    const results = await searchEpisodes({
      query: "散步",
      memoryType: "episode",
      timeSort: "asc",
    });

    expect(results.map((item) => item.evidenceIds[0])).toEqual(["earlier", "later"]);
  });

  it("同分数 Episode 会按 timeSort 倒序排序", async () => {
    getRecentMemoryEpisodesMock.mockResolvedValueOnce([
      createEpisodeDoc({
        id: "earlier",
        summaryText: "和小久一起散步",
        happenedAt: "2026-03-15T09:00:00+08:00",
      }),
      createEpisodeDoc({
        id: "later",
        summaryText: "和小久一起散步",
        happenedAt: "2026-03-16T18:00:00+08:00",
      }),
    ]);

    const { searchEpisodes } = await import("./query-router");
    const results = await searchEpisodes({
      query: "散步",
      memoryType: "episode",
      timeSort: "desc",
    });

    expect(results.map((item) => item.evidenceIds[0])).toEqual(["later", "earlier"]);
  });

  it("diary 查询今天内容时会直接返回空结果", async () => {
    const { searchDiaries } = await import("./query-router");
    const results = await searchDiaries({
      query: "今天",
      memoryType: "diary",
      timeRange: "today",
    });

    expect(results).toEqual([]);
    expect(getMemoryDiariesMock).not.toHaveBeenCalled();
  });

  it("diary 查询昨天内容时会命中昨日条目", async () => {
    getMemoryDiariesMock.mockResolvedValueOnce([
      createDiaryDoc({
        id: "diary_1",
        text: "今天和小久聊了一会儿，心里有点开心。",
        diaryDate: "2026-03-17T00:00:00+08:00",
      }),
    ]);

    const { searchDiaries } = await import("./query-router");
    const results = await searchDiaries({
      query: "小久",
      memoryType: "diary",
      timeRange: "yesterday",
    });

    expect(getMemoryDiariesMock).toHaveBeenCalledTimes(1);
    const options = getMemoryDiariesMock.mock.calls[0][0];
    expect(dayjs(options.onlyDate).format("YYYY-MM-DD")).toBe("2026-03-17");
    expect(results).toEqual([
      expect.objectContaining({
        source: "diary",
        evidenceIds: ["diary_1"],
      }),
    ]);
  });
});

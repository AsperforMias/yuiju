import { describe, expect, it, vi } from "vitest";

const getRecentMemoryEpisodesMock = vi.fn();
const initPlanStateDataMock = vi.fn();
const getMemoryServiceClientFromEnvMock = vi.fn();
const isDevMock = vi.fn(() => true);

vi.mock("../db", () => ({
  getRecentMemoryEpisodes: getRecentMemoryEpisodesMock,
}));

vi.mock("../redis", () => ({
  initPlanStateData: initPlanStateDataMock,
}));

vi.mock("../env", () => ({
  isDev: isDevMock,
}));

vi.mock("./memory-service-client", () => ({
  getMemoryServiceClientFromEnv: getMemoryServiceClientFromEnvMock,
}));

describe("memoryQueryRouter", () => {
  it("episode 路由会透传 timeRange、topK 与 counterpartyName", async () => {
    getRecentMemoryEpisodesMock.mockResolvedValueOnce([
      {
        _id: "episode_1",
        type: "behavior",
        source: "world_tick",
        summaryText: "今天和小久一起在咖啡店聊天",
        happenedAt: new Date("2026-03-14T08:00:00.000Z"),
        payload: {
          relatedPlanId: "plan_1",
        },
      },
    ]);

    const { searchEpisodes } = await import("./query-router");
    const result = await searchEpisodes({
      query: "小久 咖啡店",
      timeRange: "today",
      topK: 3,
      counterpartyName: "小久",
    });

    expect(getRecentMemoryEpisodesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 20,
        onlyToday: true,
        counterpartyId: "小久",
      }),
    );
    expect(result[0]).toMatchObject({
      source: "episode",
      evidenceIds: ["episode_1"],
      metadata: {
        episodeType: "behavior",
        planId: "plan_1",
        source: "world_tick",
      },
    });
  });

  it("fact 路由会透传 counterpartyName 与 topK，并兼容 evidenceIds", async () => {
    const searchMemoryMock = vi.fn().mockResolvedValue([
      {
        memory: "小久喜欢无糖乌龙茶",
        source: "graphiti",
        score: 0.92,
        evidence_ids: ["episode_a"],
        metadata: {
          category: "preference",
        },
      },
    ]);
    getMemoryServiceClientFromEnvMock.mockReturnValueOnce({
      searchMemory: searchMemoryMock,
    });

    const { searchFacts } = await import("./query-router");
    const result = await searchFacts({
      query: "小久喜欢什么",
      topK: 2,
      counterpartyName: "小久",
    });

    expect(searchMemoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "小久喜欢什么",
        top_k: 2,
        counterparty_name: "小久",
      }),
    );
    expect(result[0]).toMatchObject({
      source: "fact",
      evidenceIds: ["episode_a"],
      metadata: {
        category: "preference",
        source: "graphiti",
      },
    });
  });

  it("plan 路由会返回 mainPlan 与 activePlans", async () => {
    initPlanStateDataMock.mockResolvedValueOnce({
      updatedAt: "2026-03-14T10:00:00.000Z",
      mainPlan: {
        id: "plan_main",
        title: "准备考试",
        scope: "main",
        status: "active",
        createdAt: "2026-03-14T09:00:00.000Z",
        updatedAt: "2026-03-14T10:00:00.000Z",
      },
      activePlans: [
        {
          id: "plan_active",
          title: "复习数学",
          scope: "active",
          status: "active",
          createdAt: "2026-03-14T09:30:00.000Z",
          updatedAt: "2026-03-14T10:10:00.000Z",
        },
      ],
    });

    const { searchPlans } = await import("./query-router");
    const result = await searchPlans({
      query: "今天的计划是什么",
      topK: 5,
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.evidenceIds).toEqual(["plan_main"]);
    expect(result[1]?.metadata).toMatchObject({
      planId: "plan_active",
      scope: "active",
      status: "active",
    });
  });

  it("auto 路由会按 plan -> fact -> episode 合并并按 score 排序", async () => {
    initPlanStateDataMock.mockResolvedValueOnce({
      updatedAt: "2026-03-14T10:00:00.000Z",
      mainPlan: {
        id: "plan_main",
        title: "准备考试",
        scope: "main",
        status: "active",
        createdAt: "2026-03-14T09:00:00.000Z",
        updatedAt: "2026-03-14T10:00:00.000Z",
      },
      activePlans: [],
    });
    const searchMemoryMock = vi.fn().mockResolvedValue([
      {
        memory: "悠酱最近为了考试常去图书馆",
        score: 5,
        source: "graphiti",
      },
    ]);
    getMemoryServiceClientFromEnvMock.mockReturnValueOnce({
      searchMemory: searchMemoryMock,
    });
    getRecentMemoryEpisodesMock.mockResolvedValueOnce([
      {
        _id: "episode_2",
        type: "behavior",
        source: "world_tick",
        summaryText: "今天上午去图书馆复习数学，为考试做准备",
        happenedAt: new Date("2026-03-14T11:00:00.000Z"),
        payload: {},
      },
    ]);

    const { memoryQueryRouter } = await import("./query-router");
    const result = await memoryQueryRouter.search({
      query: "计划 考试",
      memoryType: "auto",
      topK: 3,
    });

    expect(result.map((item) => item.source)).toEqual(["fact", "plan", "episode"]);
  });
});

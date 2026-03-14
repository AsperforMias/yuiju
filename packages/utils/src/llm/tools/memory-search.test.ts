import { describe, expect, it, vi } from "vitest";

const searchMock = vi.fn();

vi.mock("../../memory", () => ({
  memoryQueryRouter: {
    search: searchMock,
  },
}));

describe("memorySearchTool", () => {
  it("使用新契约调用 query router", async () => {
    searchMock.mockResolvedValueOnce([
      {
        source: "fact",
        score: 1,
        summary: "悠酱喜欢草莓牛奶",
        evidenceIds: ["episode_1"],
        metadata: {
          source: "graphiti",
        },
      },
    ]);

    const { memorySearchTool } = await import("./memory-search");
    const result = await (memorySearchTool.execute as ((...args: unknown[]) => Promise<unknown>))(
      {
        query: "悠酱喜欢什么",
        memoryType: "fact",
        timeRange: "all",
        counterpartyName: "小久",
        topK: 3,
      },
      {},
    );

    expect(searchMock).toHaveBeenCalledWith({
      query: "悠酱喜欢什么",
      memoryType: "fact",
      timeRange: "all",
      counterpartyName: "小久",
      topK: 3,
    });
    expect(result).toEqual([
      expect.objectContaining({
        evidenceIds: ["episode_1"],
        metadata: {
          source: "graphiti",
        },
      }),
    ]);
  });
});

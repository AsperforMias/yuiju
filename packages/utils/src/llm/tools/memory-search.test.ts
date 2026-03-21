import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

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
        source: "diary",
        score: 1,
        summary: "今天和小久聊过之后，心里一直有一点轻轻的开心。",
        evidenceIds: ["diary_1"],
        metadata: {
          displayDate: "2026-03-17",
        },
      },
    ]);

    const { memorySearchTool } = await import("./memory-search");
    const result = await (memorySearchTool.execute as (...args: unknown[]) => Promise<unknown>)(
      {
        query: "昨天我和小久聊了什么",
        memoryType: "diary",
        timeRange: "yesterday",
        startTime: "2026-03-17 00:00:00",
        endTime: "2026-03-17 23:59:59",
        timeSort: "asc",
        counterpartyName: "小久",
        topK: 3,
      },
      {},
    );

    expect(searchMock).toHaveBeenCalledWith({
      query: "昨天我和小久聊了什么",
      memoryType: "diary",
      timeRange: "yesterday",
      startTime: "2026-03-17 00:00:00",
      endTime: "2026-03-17 23:59:59",
      timeSort: "asc",
      counterpartyName: "小久",
      topK: 3,
    });
    expect(result).toEqual([
      expect.objectContaining({
        evidenceIds: ["diary_1"],
        metadata: {
          displayDate: "2026-03-17",
        },
      }),
    ]);
  });

  it("要求必须显式传入 memoryType", async () => {
    const { memorySearchTool } = await import("./memory-search");
    const inputSchema = memorySearchTool.inputSchema as z.ZodType;
    const parseResult = inputSchema.safeParse({
      query: "悠酱喜欢什么",
    });

    expect(parseResult.success).toBe(false);
  });
});

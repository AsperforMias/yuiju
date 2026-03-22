import { buildDiarySystemPrompt } from "@yuiju/source";
import type { IMemoryEpisode } from "@yuiju/utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateTextMock, getRecentMemoryEpisodesMock, upsertMemoryDiaryMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
  getRecentMemoryEpisodesMock: vi.fn(),
  upsertMemoryDiaryMock: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: generateTextMock,
}));

vi.mock("@yuiju/utils", async () => {
  const actual = await vi.importActual<typeof import("@yuiju/utils")>("@yuiju/utils");
  return {
    ...actual,
    getRecentMemoryEpisodes: getRecentMemoryEpisodesMock,
    upsertMemoryDiary: upsertMemoryDiaryMock,
  };
});

import {
  buildDiaryMaterials,
  generateDiaryForDate,
  resolveDiaryDateForSleep,
} from "@/memory/diary";

function createEpisode(input: {
  type: IMemoryEpisode["type"];
  summaryText: string;
  happenedAt: string;
  payload?: Record<string, unknown>;
}): IMemoryEpisode {
  return {
    _id: `${input.type}_${input.happenedAt}`,
    id: `${input.type}_${input.happenedAt}`,
    source: input.type === "conversation" ? "chat" : "world_tick",
    type: input.type,
    subjectId: "ゆいじゅ",
    happenedAt: new Date(input.happenedAt),
    summaryText: input.summaryText,
    importance: 0.5,
    payload: input.payload ?? {},
    extractionStatus: "pending",
    isDev: true,
  } as unknown as IMemoryEpisode;
}

function createConversationEpisode(input: {
  happenedAt: string;
  messages: Array<{ speaker_name: string; content: string; timestamp: string }>;
  counterpartyName?: string;
}): IMemoryEpisode {
  return createEpisode({
    type: "conversation",
    happenedAt: input.happenedAt,
    summaryText: `和${input.counterpartyName ?? "测试用户"}聊了一会儿`,
    payload: {
      counterpartyName: input.counterpartyName ?? "测试用户",
      messageCount: input.messages.length,
      messages: input.messages,
    },
  });
}

describe("diary generator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("聊天内容未超预算时直接保留原始 conversation 素材", async () => {
    const materials = await buildDiaryMaterials([
      createEpisode({
        type: "behavior",
        summaryText: "悠酱在家里看了一会儿轻小说",
        happenedAt: "2026-03-18T18:00:00+08:00",
      }),
      createConversationEpisode({
        happenedAt: "2026-03-18T19:00:00+08:00",
        messages: [
          {
            speaker_name: "小久",
            content: "今天过得怎么样？",
            timestamp: "2026-03-18 周三 19:00",
          },
          {
            speaker_name: "ゆいじゅ",
            content: "还好呀，就是有点想吃甜的。",
            timestamp: "2026-03-18 周三 19:01",
          },
        ],
      }),
    ]);

    expect(generateTextMock).not.toHaveBeenCalled();
    expect(materials.some((item) => item.type === "conversation")).toBe(true);
    expect(materials.find((item) => item.type === "conversation")?.content).toContain(
      "今天过得怎么样",
    );
  });

  it("当天聊天超预算时会按大块 episode 分组做自由文本摘要", async () => {
    generateTextMock.mockResolvedValue({
      text: "今天和小久断断续续聊了很多学校和甜品的小事，整体气氛一直很轻松。",
    });

    const conversationEpisodes = Array.from({ length: 31 }, (_, index) =>
      createConversationEpisode({
        happenedAt: `2026-03-18T20:${String(index % 60).padStart(2, "0")}:00+08:00`,
        counterpartyName: "小久",
        messages: [
          {
            speaker_name: "小久",
            content: "今天断断续续聊了好多事情呢。".repeat(300),
            timestamp: `2026-03-18 周三 20:${String(index % 60).padStart(2, "0")}`,
          },
          {
            speaker_name: "ゆいじゅ",
            content: "嗯，我也说了很多心里话。".repeat(300),
            timestamp: `2026-03-18 周三 20:${String((index + 1) % 60).padStart(2, "0")}`,
          },
        ],
      }),
    );

    const materials = await buildDiaryMaterials(conversationEpisodes);

    expect(generateTextMock).toHaveBeenCalledTimes(2);
    expect(materials).toEqual([
      expect.objectContaining({
        type: "conversation_batch_summary",
      }),
      expect.objectContaining({
        type: "conversation_batch_summary",
      }),
    ]);
  });

  it("会为指定日期生成并 upsert 一篇日记", async () => {
    getRecentMemoryEpisodesMock.mockResolvedValue([
      createEpisode({
        type: "behavior",
        summaryText: "悠酱放学后回到了家",
        happenedAt: "2026-03-18T17:00:00+08:00",
      }),
      createEpisode({
        type: "plan_updated",
        summaryText: "悠酱更新了活跃计划；新计划：今晚整理笔记",
        happenedAt: "2026-03-18T18:00:00+08:00",
      }),
    ]);
    generateTextMock.mockResolvedValue({
      text: "今天回到家之后，心情终于慢慢安静下来了。",
    });
    upsertMemoryDiaryMock.mockResolvedValue({
      _id: "diary_1",
    });

    const generated = await generateDiaryForDate({
      diaryDate: new Date("2026-03-18T23:00:00+08:00"),
      isDev: true,
    });

    expect(generated).toBe(true);
    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect(upsertMemoryDiaryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "ゆいじゅ",
        text: "今天回到家之后，心情终于慢慢安静下来了。",
      }),
    );
  });

  it("日记 prompt 会强调少女私密日记风格与事实约束", () => {
    const prompt = buildDiarySystemPrompt({
      subject: "ゆいじゅ",
      diaryDate: new Date("2026-03-18T23:00:00+08:00"),
    });

    expect(prompt).toContain("17 岁少女");
    expect(prompt).toContain("第一人称");
    expect(prompt).toContain("不允许编造");
  });

  it("凌晨入睡时会把日记日期归到前一天", () => {
    expect(resolveDiaryDateForSleep(new Date("2026-03-19T01:30:00+08:00")).toISOString()).toBe(
      new Date("2026-03-18T00:00:00+08:00").toISOString(),
    );

    expect(resolveDiaryDateForSleep(new Date("2026-03-18T23:30:00+08:00")).toISOString()).toBe(
      new Date("2026-03-18T00:00:00+08:00").toISOString(),
    );
  });
});

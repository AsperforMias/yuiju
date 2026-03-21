import { buildDiarySystemPrompt } from "@yuiju/source";
import type { IMemoryEpisode } from "@yuiju/utils";
import { describe, expect, it, vi } from "vitest";
import { buildDiaryMaterials, generateDiaryForDate } from "@/diary";

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
  it("聊天内容未超预算时直接保留原始 conversation 素材", async () => {
    const summarizeConversationChunk = vi.fn();
    const mergeConversationSummaries = vi.fn();

    const materials = await buildDiaryMaterials(
      [
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
      ],
      {
        summarizeConversationChunk,
        mergeConversationSummaries,
      },
    );

    expect(summarizeConversationChunk).not.toHaveBeenCalled();
    expect(mergeConversationSummaries).not.toHaveBeenCalled();
    expect(materials.some((item) => item.type === "conversation")).toBe(true);
    expect(materials.find((item) => item.type === "conversation")?.content).toContain(
      "今天过得怎么样",
    );
  });

  it("聊天内容超预算时会进入两段总结链路", async () => {
    const summarizeConversationChunk = vi.fn().mockResolvedValue({
      topicSummary: "聊了很多学校和甜品的话题",
      emotionSummary: "整体气氛轻松，后面有一点害羞",
      preferenceSignals: ["喜欢甜品"],
      relationSignals: ["和小久聊天时更放松了"],
      representativeQuotes: ["我有点想吃甜的。"],
    });
    const mergeConversationSummaries = vi.fn().mockResolvedValue({
      topicSummary: "围绕学校生活和甜品心情聊了很久",
      emotionSummary: "从平静聊到有点开心",
      preferenceSignals: ["喜欢甜品"],
      relationSignals: ["和小久相处自然"],
      representativeQuotes: ["我有点想吃甜的。"],
    });

    const longMessages = Array.from({ length: 20 }, (_, index) => ({
      speaker_name: index % 2 === 0 ? "小久" : "ゆいじゅ",
      content: `这是第 ${index + 1} 句聊天内容，${"今天聊了很多事情。".repeat(20)}`,
      timestamp: `2026-03-18 周三 20:${String(index).padStart(2, "0")}`,
    }));

    const materials = await buildDiaryMaterials(
      [
        createConversationEpisode({
          happenedAt: "2026-03-18T20:00:00+08:00",
          messages: longMessages,
          counterpartyName: "小久",
        }),
      ],
      {
        summarizeConversationChunk,
        mergeConversationSummaries,
      },
    );

    expect(summarizeConversationChunk.mock.calls.length).toBeGreaterThan(1);
    expect(mergeConversationSummaries).toHaveBeenCalledTimes(1);
    expect(materials).toEqual([
      expect.objectContaining({
        type: "conversation_summary",
      }),
    ]);
  });

  it("会为指定日期生成并 upsert 一篇日记", async () => {
    const loadEpisodes = vi.fn().mockResolvedValue([
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
    const writeDiaryText = vi.fn().mockResolvedValue("今天回到家之后，心情终于慢慢安静下来了。");
    const saveDiary = vi.fn().mockResolvedValue({
      _id: "diary_1",
    });

    const generated = await generateDiaryForDate(
      {
        diaryDate: new Date("2026-03-18T23:00:00+08:00"),
        isDev: true,
      },
      {
        loadEpisodes,
        writeDiaryText,
        saveDiary,
      },
    );

    expect(generated).toBe(true);
    expect(writeDiaryText).toHaveBeenCalledTimes(1);
    expect(saveDiary).toHaveBeenCalledWith(
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
});

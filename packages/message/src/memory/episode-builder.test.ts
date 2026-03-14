import { describe, expect, it } from "vitest";
import { buildConversationEpisode, type UserWindowState } from "./episode-builder";

describe("message conversation episode builder", () => {
  it("根据窗口消息生成 conversation episode", () => {
    const state: UserWindowState = {
      windowStartMs: new Date("2026-03-13T10:00:00.000Z").getTime(),
      lastTsMs: new Date("2026-03-13T10:08:00.000Z").getTime(),
      messages: [
        {
          speaker_name: "测试用户",
          content: "今天想聊聊学习计划",
          timestamp: "2026-03-13 周五 18:00",
        },
        {
          speaker_name: "ゆいじゅ",
          content: "可以，我们一起梳理一下",
          timestamp: "2026-03-13 周五 18:01",
        },
      ],
    };

    const episode = buildConversationEpisode({
      counterpartyName: "测试用户",
      state,
      isDev: true,
    });

    expect(episode.type).toBe("conversation");
    expect(episode.counterpartyId).toBe("测试用户");
    expect(episode.payload.messageCount).toBe(2);
    expect(episode.summaryText).toContain("测试用户");
    expect(episode.summaryText).toContain("消息数量：2");
  });
});

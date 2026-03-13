import { describe, expect, it } from "vitest";
import { DEFAULT_MEMORY_SUBJECT_ID, ruleBasedMemoryExtractor, type MemoryEpisode } from "@yuiju/utils";

describe("ruleBasedMemoryExtractor", () => {
  it("能从 plan_update episode 提炼 plan fact", () => {
    const episode: MemoryEpisode = {
      id: "episode_plan_1",
      source: "world_tick",
      type: "plan_update",
      subjectId: DEFAULT_MEMORY_SUBJECT_ID,
      happenedAt: new Date("2026-03-14T10:00:00.000Z"),
      summaryText: "悠酱创建了主计划；新计划：准备考试",
      importance: 0.8,
      extractionStatus: "pending",
      payload: {
        planId: "plan_1",
        planScope: "main",
        changeType: "created",
        after: {
          id: "plan_1",
          title: "准备考试",
          status: "active",
        },
      },
    };

    const facts = ruleBasedMemoryExtractor.extract(episode);
    expect(facts).toHaveLength(1);
    expect(facts[0]?.type).toBe("plan");
    expect(facts[0]?.object).toBe("准备考试");
  });

  it("能从对话中提炼偏好与关系 fact", () => {
    const episode: MemoryEpisode = {
      id: "episode_chat_1",
      source: "chat",
      type: "conversation",
      subjectId: DEFAULT_MEMORY_SUBJECT_ID,
      counterpartyId: "小明",
      happenedAt: new Date("2026-03-14T12:00:00.000Z"),
      summaryText: "悠酱和小明聊到了喜欢的食物",
      importance: 0.7,
      extractionStatus: "pending",
      payload: {
        counterpartyName: "小明",
        messages: [
          {
            speaker_name: "小明",
            content: "你最近喜欢吃什么？",
            timestamp: "03-14 12:00",
          },
          {
            speaker_name: "ゆいじゅ",
            content: "我喜欢草莓蛋糕，谢谢你来陪我聊天，下次再聊！",
            timestamp: "03-14 12:01",
          },
        ],
      },
    };

    const facts = ruleBasedMemoryExtractor.extract(episode);
    expect(facts.some((fact) => fact.type === "preference" && fact.object.includes("草莓蛋糕"))).toBe(
      true,
    );
    expect(facts.some((fact) => fact.type === "relation" && fact.object === "小明")).toBe(true);
  });
});

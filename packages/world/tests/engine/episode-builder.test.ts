import { describe, expect, it } from "vitest";
import { ActionId, MajorScene, type ActionAgentDecision, type ActionContext } from "@yuiju/utils";
import { buildBehaviorEpisode, buildPlanUpdateEpisodes } from "@/memory/episode-builder";

function createContext(): ActionContext {
  return {
    characterState: {
      action: ActionId.Idle,
      location: { major: MajorScene.Home },
      stamina: 80,
      satiety: 70,
      mood: 60,
      money: 100,
      dailyActionsDoneToday: [],
      longTermPlan: "努力学习",
      shortTermPlan: ["完成作业"],
      inventory: [],
      setAction: async () => {},
      setStamina: async () => {},
      setSatiety: async () => {},
      setMood: async () => {},
      setLocation: async () => {},
      changeStamina: async () => {},
      changeSatiety: async () => {},
      changeMood: async () => {},
      changeMoney: async () => {},
      markActionDoneToday: async () => {},
      clearDailyActions: async () => {},
      log() {
        return {
          action: this.action,
          location: this.location,
          stamina: this.stamina,
          satiety: this.satiety,
          mood: this.mood,
          money: this.money,
          dailyActionsDoneToday: this.dailyActionsDoneToday,
          longTermPlan: this.longTermPlan,
          shortTermPlan: this.shortTermPlan,
          inventory: this.inventory,
        };
      },
      addItem: async () => {},
      consumeItem: async () => false,
      getItemQuantity: () => 0,
      setLongTermPlan: async () => {},
      setShortTermPlan: async () => {},
    },
    worldState: {
      time: {} as never,
      log: () => ({ time: {} as never }),
      updateTime: async () => {},
      reset: async () => {},
    },
  };
}

function createDecision(overrides: Partial<ActionAgentDecision> = {}): ActionAgentDecision {
  return {
    action: ActionId.Study_At_School,
    reason: "需要推进学习计划",
    ...overrides,
  };
}

describe("world episode builder", () => {
  it("行为执行成功时生成 behavior episode", () => {
    const episode = buildBehaviorEpisode({
      context: createContext(),
      selectedAction: createDecision(),
      executionResult: "完成了一章练习",
      durationMinutes: 45,
      happenedAt: new Date("2026-03-13T10:00:00.000Z"),
      isDev: true,
    });

    expect(episode).not.toBeNull();
    expect(episode?.type).toBe("behavior");
    expect(episode?.summaryText).toContain("在学校学习");
    expect(episode?.summaryText).toContain("完成了一章练习");
    expect(episode?.payload.durationMinutes).toBe(45);
  });

  it("发呆行为不生成 behavior episode", () => {
    const episode = buildBehaviorEpisode({
      context: createContext(),
      selectedAction: createDecision({ action: ActionId.Idle }),
      durationMinutes: 10,
      happenedAt: new Date("2026-03-13T10:00:00.000Z"),
      isDev: true,
    });

    expect(episode).toBeNull();
  });

  it("计划未变化时不生成 plan_update episode", () => {
    const episodes = buildPlanUpdateEpisodes({
      previousLongTermPlan: "努力学习",
      nextLongTermPlan: "努力学习",
      previousShortTermPlan: ["完成作业"],
      nextShortTermPlan: ["完成作业"],
      happenedAt: new Date("2026-03-13T10:00:00.000Z"),
      isDev: true,
    });

    expect(episodes).toHaveLength(0);
  });

  it("长期与短期计划变化时分别生成 plan_update episode", () => {
    const episodes = buildPlanUpdateEpisodes({
      previousLongTermPlan: "努力学习",
      nextLongTermPlan: "准备考试",
      previousShortTermPlan: ["完成作业"],
      nextShortTermPlan: ["完成作业", "复习数学"],
      happenedAt: new Date("2026-03-13T10:00:00.000Z"),
      isDev: true,
    });

    expect(episodes).toHaveLength(2);
    expect(episodes[0]?.payload.planScope).toBe("long_term");
    expect(episodes[1]?.payload.planScope).toBe("short_term");
    expect(episodes[1]?.summaryText).toContain("复习数学");
  });
});

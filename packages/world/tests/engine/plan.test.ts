import "dotenv/config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { characterState } from "@/state/character-state";
import { ActionId } from "@/types/action";

process.env.NODE_ENV = "development";

describe("短期与长期计划功能", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await characterState.load();
  });

  it("设置长期计划：保存到 Redis 并能正确读取", async () => {
    const plan = "努力学习，考上理想的大学";
    await characterState.setLongTermPlan(plan);

    expect(characterState.longTermPlan).toBe(plan);

    await characterState.load();
    expect(characterState.longTermPlan).toBe(plan);
  });

  it("设置短期计划：保存到 Redis 并能正确读取", async () => {
    const plan = ["完成今天的作业", "复习数学", "预习明天课程"];
    await characterState.setShortTermPlan(plan);

    expect(characterState.shortTermPlan).toEqual(plan);

    await characterState.load();
    expect(characterState.shortTermPlan).toEqual(plan);
  });

  it("更新短期计划：采用全量替换策略", async () => {
    const initialPlan = ["完成今天的作业", "复习数学"];
    await characterState.setShortTermPlan(initialPlan);
    expect(characterState.shortTermPlan).toEqual(initialPlan);

    const updatedPlan = ["完成今天的作业", "复习数学", "预习明天课程", "准备考试"];
    await characterState.setShortTermPlan(updatedPlan);
    expect(characterState.shortTermPlan).toEqual(updatedPlan);
    expect(characterState.shortTermPlan).not.toEqual(initialPlan);
  });

  it("清空长期计划：设置为 undefined", async () => {
    const plan = "努力学习，考上理想的大学";
    await characterState.setLongTermPlan(plan);
    expect(characterState.longTermPlan).toBe(plan);

    await characterState.setLongTermPlan(undefined);
    expect(characterState.longTermPlan).toBeUndefined();

    await characterState.load();
    expect(characterState.longTermPlan).toBeUndefined();
  });

  it("清空短期计划：设置为空数组", async () => {
    const plan = ["完成今天的作业", "复习数学"];
    await characterState.setShortTermPlan(plan);
    expect(characterState.shortTermPlan).toEqual(plan);

    await characterState.setShortTermPlan([]);
    expect(characterState.shortTermPlan).toEqual([]);

    await characterState.load();
    expect(characterState.shortTermPlan).toEqual([]);
  });

  it("同时设置长期和短期计划：两者互不影响", async () => {
    const longTermPlan = "努力学习，考上理想的大学";
    const shortTermPlan = ["完成今天的作业", "复习数学"];

    await characterState.setLongTermPlan(longTermPlan);
    await characterState.setShortTermPlan(shortTermPlan);

    expect(characterState.longTermPlan).toBe(longTermPlan);
    expect(characterState.shortTermPlan).toEqual(shortTermPlan);

    await characterState.load();
    expect(characterState.longTermPlan).toBe(longTermPlan);
    expect(characterState.shortTermPlan).toEqual(shortTermPlan);
  });

  it("短期计划包含特殊字符：正确保存和读取", async () => {
    const plan = ["完成今天的作业", "复习数学（重点）", "预习明天课程-第3章", "准备考试！"];
    await characterState.setShortTermPlan(plan);

    expect(characterState.shortTermPlan).toEqual(plan);

    await characterState.load();
    expect(characterState.shortTermPlan).toEqual(plan);
  });

  it("长期计划包含特殊字符：正确保存和读取", async () => {
    const plan = "努力学习，考上理想的大学（重点专业）！";
    await characterState.setLongTermPlan(plan);

    expect(characterState.longTermPlan).toBe(plan);

    await characterState.load();
    expect(characterState.longTermPlan).toBe(plan);
  });

  it("短期计划为空数组：正确处理", async () => {
    await characterState.setShortTermPlan([]);
    expect(characterState.shortTermPlan).toEqual([]);

    await characterState.load();
    expect(characterState.shortTermPlan).toEqual([]);
  });

  it("短期计划包含单个元素：正确处理", async () => {
    const plan = ["完成今天的作业"];
    await characterState.setShortTermPlan(plan);
    expect(characterState.shortTermPlan).toEqual(plan);

    await characterState.load();
    expect(characterState.shortTermPlan).toEqual(plan);
  });

  it("长期计划为空字符串：正确处理", async () => {
    const plan = "";
    await characterState.setLongTermPlan(plan);
    expect(characterState.longTermPlan).toBe(plan);

    await characterState.load();
    expect(characterState.longTermPlan).toBe(plan);
  });

  it("计划与其他状态字段互不影响：设置计划不影响其他状态", async () => {
    await characterState.setAction(ActionId.Idle);
    await characterState.setStamina(80);
    await characterState.setMoney(100);

    const longTermPlan = "努力学习，考上理想的大学";
    const shortTermPlan = ["完成今天的作业", "复习数学"];

    await characterState.setLongTermPlan(longTermPlan);
    await characterState.setShortTermPlan(shortTermPlan);

    expect(characterState.action).toBe(ActionId.Idle);
    expect(characterState.stamina).toBe(80);
    expect(characterState.money).toBe(100);
    expect(characterState.longTermPlan).toBe(longTermPlan);
    expect(characterState.shortTermPlan).toEqual(shortTermPlan);
  });
});

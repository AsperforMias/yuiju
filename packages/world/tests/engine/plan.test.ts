import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'dotenv/config';
import { charactorState } from '@/state/charactor-state';
import { ActionId } from '@/types/action';

describe('短期与长期计划功能', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await charactorState.load();
  });

  it('设置长期计划：保存到 Redis 并能正确读取', async () => {
    const plan = '努力学习，考上理想的大学';
    await charactorState.setLongTermPlan(plan);

    expect(charactorState.longTermPlan).toBe(plan);

    await charactorState.load();
    expect(charactorState.longTermPlan).toBe(plan);
  });

  it('设置短期计划：保存到 Redis 并能正确读取', async () => {
    const plan = ['完成今天的作业', '复习数学', '预习明天课程'];
    await charactorState.setShortTermPlan(plan);

    expect(charactorState.shortTermPlan).toEqual(plan);

    await charactorState.load();
    expect(charactorState.shortTermPlan).toEqual(plan);
  });

  it('更新短期计划：采用全量替换策略', async () => {
    const initialPlan = ['完成今天的作业', '复习数学'];
    await charactorState.setShortTermPlan(initialPlan);
    expect(charactorState.shortTermPlan).toEqual(initialPlan);

    const updatedPlan = ['完成今天的作业', '复习数学', '预习明天课程', '准备考试'];
    await charactorState.setShortTermPlan(updatedPlan);
    expect(charactorState.shortTermPlan).toEqual(updatedPlan);
    expect(charactorState.shortTermPlan).not.toEqual(initialPlan);
  });

  it('清空长期计划：设置为 undefined', async () => {
    const plan = '努力学习，考上理想的大学';
    await charactorState.setLongTermPlan(plan);
    expect(charactorState.longTermPlan).toBe(plan);

    await charactorState.setLongTermPlan(undefined);
    expect(charactorState.longTermPlan).toBeUndefined();

    await charactorState.load();
    expect(charactorState.longTermPlan).toBeUndefined();
  });

  it('清空短期计划：设置为空数组', async () => {
    const plan = ['完成今天的作业', '复习数学'];
    await charactorState.setShortTermPlan(plan);
    expect(charactorState.shortTermPlan).toEqual(plan);

    await charactorState.setShortTermPlan([]);
    expect(charactorState.shortTermPlan).toEqual([]);

    await charactorState.load();
    expect(charactorState.shortTermPlan).toEqual([]);
  });

  it('同时设置长期和短期计划：两者互不影响', async () => {
    const longTermPlan = '努力学习，考上理想的大学';
    const shortTermPlan = ['完成今天的作业', '复习数学'];

    await charactorState.setLongTermPlan(longTermPlan);
    await charactorState.setShortTermPlan(shortTermPlan);

    expect(charactorState.longTermPlan).toBe(longTermPlan);
    expect(charactorState.shortTermPlan).toEqual(shortTermPlan);

    await charactorState.load();
    expect(charactorState.longTermPlan).toBe(longTermPlan);
    expect(charactorState.shortTermPlan).toEqual(shortTermPlan);
  });

  it('短期计划包含特殊字符：正确保存和读取', async () => {
    const plan = ['完成今天的作业', '复习数学（重点）', '预习明天课程-第3章', '准备考试！'];
    await charactorState.setShortTermPlan(plan);

    expect(charactorState.shortTermPlan).toEqual(plan);

    await charactorState.load();
    expect(charactorState.shortTermPlan).toEqual(plan);
  });

  it('长期计划包含特殊字符：正确保存和读取', async () => {
    const plan = '努力学习，考上理想的大学（重点专业）！';
    await charactorState.setLongTermPlan(plan);

    expect(charactorState.longTermPlan).toBe(plan);

    await charactorState.load();
    expect(charactorState.longTermPlan).toBe(plan);
  });

  it('短期计划为空数组：正确处理', async () => {
    await charactorState.setShortTermPlan([]);
    expect(charactorState.shortTermPlan).toEqual([]);

    await charactorState.load();
    expect(charactorState.shortTermPlan).toEqual([]);
  });

  it('短期计划包含单个元素：正确处理', async () => {
    const plan = ['完成今天的作业'];
    await charactorState.setShortTermPlan(plan);
    expect(charactorState.shortTermPlan).toEqual(plan);

    await charactorState.load();
    expect(charactorState.shortTermPlan).toEqual(plan);
  });

  it('长期计划为空字符串：正确处理', async () => {
    const plan = '';
    await charactorState.setLongTermPlan(plan);
    expect(charactorState.longTermPlan).toBe(plan);

    await charactorState.load();
    expect(charactorState.longTermPlan).toBe(plan);
  });

  it('计划与其他状态字段互不影响：设置计划不影响其他状态', async () => {
    await charactorState.setAction(ActionId.Idle);
    await charactorState.setStamina(80);
    await charactorState.setMoney(100);

    const longTermPlan = '努力学习，考上理想的大学';
    const shortTermPlan = ['完成今天的作业', '复习数学'];

    await charactorState.setLongTermPlan(longTermPlan);
    await charactorState.setShortTermPlan(shortTermPlan);

    expect(charactorState.action).toBe(ActionId.Idle);
    expect(charactorState.stamina).toBe(80);
    expect(charactorState.money).toBe(100);
    expect(charactorState.longTermPlan).toBe(longTermPlan);
    expect(charactorState.shortTermPlan).toEqual(shortTermPlan);
  });
});

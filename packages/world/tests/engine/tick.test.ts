import { describe, it, expect, beforeEach, vi } from 'vitest';
import dayjs from 'dayjs';

vi.mock('@/llm/llm-client', () => {
  return {
    chooseAction: vi.fn(),
  };
});

vi.mock('@/memory/short-action', () => {
  const buffer: any[] = [];
  return {
    shortActionMemory: {
      push: vi.fn((entry: any) => {
        buffer.push(entry);
      }),
      list: vi.fn(() => [...buffer]),
      clear: vi.fn(() => {
        buffer.length = 0;
      }),
    },
  };
});

vi.mock('@/utils/logger', () => {
  return {
    logger: {
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    },
  };
});

import { tick } from '@/engine/tick';
import { ActionId } from '@/types/action';
import { charactorState } from '@/state/charactor-state';
import { worldState } from '@/state/world-state';
import { chooseAction } from '@/llm/llm-client';
import { shortActionMemory } from '@/memory/short-action';

const chooseActionMock = chooseAction as any;
const shortMem = shortActionMemory as any;

function resetState(opts: {
  locationMajor: 'home' | 'school';
  stamina?: number;
  money?: number;
  action?: ActionId;
  timeISO: string;
}) {
  charactorState.setAction(opts.action ?? ActionId.Idle);
  charactorState.setStamina(typeof opts.stamina === 'number' ? opts.stamina : 100);
  if (typeof opts.money === 'number') {
    charactorState.changeMoney(opts.money - charactorState.money);
  } else {
    charactorState.changeMoney(-charactorState.money);
  }
  (charactorState.location as any).major = opts.locationMajor;
  charactorState.clearDailyActions();
  shortMem.clear();
  worldState.updateTime(dayjs(opts.timeISO));
}

describe('tick()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('执行 Eat_Lunch：更新体力与每日记录，返回20分钟', async () => {
    resetState({
      locationMajor: 'home',
      stamina: 40,
      action: ActionId.Idle,
      timeISO: '2025-01-01T12:00:00',
    });
    chooseActionMock.mockResolvedValue({
      action: ActionId.Eat_Lunch,
      reason: '午餐时间到了',
    });

    const minutes = await tick();

    expect(charactorState.action).toBe(ActionId.Eat_Lunch);
    expect(charactorState.stamina).toBe(90);
    expect(charactorState.dailyActionsDoneToday.includes(ActionId.Eat_Lunch)).toBe(true);
    expect(minutes).toBe(20);
    expect(shortMem.push).toHaveBeenCalledTimes(1);
  });

  it('执行 Go_To_School：体力-10，返回30分钟', async () => {
    resetState({
      locationMajor: 'home',
      stamina: 60,
      action: ActionId.Idle,
      timeISO: '2025-01-01T08:00:00',
    });
    chooseActionMock.mockResolvedValue({
      action: ActionId.Go_To_School,
      reason: '工作日早上应该去学校',
    });

    const minutes = await tick();

    expect(charactorState.action).toBe(ActionId.Go_To_School);
    expect(charactorState.stamina).toBe(50);
    expect(minutes).toBe(30);
    expect(shortMem.push).toHaveBeenCalledTimes(1);
  });

  it('执行 Idle 且 LLM给出耗时：返回给定分钟数', async () => {
    resetState({
      locationMajor: 'school',
      stamina: 80,
      action: ActionId.Idle,
      timeISO: '2025-01-01T10:00:00',
    });
    chooseActionMock.mockResolvedValue({
      action: ActionId.Idle,
      reason: '短暂休息',
      durationMinute: 15,
    });

    const minutes = await tick();

    expect(charactorState.action).toBe(ActionId.Idle);
    expect(minutes).toBe(15);
    expect(shortMem.push).toHaveBeenCalledTimes(1);
  });

  it('LLM选择不可执行动作：返回 Idle 默认10分钟，不更改状态', async () => {
    resetState({
      locationMajor: 'school',
      stamina: 80,
      action: ActionId.Idle,
      timeISO: '2025-01-01T10:00:00',
    });
    chooseActionMock.mockResolvedValue({
      action: ActionId.Stay_At_Home,
      reason: '错误选择',
    });

    const minutes = await tick();

    expect(charactorState.action).toBe(ActionId.Idle);
    expect(minutes).toBe(10);
    expect(shortMem.push).not.toHaveBeenCalled();
  });

  it('当前为 Sleep：预检查只给 Wake_Up，执行后体力设为20并清空每日记录，返回10分钟', async () => {
    resetState({
      locationMajor: 'home',
      stamina: 5,
      action: ActionId.Sleep,
      timeISO: '2025-01-01T08:00:00',
    });
    chooseActionMock.mockResolvedValue({
      action: ActionId.Wake_Up,
      reason: '起床时间',
    });

    const minutes = await tick();

    expect(charactorState.action).toBe(ActionId.Wake_Up);
    expect(charactorState.stamina).toBe(20);
    expect(charactorState.dailyActionsDoneToday.length).toBe(0);
    expect(minutes).toBe(10);
    expect(shortMem.push).toHaveBeenCalledTimes(1);
  });
});

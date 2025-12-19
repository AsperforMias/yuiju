import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import { getActionList } from '@/action';
import { ActionContext, ActionId } from '@/types/action';
import { MajorScene } from '@/types/state';

function createContext(opts: {
  action: ActionId;
  major: MajorScene | string;
  stamina?: number;
  money?: number;
  time?: string;
}): ActionContext {
  return {
    charactorState: {
      action: opts.action,
      location: { major: opts.major as any },
      stamina: opts.stamina ?? 100,
      money: opts.money ?? 0,
      dailyActionsDoneToday: [],
      async setAction() {},
      async setStamina() {},
      async changeStamina() {},
      async changeMoney() {},
      async markActionDoneToday() {},
      async clearDailyActions() {},
      log() {
        return {
          action: opts.action,
          location: { major: opts.major as any },
          stamina: opts.stamina ?? 100,
          money: opts.money ?? 0,
          dailyActionsDoneToday: [],
        };
      },
    },
    worldState: {
      time: dayjs(opts.time ?? '2025-01-01T08:00:00'),
      log() {
        return {
          time: dayjs(opts.time ?? '2025-01-01T08:00:00'),
        };
      },
      async updateTime() {},
      async reset() {},
    },
  };
}

describe('getActionList', () => {
  it('returns only Wake_Up when current action is Sleep', () => {
    const context = createContext({ action: ActionId.Sleep, major: MajorScene.Home });
    const list = getActionList(context);
    expect(list.length).toBe(1);
    expect(list[0].action).toBe(ActionId.Wake_Up);
  });

  it('Home morning weekday 08:00 returns breakfast, go to school, idle', () => {
    const context = createContext({ action: ActionId.Idle, major: MajorScene.Home, time: '2025-01-01T08:00:00' });
    const list = getActionList(context).map(a => a.action);
    expect(list).toEqual([ActionId.Eat_Breakfast, ActionId.Go_To_School, ActionId.Idle]);
  });

  it('Home noon weekday 12:00 returns idle, eat lunch', () => {
    const context = createContext({ action: ActionId.Idle, major: MajorScene.Home, time: '2025-01-01T12:00:00' });
    const list = getActionList(context).map(a => a.action);
    expect(list).toEqual([ActionId.Idle, ActionId.Eat_Lunch]);
  });

  it('Home evening weekday 19:00 returns eat dinner, idle', () => {
    const context = createContext({ action: ActionId.Idle, major: MajorScene.Home, time: '2025-01-01T19:00:00' });
    const list = getActionList(context).map(a => a.action);
    expect(list).toEqual([ActionId.Eat_Dinner, ActionId.Idle]);
  });

  it('Home night weekday 23:00 returns sleep, idle', () => {
    const context = createContext({ action: ActionId.Idle, major: MajorScene.Home, time: '2025-01-01T23:00:00' });
    const list = getActionList(context).map(a => a.action);
    expect(list).toEqual([ActionId.Sleep, ActionId.Idle]);
  });

  it('Home weekend afternoon Sunday 15:00 returns stay at home, idle', () => {
    const context = createContext({ action: ActionId.Idle, major: MajorScene.Home, time: '2025-01-05T15:00:00' });
    const list = getActionList(context).map(a => a.action);
    expect(list).toEqual([ActionId.Stay_At_Home, ActionId.Idle]);
  });

  it('Home weekend morning Sunday 08:00 returns breakfast, go to school, stay at home, idle', () => {
    const context = createContext({ action: ActionId.Idle, major: MajorScene.Home, time: '2025-01-05T08:00:00' });
    const list = getActionList(context).map(a => a.action);
    expect(list).toEqual([ActionId.Eat_Breakfast, ActionId.Stay_At_Home, ActionId.Idle]);
  });

  it('Home weekend noon Sunday 12:00 returns stay at home, idle, eat lunch', () => {
    const context = createContext({ action: ActionId.Idle, major: MajorScene.Home, time: '2025-01-05T12:00:00' });
    const list = getActionList(context).map(a => a.action);
    expect(list).toEqual([ActionId.Stay_At_Home, ActionId.Idle, ActionId.Eat_Lunch]);
  });

  it('Home weekend evening Sunday 19:00 returns eat dinner, stay at home, idle', () => {
    const context = createContext({ action: ActionId.Idle, major: MajorScene.Home, time: '2025-01-05T19:00:00' });
    const list = getActionList(context).map(a => a.action);
    expect(list).toEqual([ActionId.Eat_Dinner, ActionId.Stay_At_Home, ActionId.Idle]);
  });

  it('Home weekend night Sunday 23:00 returns sleep, stay at home, idle', () => {
    const context = createContext({ action: ActionId.Idle, major: MajorScene.Home, time: '2025-01-05T23:00:00' });
    const list = getActionList(context).map(a => a.action);
    expect(list).toEqual([ActionId.Stay_At_Home, ActionId.Sleep, ActionId.Idle]);
  });
  it('School weekday 10:00 returns study, idle', () => {
    const context = createContext({
      action: ActionId.Idle,
      major: MajorScene.School,
      time: '2025-01-01T10:00:00',
      stamina: 20,
    });
    const list = getActionList(context).map(a => a.action);
    expect(list).toEqual([ActionId.Study_At_School, ActionId.Idle]);
  });

  it('School weekday 17:00 returns go home, idle', () => {
    const context = createContext({
      action: ActionId.Idle,
      major: MajorScene.School,
      time: '2025-01-01T17:00:00',
      stamina: 20,
    });
    const list = getActionList(context).map(a => a.action);
    expect(list).toEqual([ActionId.Go_Home_From_School, ActionId.Idle]);
  });

  it('Unknown location noon 12:00 returns anywhere filtered: idle, eat lunch', () => {
    const context = createContext({ action: ActionId.Idle, major: 'unknown', time: '2025-01-01T12:00:00' });
    const list = getActionList(context).map(a => a.action);
    expect(list).toEqual([ActionId.Idle, ActionId.Eat_Lunch]);
  });
});

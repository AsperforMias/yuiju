import dayjs from "dayjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "dotenv/config";
import { connectDB } from "@yuiju/utils";

process.env.NODE_ENV = "development";

vi.mock("@/llm/agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/llm/agent")>();
  return {
    ...actual,
    chooseActionAgent: vi.fn(),
  };
});

vi.mock("@/utils/logger", () => {
  return {
    logger: {
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    },
  };
});

import { tick } from "@/engine/tick";
import { chooseActionAgent } from "@/llm/agent";
import { characterState } from "@/state/character-state";
import { worldState } from "@/state/world-state";
import { ActionId } from "@/types/action";

const chooseActionMock = chooseActionAgent as any;

async function resetState(opts: {
  locationMajor: "home" | "school";
  stamina?: number;
  money?: number;
  action?: ActionId;
  timeISO: string;
}) {
  await characterState.setAction(opts.action ?? ActionId.Idle);
  await characterState.setStamina(typeof opts.stamina === "number" ? opts.stamina : 100);
  if (typeof opts.money === "number") {
    await characterState.changeMoney(opts.money - characterState.money);
  } else {
    await characterState.changeMoney(-characterState.money);
  }
  (characterState.location as any).major = opts.locationMajor;
  await characterState.clearDailyActions();
  await worldState.updateTime(dayjs(opts.timeISO));
}

describe("tick()", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await connectDB();
    // Mock updateTime to prevent resetting to system time during tick
    vi.spyOn(worldState, "updateTime").mockImplementation(async (newTime) => {
      if (newTime) {
        worldState.time = newTime;
      }
    });
  });

  it("执行 Eat_Lunch：更新体力与每日记录，返回20分钟", async () => {
    await resetState({
      locationMajor: "home",
      stamina: 40,
      action: ActionId.Idle,
      timeISO: "2025-01-01T12:00:00",
    });
    chooseActionMock.mockResolvedValue({
      action: ActionId.Eat_Lunch,
      reason: "午餐时间到了",
    });

    const result = await tick({});

    expect(characterState.action).toBe(ActionId.Eat_Lunch);
    expect(characterState.stamina).toBe(90);
    expect(characterState.dailyActionsDoneToday.includes(ActionId.Eat_Lunch)).toBe(true);
    expect(result.nextTickInMinutes).toBe(20);
  });

  it("执行 Go_To_School：体力-10，返回30分钟", async () => {
    await resetState({
      locationMajor: "home",
      stamina: 60,
      action: ActionId.Idle,
      timeISO: "2025-01-01T08:00:00",
    });
    chooseActionMock.mockResolvedValue({
      action: ActionId.Go_To_School,
      reason: "工作日早上应该去学校",
    });

    const result = await tick({});

    expect(characterState.action).toBe(ActionId.Go_To_School);
    expect(characterState.stamina).toBe(50);
    expect(result.nextTickInMinutes).toBe(30);
  });

  it("执行 Idle 且 LLM给出耗时：返回给定分钟数", async () => {
    await resetState({
      locationMajor: "school",
      stamina: 80,
      action: ActionId.Idle,
      timeISO: "2025-01-01T10:00:00",
    });
    chooseActionMock.mockResolvedValue({
      action: ActionId.Idle,
      reason: "短暂休息",
      durationMinute: 15,
    });

    const result = await tick({});

    expect(characterState.action).toBe(ActionId.Idle);
    expect(result.nextTickInMinutes).toBe(15);
  });

  it("LLM选择不可执行动作：返回 Idle 默认10分钟，不更改状态", async () => {
    await resetState({
      locationMajor: "school",
      stamina: 80,
      action: ActionId.Idle,
      timeISO: "2025-01-01T10:00:00",
    });
    chooseActionMock.mockResolvedValue({
      action: ActionId.Stay_At_Home,
      reason: "错误选择",
    });

    const result = await tick({});

    expect(characterState.action).toBe(ActionId.Idle);
    expect(result.nextTickInMinutes).toBe(10);
  });

  it("当前为 Sleep：预检查只给 Wake_Up，执行后体力设为20并清空每日记录，返回10分钟", async () => {
    await resetState({
      locationMajor: "home",
      stamina: 5,
      action: ActionId.Sleep,
      timeISO: "2025-01-01T08:00:00",
    });
    chooseActionMock.mockResolvedValue({
      action: ActionId.Wake_Up,
      reason: "起床时间",
    });

    const result = await tick({});

    expect(characterState.action).toBe(ActionId.Wake_Up);
    expect(characterState.stamina).toBe(20);
    expect(characterState.dailyActionsDoneToday.length).toBe(0);
    expect(result.nextTickInMinutes).toBe(10);
  });

  it("执行 Sleep：计算距离次日 7:30 的分钟数", async () => {
    // 22:00 -> 07:30 (+1 day) = 2 + 7.5 = 9.5 hours = 570 minutes
    await resetState({
      locationMajor: "home",
      stamina: 10,
      action: ActionId.Idle,
      timeISO: "2025-01-01T22:00:00",
    });
    chooseActionMock.mockResolvedValue({
      action: ActionId.Sleep,
      reason: "该睡觉了",
    });

    const result = await tick({});

    expect(characterState.action).toBe(ActionId.Sleep);
    expect(result.nextTickInMinutes).toBe(570);
  });

  it("执行 Sleep (凌晨)：计算距离当日 7:30 的分钟数", async () => {
    // 01:00 -> 07:30 = 6.5 hours = 390 minutes
    await resetState({
      locationMajor: "home",
      stamina: 10,
      action: ActionId.Idle,
      timeISO: "2025-01-02T01:00:00",
    });
    chooseActionMock.mockResolvedValue({
      action: ActionId.Sleep,
      reason: "太晚了",
    });

    const result = await tick({});

    expect(characterState.action).toBe(ActionId.Sleep);
    expect(result.nextTickInMinutes).toBe(390);
  });

  it("执行 Study_At_School (上午)：9点开始，持续到12点 (180分钟)", async () => {
    await resetState({
      locationMajor: "school",
      stamina: 80,
      action: ActionId.Idle,
      timeISO: "2025-01-01T09:00:00", // Wednesday
    });
    chooseActionMock.mockResolvedValue({
      action: ActionId.Study_At_School,
      reason: "开始上课",
    });

    const result = await tick({});

    expect(characterState.action).toBe(ActionId.Study_At_School);
    expect(result.nextTickInMinutes).toBe(180);
  });

  it("执行 Study_At_School (下午)：14点开始，持续到16点 (120分钟)", async () => {
    await resetState({
      locationMajor: "school",
      stamina: 80,
      action: ActionId.Idle,
      timeISO: "2025-01-01T14:00:00", // Wednesday
    });
    chooseActionMock.mockResolvedValue({
      action: ActionId.Study_At_School,
      reason: "下午课",
    });

    const result = await tick({});

    expect(characterState.action).toBe(ActionId.Study_At_School);
    expect(result.nextTickInMinutes).toBe(120);
  });

  it("非上课时间 (13:00)：Study_At_School 不可用，回退到 Idle", async () => {
    await resetState({
      locationMajor: "school",
      stamina: 80,
      action: ActionId.Idle,
      timeISO: "2025-01-01T13:00:00", // Wednesday
    });
    chooseActionMock.mockResolvedValue({
      action: ActionId.Study_At_School,
      reason: "想上课",
    });

    const result = await tick({});

    expect(characterState.action).toBe(ActionId.Idle);
    expect(result.nextTickInMinutes).toBe(10);
  });

  it("执行 Sleep_For_A_Little：耗时10分钟，不改变状态", async () => {
    await resetState({
      locationMajor: "home",
      stamina: 50,
      action: ActionId.Sleep,
      timeISO: "2025-01-01T07:30:00",
    });
    chooseActionMock.mockResolvedValue({
      action: ActionId.Sleep_For_A_Little,
      reason: "再睡一会",
    });

    const result = await tick({});

    expect(characterState.action).toBe(ActionId.Sleep);
    expect(result.nextTickInMinutes).toBe(10);
  });
});

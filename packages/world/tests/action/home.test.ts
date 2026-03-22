import dayjs from "dayjs";
import { ActionId } from "@yuiju/utils";
import { describe, expect, it, vi } from "vitest";

const generateDiaryForDateMock = vi.fn().mockResolvedValue(true);
const resolveDiaryDateForSleepMock = vi.fn(
  (date: Date) => new Date(dayjs(date).startOf("day").toISOString()),
);

vi.mock("@/diary", () => ({
  generateDiaryForDate: generateDiaryForDateMock,
  resolveDiaryDateForSleep: resolveDiaryDateForSleepMock,
}));

describe("home action", () => {
  it("Sleep executor 会异步调度当日日记生成", async () => {
    const { homeAction } = await import("../../src/action/home");
    const sleepAction = homeAction.find((item) => item.action === ActionId.Sleep);

    const setActionMock = vi.fn(async () => {});

    await sleepAction?.executor({
      characterState: {
        setAction: setActionMock,
      },
      worldState: {
        time: dayjs("2026-03-18T23:00:00+08:00"),
      },
    } as never);

    expect(setActionMock).toHaveBeenCalledWith(ActionId.Sleep);
    expect(resolveDiaryDateForSleepMock).toHaveBeenCalledTimes(1);
    expect(resolveDiaryDateForSleepMock).toHaveBeenCalledWith(new Date("2026-03-18T15:00:00.000Z"));
    expect(generateDiaryForDateMock).toHaveBeenCalledTimes(1);
    expect(generateDiaryForDateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        diaryDate: new Date("2026-03-17T16:00:00.000Z"),
        isDev: true,
      }),
    );
  });
});

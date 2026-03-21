import { ActionId } from "@yuiju/utils";
import { describe, expect, it, vi } from "vitest";

const generateDiaryForDateMock = vi.fn();

vi.mock("@/diary/generator", () => ({
  generateDiaryForDate: generateDiaryForDateMock,
}));

describe("diary trigger", () => {
  it("只有正式睡觉才会触发当日日记生成", async () => {
    generateDiaryForDateMock.mockResolvedValue(true);

    const { shouldGenerateDiaryAfterAction, triggerDiaryGenerationAfterAction } = await import(
      "@/diary/trigger"
    );

    expect(shouldGenerateDiaryAfterAction(ActionId.Sleep)).toBe(true);
    expect(shouldGenerateDiaryAfterAction(ActionId.Sleep_For_A_Little)).toBe(false);

    const sleepResult = await triggerDiaryGenerationAfterAction({
      action: ActionId.Sleep,
      happenedAt: new Date("2026-03-18T23:00:00+08:00"),
      isDev: true,
    });
    const napResult = await triggerDiaryGenerationAfterAction({
      action: ActionId.Sleep_For_A_Little,
      happenedAt: new Date("2026-03-18T23:00:00+08:00"),
      isDev: true,
    });

    expect(sleepResult).toBe(true);
    expect(napResult).toBe(false);
    expect(generateDiaryForDateMock).toHaveBeenCalledTimes(1);
    expect(generateDiaryForDateMock).toHaveBeenCalledWith(
      {
        diaryDate: new Date("2026-03-18T00:00:00.000+08:00"),
        isDev: true,
      },
      {},
    );
  });
});

import { ActionId } from "@yuiju/utils";
import dayjs from "dayjs";
import { generateDiaryForDate, type DiaryGeneratorDependencies } from "./generator";

export interface TriggerDiaryGenerationInput {
  action: ActionId;
  happenedAt: Date;
  isDev: boolean;
}

/**
 * 只有“正式睡觉”才会触发当天日记生成。
 */
export function shouldGenerateDiaryAfterAction(action: ActionId): boolean {
  return action === ActionId.Sleep;
}

/**
 * 在行为 episode 成功写入后，按规则尝试生成 Diary。
 */
export async function triggerDiaryGenerationAfterAction(
  input: TriggerDiaryGenerationInput,
  dependencies: DiaryGeneratorDependencies = {},
): Promise<boolean> {
  if (!shouldGenerateDiaryAfterAction(input.action)) {
    return false;
  }

  return await generateDiaryForDate(
    {
      diaryDate: dayjs(input.happenedAt).startOf("day").toDate(),
      isDev: input.isDev,
    },
    dependencies,
  );
}

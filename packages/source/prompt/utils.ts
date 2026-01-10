import { getTimeWithWeekday } from "@yuiju/utils";
import type { Dayjs } from "dayjs";

interface BehaviorParameter {
  /** 参数值，如："苹果"、"面包" */
  value: string;
  /** 数量，默认为 1 */
  quantity?: number;
}

export interface BehaviorRecord {
  /** 行为/事件类型 */
  behavior: string;
  /** 行为描述 */
  description: string;
  time: Dayjs;
  /** Agent 选择的行为参数 */
  parameters?: BehaviorParameter[];
}

export function generateRecentBehaviorPrompt(behaviorRecordList: BehaviorRecord[]) {
  if (!behaviorRecordList.length) {
    return "（无）";
  }

  return behaviorRecordList
    .map((item) => {
      const parameterList = item.parameters
        ?.map((parameter) => {
          return `${parameter.value + (parameter.quantity ?? 1)}个`;
        })
        .join("，");

      return `- [${item.behavior}] (时间 ${getTimeWithWeekday(item.time, "HH:mm")})：${item.description} (${parameterList ? "选择了：" + parameterList : ""})`;
    })
    .join("\n");
}

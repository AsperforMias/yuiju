import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/zh-cn";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { getYuijuConfig } from "./config";

dayjs.locale("zh-cn");
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * 按项目配置时区格式化时间。
 *
 * 说明：
 * - 项目内凡是给 LLM 或用户展示的本地时间，都应优先复用该函数；
 * - 时区统一来自 yuiju.config.ts，避免不同包各自读取或写死时区。
 */
export function formatProjectTime(input: Date | string | Dayjs, format: string): string {
  return dayjs(input).tz(getYuijuConfig().app.timezone).format(format);
}

/**
 *
 * Get formatted time with weekday
 */
export function getTimeWithWeekday(time?: Dayjs, format?: string) {
  const displayTime = time ?? dayjs();

  return `${displayTime.format(format || "YYYY-MM-DD HH:mm")} ${displayTime.format("dddd")}`;
}

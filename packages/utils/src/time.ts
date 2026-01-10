import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/zh-cn";

dayjs.locale("zh-cn");

/**
 *
 * Get formatted time with weekday
 */
export function getTimeWithWeekday(time?: Dayjs, format?: string) {
  const displayTime = time ?? dayjs();

  return `${displayTime.format(format || "YYYY-MM-DD HH:mm")} ${displayTime.format("dddd")}`;
}

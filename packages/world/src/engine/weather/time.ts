import { getYuijuConfig, type WeatherSnapshot } from "@yuiju/utils";
import dayjs, { type Dayjs } from "dayjs";
import { WEATHER_PERIOD_HOURS } from "./constants";

export interface WeatherPeriod {
  startAt: Dayjs;
  endAt: Dayjs;
  month: number;
  slotHour: 0 | 6 | 12 | 18;
}

const HOUR_IN_MS = 60 * 60 * 1000;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * 解析配置时区下的本地时间部件。
 *
 * 说明：
 * - 只在 weather 模块内部使用，不额外抽成项目级通用工具；
 * - 通过 Intl 读取 IANA 时区的年月日时分秒，避免在模块内写死固定偏移。
 */
function getZonedDateParts(input: Date) {
  const formatter = getTimeZoneFormatter(getProjectTimezone());
  const parts = formatter.formatToParts(input);

  const mapped = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number.parseInt(part.value, 10)]),
  );

  return {
    year: mapped.year,
    month: mapped.month,
    day: mapped.day,
    hour: mapped.hour,
    minute: mapped.minute,
    second: mapped.second,
  };
}

function getTimeZoneFormatter(timezone: string): Intl.DateTimeFormat {
  const cachedFormatter = formatterCache.get(timezone);
  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  formatterCache.set(timezone, formatter);
  return formatter;
}

function getProjectTimezone(): string {
  return getYuijuConfig().app.timezone;
}

/**
 * 把“配置时区下的本地时间”换算成真实 UTC 时间戳。
 *
 * 说明：
 * - 这里使用小步迭代收敛 offset，兼容存在 DST 的时区；
 * - 当前项目默认是 Asia/Shanghai，但实现不再把逻辑写死到上海。
 */
function resolveZonedDateTimestamp(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
}) {
  const timezone = getProjectTimezone();
  const naiveUtcTimestamp = Date.UTC(input.year, input.month - 1, input.day, input.hour, 0, 0, 0);
  let resolvedTimestamp = naiveUtcTimestamp;

  for (let index = 0; index < 3; index += 1) {
    const offsetMs = getTimeZoneOffsetMs(new Date(resolvedTimestamp), timezone);
    const nextTimestamp = naiveUtcTimestamp - offsetMs;

    if (nextTimestamp === resolvedTimestamp) {
      break;
    }

    resolvedTimestamp = nextTimestamp;
  }

  return resolvedTimestamp;
}

function getTimeZoneOffsetMs(input: Date, timezone: string): number {
  const zonedParts = getZonedDateParts(input);
  const zonedTimestamp = Date.UTC(
    zonedParts.year,
    zonedParts.month - 1,
    zonedParts.day,
    zonedParts.hour,
    zonedParts.minute,
    zonedParts.second,
    0,
  );

  return zonedTimestamp - input.getTime();
}

/**
 * 解析给定时间所属的天气时间片。
 */
export function resolveWeatherPeriod(input: Date | Dayjs | string): WeatherPeriod {
  const baseTime = dayjs(input);
  const zonedParts = getZonedDateParts(baseTime.toDate());
  const year = zonedParts.year;
  const monthIndex = zonedParts.month - 1;
  const dayOfMonth = zonedParts.day;
  const hour = zonedParts.hour;
  const slotHour = (Math.floor(hour / WEATHER_PERIOD_HOURS) * WEATHER_PERIOD_HOURS) as
    | 0
    | 6
    | 12
    | 18;

  const startTimestamp = resolveZonedDateTimestamp({
    year,
    month: monthIndex + 1,
    day: dayOfMonth,
    hour: slotHour,
  });
  const endTimestamp = startTimestamp + WEATHER_PERIOD_HOURS * HOUR_IN_MS;

  return {
    startAt: dayjs(startTimestamp),
    endAt: dayjs(endTimestamp),
    month: monthIndex + 1,
    slotHour,
  };
}

/**
 * 判断天气快照是否仍覆盖当前时间点。
 */
export function isWeatherSnapshotActiveAt(
  snapshot: WeatherSnapshot,
  input: Date | Dayjs | string,
): boolean {
  const currentTimestamp = dayjs(input).valueOf();
  const startTimestamp = dayjs(snapshot.periodStartAt).valueOf();
  const endTimestamp = dayjs(snapshot.periodEndAt).valueOf();

  return currentTimestamp >= startTimestamp && currentTimestamp < endTimestamp;
}

/**
 * 判断快照是否意外落在未来。
 */
export function isWeatherSnapshotInFuture(
  snapshot: WeatherSnapshot,
  input: Date | Dayjs | string,
): boolean {
  return dayjs(snapshot.periodStartAt).valueOf() > dayjs(input).valueOf();
}

/**
 * 解析下一时间片的开始时间。
 */
export function resolveNextWeatherPeriodStart(snapshot: WeatherSnapshot): Dayjs {
  return dayjs(snapshot.periodEndAt);
}

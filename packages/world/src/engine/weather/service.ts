import { emitMemoryEpisode, type IWorldState, isDev, type WeatherSnapshot } from "@yuiju/utils";
import { buildWeatherChangedEpisode } from "@/memory/episode-builder";
import { worldState } from "@/state/world-state";
import { logger } from "@/utils/logger";
import { WEATHER_PERIOD_HOURS } from "./constants";
import { generateWeatherSnapshot } from "./generator";
import {
  isWeatherSnapshotActiveAt,
  isWeatherSnapshotInFuture,
  resolveNextWeatherPeriodStart,
  resolveWeatherPeriod,
} from "./time";

export interface WeatherSyncResult {
  currentWeather: WeatherSnapshot;
  generatedPeriodCount: number;
  episodeCount: number;
  reusedCurrentPeriod: boolean;
}

interface SyncWeatherOptions {
  now?: Date;
  state?: Pick<IWorldState, "getWeather" | "setWeather">;
  emitEpisode?: typeof emitMemoryEpisode;
  isDev?: boolean;
}

let activeWeatherSync: Promise<WeatherSyncResult> | null = null;

/**
 * 校正并同步当前时间片天气。
 *
 * 说明：
 * - 启动校正与 cron 触发共用同一套逻辑；
 * - 通过模块级锁避免并发执行时重复补算、重复写 episode。
 */
export async function syncCurrentWeather(
  options: SyncWeatherOptions = {},
): Promise<WeatherSyncResult> {
  if (activeWeatherSync) {
    return activeWeatherSync;
  }

  activeWeatherSync = doSyncCurrentWeather(options).finally(() => {
    activeWeatherSync = null;
  });

  return activeWeatherSync;
}

async function doSyncCurrentWeather(options: SyncWeatherOptions): Promise<WeatherSyncResult> {
  const now = options.now ?? new Date();
  const state = options.state ?? worldState;
  const emitEpisode = options.emitEpisode ?? emitMemoryEpisode;
  const devFlag = options.isDev ?? isDev();
  const currentPeriod = resolveWeatherPeriod(now);

  let currentWeather = state.getWeather();
  if (currentWeather && isWeatherSnapshotActiveAt(currentWeather, now)) {
    logger.info("[weather] current weather is already valid", {
      weather: currentWeather,
    });
    return {
      currentWeather,
      generatedPeriodCount: 0,
      episodeCount: 0,
      reusedCurrentPeriod: true,
    };
  }

  if (currentWeather && isWeatherSnapshotInFuture(currentWeather, now)) {
    logger.warn("[weather] future weather snapshot detected, regenerate current period", {
      weather: currentWeather,
      now: now.toISOString(),
    });
    currentWeather = null;
  }

  const periodsToGenerate = buildPeriodsToGenerate(currentWeather, now);
  let previousWeather = currentWeather;
  let finalWeather: WeatherSnapshot | null = null;
  let episodeCount = 0;

  for (const period of periodsToGenerate) {
    const isCurrentPeriod = period.startAt.isSame(currentPeriod.startAt);
    const nextWeather = generateWeatherSnapshot({
      period,
      previousWeather,
      updatedAt: isCurrentPeriod ? now.toISOString() : period.startAt.toISOString(),
    });

    const weatherEpisode = buildWeatherChangedEpisode({
      before: previousWeather,
      after: nextWeather,
      isDev: devFlag,
    });
    if (weatherEpisode) {
      await emitEpisode(weatherEpisode);
      episodeCount += 1;
    }

    previousWeather = nextWeather;
    finalWeather = nextWeather;
  }

  if (!finalWeather) {
    finalWeather = generateWeatherSnapshot({
      period: currentPeriod,
      previousWeather: null,
      updatedAt: now.toISOString(),
    });
  }

  await state.setWeather(finalWeather);

  logger.info("[weather] synchronized current weather", {
    weather: finalWeather,
    generatedPeriodCount: periodsToGenerate.length,
    episodeCount,
  });

  return {
    currentWeather: finalWeather,
    generatedPeriodCount: periodsToGenerate.length,
    episodeCount,
    reusedCurrentPeriod: false,
  };
}

function buildPeriodsToGenerate(previousWeather: WeatherSnapshot | null, now: Date) {
  const currentPeriod = resolveWeatherPeriod(now);

  if (!previousWeather) {
    return [currentPeriod];
  }

  const periods: ReturnType<typeof resolveWeatherPeriod>[] = [];
  let nextPeriodStart = resolveNextWeatherPeriodStart(previousWeather);

  while (nextPeriodStart.isBefore(currentPeriod.endAt)) {
    periods.push(resolveWeatherPeriod(nextPeriodStart));
    nextPeriodStart = nextPeriodStart.add(WEATHER_PERIOD_HOURS, "hour");
  }

  if (periods.length === 0) {
    periods.push(currentPeriod);
  }

  return periods;
}

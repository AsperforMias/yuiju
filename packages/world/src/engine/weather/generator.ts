import { createHash } from "node:crypto";
import type { TemperatureLevel, WeatherSnapshot, WeatherType } from "@yuiju/utils";
import {
  MONTHLY_TEMPERATURE_WEIGHTS,
  MONTHLY_WEATHER_WEIGHTS,
  WEATHER_INERTIA_ADJUSTMENTS,
} from "./constants";
import type { WeatherPeriod } from "./time";

type Season = "spring" | "summer" | "autumn" | "winter";
type Rng = () => number;
type WeightedMap<TValue extends string> = Record<TValue, number>;

export interface GenerateWeatherSnapshotInput {
  period: WeatherPeriod;
  previousWeather: WeatherSnapshot | null;
  updatedAt: string;
}

/**
 * 生成指定时间片的天气快照。
 *
 * 说明：
 * - 生成过程完全由“时间片 + 上一片天气”决定，保证补算时可复现；
 * - 当前函数只负责纯计算，不涉及任何状态写入与副作用。
 */
export function generateWeatherSnapshot(input: GenerateWeatherSnapshotInput): WeatherSnapshot {
  const rng = createDeterministicRng(
    buildWeatherSeed(input.period.startAt.toISOString(), input.previousWeather),
  );
  const season = resolveSeason(input.period.month);
  const weatherType = generateWeatherType(season, input.previousWeather?.type, rng);
  const temperatureLevel = generateTemperatureLevel(input.period.month, weatherType, rng);

  return {
    type: weatherType,
    temperatureLevel,
    periodStartAt: input.period.startAt.toISOString(),
    periodEndAt: input.period.endAt.toISOString(),
    updatedAt: input.updatedAt,
  };
}

function resolveSeason(month: number): Season {
  if (month >= 3 && month <= 5) {
    return "spring";
  }

  if (month >= 6 && month <= 8) {
    return "summer";
  }

  if (month >= 9 && month <= 11) {
    return "autumn";
  }

  return "winter";
}

function generateWeatherType(
  season: Season,
  previousType: WeatherType | undefined,
  rng: Rng,
): WeatherType {
  const weightedWeatherMap = { ...MONTHLY_WEATHER_WEIGHTS[season] };

  if (previousType) {
    for (const currentType of Object.keys(weightedWeatherMap) as WeatherType[]) {
      const transitionKey = `${previousType}->${currentType}`;
      weightedWeatherMap[currentType] = Math.max(
        0,
        weightedWeatherMap[currentType] + (WEATHER_INERTIA_ADJUSTMENTS[transitionKey] ?? 0),
      );
    }
  }

  return pickWeightedValue(weightedWeatherMap, rng);
}

function generateTemperatureLevel(
  month: number,
  weatherType: WeatherType,
  rng: Rng,
): TemperatureLevel {
  if (weatherType === "雪") {
    return "寒冷";
  }

  const season = resolveSeason(month);
  const weightedTemperatureMap = { ...MONTHLY_TEMPERATURE_WEIGHTS[season] };

  if (weatherType === "雨") {
    weightedTemperatureMap.温暖 = 0;
  }

  if (season === "summer" && weatherType === "晴") {
    weightedTemperatureMap.温暖 += 25;
    weightedTemperatureMap.寒冷 = 0;
  }

  if (season === "winter" && weatherType === "晴") {
    weightedTemperatureMap.舒适 = 0;
    weightedTemperatureMap.温暖 = 0;
  }

  return pickWeightedValue(weightedTemperatureMap, rng);
}

function pickWeightedValue<TValue extends string>(
  weightedMap: WeightedMap<TValue>,
  rng: Rng,
): TValue {
  const normalizedEntries: Array<[TValue, number]> = Object.entries(weightedMap).map(
    ([value, weight]) => [value as TValue, Math.max(0, Number(weight))],
  );
  const totalWeight = normalizedEntries.reduce((sum, [, weight]) => sum + weight, 0);

  if (totalWeight <= 0) {
    return normalizedEntries[0][0];
  }

  let cursor = rng() * totalWeight;

  for (const [value, weight] of normalizedEntries) {
    cursor -= weight;
    if (cursor < 0) {
      return value;
    }
  }

  return normalizedEntries[normalizedEntries.length - 1][0];
}

function buildWeatherSeed(periodStartAt: string, previousWeather: WeatherSnapshot | null): string {
  return [
    periodStartAt,
    previousWeather?.periodStartAt ?? "none",
    previousWeather?.type ?? "none",
    previousWeather?.temperatureLevel ?? "none",
  ].join("|");
}

/**
 * 基于稳定 seed 生成伪随机数。
 *
 * 说明：
 * - 使用哈希把任意字符串收敛成 uint32 初始种子；
 * - mulberry32 足够轻量，且对当前天气权重抽样场景已经足够稳定。
 */
function createDeterministicRng(seed: string): Rng {
  const hash = createHash("sha256").update(seed).digest("hex");
  let state = Number.parseInt(hash.slice(0, 8), 16) || 1;

  return () => {
    state += 0x6d2b79f5;
    let temp = state;
    temp = Math.imul(temp ^ (temp >>> 15), temp | 1);
    temp ^= temp + Math.imul(temp ^ (temp >>> 7), temp | 61);
    return ((temp ^ (temp >>> 14)) >>> 0) / 4294967296;
  };
}

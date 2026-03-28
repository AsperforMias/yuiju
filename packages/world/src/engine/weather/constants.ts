import type { TemperatureLevel, WeatherType } from "@yuiju/utils";

/**
 * 天气定时任务的 cron 表达式。
 *
 * 说明：
 * - 每天固定在 00:00 / 06:00 / 12:00 / 18:00 执行；
 * - 第一版世界时间与真实时间一致，因此直接按真实时钟调度。
 */
export const WEATHER_CRON_EXPRESSION = "0 0,6,12,18 * * *";

/**
 * 单个天气时间片长度（小时）。
 */
export const WEATHER_PERIOD_HOURS = 6;

type WeightedWeatherMap = Record<WeatherType, number>;
type WeightedTemperatureMap = Record<TemperatureLevel, number>;

/**
 * 不同季节的基础天气权重。
 */
export const MONTHLY_WEATHER_WEIGHTS: Record<
  "spring" | "summer" | "autumn" | "winter",
  WeightedWeatherMap
> = {
  spring: { 晴: 35, 阴: 30, 雨: 25, 雪: 10 },
  summer: { 晴: 35, 阴: 20, 雨: 45, 雪: 0 },
  autumn: { 晴: 45, 阴: 30, 雨: 20, 雪: 5 },
  winter: { 晴: 25, 阴: 30, 雨: 10, 雪: 35 },
};

/**
 * 不同季节的基础体感温度权重。
 */
export const MONTHLY_TEMPERATURE_WEIGHTS: Record<
  "spring" | "summer" | "autumn" | "winter",
  WeightedTemperatureMap
> = {
  spring: { 寒冷: 15, 清凉: 45, 舒适: 35, 温暖: 5 },
  summer: { 寒冷: 0, 清凉: 10, 舒适: 35, 温暖: 55 },
  autumn: { 寒冷: 10, 清凉: 35, 舒适: 45, 温暖: 10 },
  winter: { 寒冷: 60, 清凉: 30, 舒适: 10, 温暖: 0 },
};

/**
 * 天气惯性修正表。
 *
 * 说明：
 * - key 格式为 “上一天气->当前候选天气”；
 * - 未显式声明的组合默认修正为 0。
 */
export const WEATHER_INERTIA_ADJUSTMENTS: Record<string, number> = {
  "晴->晴": 25,
  "阴->阴": 25,
  "雨->雨": 25,
  "雪->雪": 25,
  "晴->阴": 12,
  "阴->晴": 12,
  "阴->雨": 12,
  "雨->阴": 12,
  "雨->雪": 8,
  "雪->雨": 8,
  "阴->雪": 8,
  "雪->阴": 8,
  "晴->雨": -8,
  "雨->晴": -8,
  "晴->雪": -20,
  "雪->晴": -20,
};

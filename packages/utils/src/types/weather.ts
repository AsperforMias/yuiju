/**
 * 当前支持的天气类型。
 *
 * 说明：
 * - 第一版先保持精简枚举，便于稳定生成和展示；
 * - 后续若扩展多云/雷雨等类型，可在此处继续扩展并补充生成规则。
 */
export const WEATHER_TYPES = ["晴", "阴", "雨", "雪"] as const;

/**
 * 天气类型联合。
 */
export type WeatherType = (typeof WEATHER_TYPES)[number];

/**
 * 当前支持的体感温度等级。
 *
 * 说明：
 * - 该等级用于描述“氛围温度”，而不是精确气温；
 * - 第一版只承担世界背景展示和记忆记录职责。
 */
export const TEMPERATURE_LEVELS = ["寒冷", "清凉", "舒适", "温暖"] as const;

/**
 * 体感温度等级联合。
 */
export type TemperatureLevel = (typeof TEMPERATURE_LEVELS)[number];

/**
 * 当前天气快照。
 *
 * 说明：
 * - periodStartAt / periodEndAt 用于标识该快照对应的 6 小时时间片；
 * - updatedAt 表示最近一次写入当前快照的时间，方便跨服务消费时判断新鲜度。
 */
export interface WeatherSnapshot {
  type: WeatherType;
  temperatureLevel: TemperatureLevel;
  periodStartAt: string;
  periodEndAt: string;
  updatedAt: string;
}

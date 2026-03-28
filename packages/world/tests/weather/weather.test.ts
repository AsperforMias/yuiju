import type { MemoryEpisodeWriteInput, WeatherSnapshot } from "@yuiju/utils";
import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import { buildHomeWorldPayload } from "../../../web/app/api/nodejs/[[...route]]/home";
import { generateWeatherSnapshot } from "../../src/engine/weather/generator";
import { syncCurrentWeather } from "../../src/engine/weather/service";
import { resolveWeatherPeriod } from "../../src/engine/weather/time";

class MockWeatherState {
  public weather: WeatherSnapshot | null;

  constructor(weather: WeatherSnapshot | null) {
    this.weather = weather;
  }

  getWeather() {
    return this.weather;
  }

  async setWeather(snapshot: WeatherSnapshot) {
    this.weather = snapshot;
  }
}

describe("weather time", () => {
  it("05:59 应落在 00:00-06:00 时间片", () => {
    const period = resolveWeatherPeriod("2026-03-28T05:59:00+08:00");

    expect(period.startAt.toISOString()).toBe("2026-03-27T16:00:00.000Z");
    expect(period.endAt.toISOString()).toBe("2026-03-27T22:00:00.000Z");
  });

  it("06:00 应落在 06:00-12:00 时间片", () => {
    const period = resolveWeatherPeriod("2026-03-28T06:00:00+08:00");

    expect(period.startAt.toISOString()).toBe("2026-03-27T22:00:00.000Z");
    expect(period.endAt.toISOString()).toBe("2026-03-28T04:00:00.000Z");
  });
});

describe("weather generator", () => {
  it("同一输入应生成完全一致的天气结果", () => {
    const period = resolveWeatherPeriod("2026-04-01T12:00:00+08:00");
    const previousWeather = generateWeatherSnapshot({
      period: resolveWeatherPeriod("2026-04-01T06:00:00+08:00"),
      previousWeather: null,
      updatedAt: "2026-04-01T06:00:00+08:00",
    });

    const first = generateWeatherSnapshot({
      period,
      previousWeather,
      updatedAt: "2026-04-01T12:00:00+08:00",
    });
    const second = generateWeatherSnapshot({
      period,
      previousWeather,
      updatedAt: "2026-04-01T12:00:00+08:00",
    });

    expect(first).toEqual(second);
  });

  it("雪天一定为寒冷", () => {
    let matchedSnowWeather: WeatherSnapshot | null = null;

    for (let index = 0; index < 240; index += 1) {
      const candidate = generateWeatherSnapshot({
        period: resolveWeatherPeriod(dayjs("2026-12-01T00:00:00+08:00").add(index * 6, "hour")),
        previousWeather: null,
        updatedAt: "2026-12-01T00:00:00+08:00",
      });
      if (candidate.type === "雪") {
        matchedSnowWeather = candidate;
        break;
      }
    }

    expect(matchedSnowWeather).not.toBeNull();
    expect(matchedSnowWeather?.temperatureLevel).toBe("寒冷");
  });

  it("雨天不会生成温暖体感", () => {
    let matchedRainWeather: WeatherSnapshot | null = null;

    for (let index = 0; index < 240; index += 1) {
      const candidate = generateWeatherSnapshot({
        period: resolveWeatherPeriod(dayjs("2026-06-01T00:00:00+08:00").add(index * 6, "hour")),
        previousWeather: null,
        updatedAt: "2026-06-01T00:00:00+08:00",
      });
      if (candidate.type === "雨") {
        matchedRainWeather = candidate;
        break;
      }
    }

    expect(matchedRainWeather).not.toBeNull();
    expect(matchedRainWeather?.temperatureLevel).not.toBe("温暖");
  });
});

describe("weather sync", () => {
  it("首次启动且无天气时，应生成当前有效快照", async () => {
    const state = new MockWeatherState(null);
    const emittedEpisodes: MemoryEpisodeWriteInput[] = [];

    const result = await syncCurrentWeather({
      now: new Date("2026-03-28T13:20:00+08:00"),
      state,
      emitEpisode: async (episode) => {
        emittedEpisodes.push(episode);
        return "episode_1";
      },
      isDev: true,
    });

    expect(result.reusedCurrentPeriod).toBe(false);
    expect(result.generatedPeriodCount).toBe(1);
    expect(result.episodeCount).toBe(0);
    expect(emittedEpisodes).toHaveLength(0);
    expect(state.weather).not.toBeNull();
    expect(state.weather?.periodStartAt).toBe("2026-03-28T04:00:00.000Z");
    expect(state.weather?.periodEndAt).toBe("2026-03-28T10:00:00.000Z");
  });

  it("当前时间片天气仍有效时，不应重复生成或写 episode", async () => {
    const currentWeather = generateWeatherSnapshot({
      period: resolveWeatherPeriod("2026-03-28T13:20:00+08:00"),
      previousWeather: null,
      updatedAt: "2026-03-28T13:20:00+08:00",
    });
    const state = new MockWeatherState(currentWeather);
    const emittedEpisodes: MemoryEpisodeWriteInput[] = [];

    const result = await syncCurrentWeather({
      now: new Date("2026-03-28T15:00:00+08:00"),
      state,
      emitEpisode: async (episode) => {
        emittedEpisodes.push(episode);
        return "episode_1";
      },
      isDev: true,
    });

    expect(result.reusedCurrentPeriod).toBe(true);
    expect(result.generatedPeriodCount).toBe(0);
    expect(result.episodeCount).toBe(0);
    expect(emittedEpisodes).toHaveLength(0);
    expect(state.weather).toEqual(currentWeather);
  });

  it("停机跨多个时间片时，应逐片补算并只在变化时写天气 episode", async () => {
    const initialWeather = generateWeatherSnapshot({
      period: resolveWeatherPeriod("2026-03-28T00:00:00+08:00"),
      previousWeather: null,
      updatedAt: "2026-03-28T00:00:00+08:00",
    });
    const state = new MockWeatherState(initialWeather);
    const emittedEpisodes: MemoryEpisodeWriteInput[] = [];
    const now = new Date("2026-03-28T19:00:00+08:00");

    const result = await syncCurrentWeather({
      now,
      state,
      emitEpisode: async (episode) => {
        emittedEpisodes.push(episode);
        return `episode_${emittedEpisodes.length}`;
      },
      isDev: true,
    });

    const expectedPeriods = [
      resolveWeatherPeriod("2026-03-28T06:00:00+08:00"),
      resolveWeatherPeriod("2026-03-28T12:00:00+08:00"),
      resolveWeatherPeriod("2026-03-28T18:00:00+08:00"),
    ];

    let expectedEpisodeCount = 0;
    let previousWeather = initialWeather;
    let expectedFinalWeather = initialWeather;

    for (const period of expectedPeriods) {
      const nextWeather = generateWeatherSnapshot({
        period,
        previousWeather,
        updatedAt: period.startAt.isSame(resolveWeatherPeriod(now).startAt)
          ? now.toISOString()
          : period.startAt.toISOString(),
      });

      if (
        previousWeather.type !== nextWeather.type ||
        previousWeather.temperatureLevel !== nextWeather.temperatureLevel
      ) {
        expectedEpisodeCount += 1;
      }

      previousWeather = nextWeather;
      expectedFinalWeather = nextWeather;
    }

    expect(result.generatedPeriodCount).toBe(3);
    expect(result.episodeCount).toBe(expectedEpisodeCount);
    expect(emittedEpisodes).toHaveLength(expectedEpisodeCount);
    expect(emittedEpisodes.every((episode) => episode.type === "weather_changed")).toBe(true);
    expect(emittedEpisodes.every((episode) => episode.extractionStatus === "skipped")).toBe(true);
    expect(state.weather).toEqual(expectedFinalWeather);
    expect(state.weather?.periodStartAt).toBe("2026-03-28T10:00:00.000Z");
  });
});

describe("home summary payload", () => {
  it("应正确序列化天气字段", () => {
    const payload = buildHomeWorldPayload({
      time: dayjs("2026-03-28T19:00:00+08:00"),
      weather: {
        type: "阴",
        temperatureLevel: "清凉",
        periodStartAt: "2026-03-28T10:00:00.000Z",
        periodEndAt: "2026-03-28T16:00:00.000Z",
        updatedAt: "2026-03-28T11:00:00.000Z",
      },
    });

    expect(payload).toEqual({
      time: "2026-03-28 19:00",
      weather: {
        type: "阴",
        temperatureLevel: "清凉",
        periodStartAt: "2026-03-28T10:00:00.000Z",
        periodEndAt: "2026-03-28T16:00:00.000Z",
        updatedAt: "2026-03-28T11:00:00.000Z",
      },
    });
  });
});

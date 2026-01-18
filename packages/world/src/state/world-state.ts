import {
  getRedis,
  type IWorldState,
  initWorldStateData,
  REDIS_KEY_WORLD_STATE,
  type WorldStateData,
} from "@yuiju/utils";
import dayjs, { type Dayjs } from "dayjs";
import { cloneDeep } from "lodash-es";

export class WorldState implements IWorldState {
  public time: Dayjs = dayjs();

  private static instance: WorldState | null = null;

  static getInstance() {
    if (!WorldState.instance) WorldState.instance = new WorldState();
    return WorldState.instance;
  }

  async load() {
    const data = await initWorldStateData();
    this.time = data.time;
  }

  async save() {
    const redis = getRedis();
    await redis.hset(REDIS_KEY_WORLD_STATE, "time", this.time.toISOString());
  }

  public async updateTime(newTime?: Dayjs) {
    this.time = newTime || dayjs();
    await this.save();
  }

  public async reset() {
    this.time = dayjs();
    await this.save();
  }

  public log(): WorldStateData {
    return cloneDeep({
      time: this.time,
    });
  }
}

export const worldState = WorldState.getInstance();

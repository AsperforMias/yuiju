import { IWorldState, WorldStateData } from '@yuiju/utils';
import { REDIS_KEY_WORLD_STATE, getRedis } from '@yuiju/utils';
import dayjs, { Dayjs } from 'dayjs';
import { cloneDeep } from 'lodash-es';

export class WorldState implements IWorldState {
  public time: Dayjs = dayjs();

  private static instance: WorldState | null = null;

  static getInstance() {
    if (!WorldState.instance) WorldState.instance = new WorldState();
    return WorldState.instance;
  }

  async load() {
    const redis = getRedis();
    const timeStr = await redis.hget(REDIS_KEY_WORLD_STATE, 'time');
    if (timeStr) {
      this.time = dayjs(timeStr);
    } else {
      // 初始化
      await this.save();
    }
  }

  async save() {
    const redis = getRedis();
    await redis.hset(REDIS_KEY_WORLD_STATE, 'time', this.time.toISOString());
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

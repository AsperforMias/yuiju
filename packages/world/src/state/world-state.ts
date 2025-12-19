import { IWorldState, WorldStateData } from '@/types/state';
import { getRedis } from '@/db/redis';
import dayjs, { Dayjs } from 'dayjs';
import { cloneDeep } from 'lodash-es';

const WORLD_STATE_KEY = 'yuiju:world:state';

export class WorldState implements IWorldState {
  public time: Dayjs = dayjs();

  private static instance: WorldState | null = null;

  static getInstance() {
    if (!WorldState.instance) WorldState.instance = new WorldState();
    return WorldState.instance;
  }

  async load() {
    const redis = getRedis();
    const timeStr = await redis.hget(WORLD_STATE_KEY, 'time');
    if (timeStr) {
      this.time = dayjs(timeStr);
    } else {
      // 初始化
      await this.save();
    }
  }

  async save() {
    const redis = getRedis();
    await redis.hset(WORLD_STATE_KEY, 'time', this.time.toISOString());
  }

  public async updateTime(newTime?: Dayjs) {
    this.time = newTime || dayjs();
    await getRedis().hset(WORLD_STATE_KEY, 'time', this.time.toISOString());
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

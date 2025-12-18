import { IWorldState, WorldStateData } from '@/types/state';
import dayjs, { Dayjs } from 'dayjs';
import { cloneDeep } from 'lodash-es';

export class WorldState implements IWorldState {
  public time: Dayjs = dayjs();

  private static instance: WorldState | null = null;

  static getInstance() {
    if (!WorldState.instance) WorldState.instance = new WorldState();
    return WorldState.instance;
  }

  public updateTime(newTime?: Dayjs) {
    this.time = newTime || dayjs();
  }

  public reset() {
    this.time = dayjs();
  }

  public log(): WorldStateData {
    return cloneDeep({
      time: this.time,
    });
  }
}

export const worldState = WorldState.getInstance();

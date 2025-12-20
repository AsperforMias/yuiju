import { REDIS_KEY_CHARACTOR_STATE, REDIS_KEY_WORLD_STATE, getRedis } from '@yuiju/utils';
import dayjs, { Dayjs } from 'dayjs';

export interface CharactorStateData {
  action: string;
  location: any;
  stamina: number;
  money: number;
  dailyActionsDoneToday: string[];
}

export interface WorldStateData {
  time: Dayjs;
}

export const getCharactorState = async (): Promise<CharactorStateData | null> => {
  const redis = getRedis();
  const data = await redis.hgetall(REDIS_KEY_CHARACTOR_STATE);

  if (Object.keys(data).length === 0) {
    return null;
  }

  const state: CharactorStateData = {
    action: 'idle',
    location: { major: 'home' },
    stamina: 100,
    money: 0,
    dailyActionsDoneToday: [],
  };

  if (data.action) state.action = data.action;
  if (data.location) {
    try {
      state.location = JSON.parse(data.location);
    } catch (e) {
      console.error('Failed to parse location:', e);
    }
  }
  if (data.stamina) state.stamina = Number.parseInt(data.stamina, 10);
  if (data.money) state.money = Number.parseInt(data.money, 10);
  if (data.dailyActionsDoneToday) {
    try {
      state.dailyActionsDoneToday = JSON.parse(data.dailyActionsDoneToday);
    } catch (e) {
      console.error('Failed to parse daily actions:', e);
      state.dailyActionsDoneToday = [];
    }
  }

  return state;
};

export const getWorldState = async (): Promise<WorldStateData> => {
  const redis = getRedis();
  const timeStr = await redis.hget(REDIS_KEY_WORLD_STATE, 'time');
  
  if (timeStr) {
    return { time: dayjs(timeStr) };
  }
  
  // Default to current time if not found, similar to initialization logic
  return { time: dayjs() };
};

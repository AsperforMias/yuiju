import Redis from "ioredis";
import { isDev } from "./env";

let redis: Redis | null = null;

export const REDIS_KEY_CHARACTER_STATE = isDev
  ? "dev:yuiju:charactor:state"
  : "yuiju:charactor:state";

export const REDIS_KEY_WORLD_STATE = isDev ? "dev:yuiju:world:state" : "yuiju:world:state";

export const getRedis = () => {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  }
  return redis;
};

export const closeRedis = async () => {
  if (redis) {
    await redis.quit();
    redis = null;
  }
};

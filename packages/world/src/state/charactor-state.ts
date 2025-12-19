import { ActionId } from '@/types/action';
import { CharactorStateData, ICharactorState, Location, MajorScene } from '@/types/state';
import { getRedis } from '@/db/redis';
import { cloneDeep } from 'lodash-es';

const MAX_STAMINA = 100;
const KEY_PREFIX = 'yuiju:charactor:state';
const DAILY_ACTIONS_KEY = 'yuiju:charactor:daily_actions';

export class CharactorState implements ICharactorState {
  private static instance: CharactorState | null = null;

  public action: ActionId = ActionId.Idle;
  public location: Location = { major: MajorScene.Home };
  public stamina: number = 100;
  public money: number = 0;
  // 仅作内存缓存或只读展示，实际数据源为 Redis Set
  public dailyActionsDoneToday: ActionId[] = [];

  static getInstance() {
    if (!CharactorState.instance) CharactorState.instance = new CharactorState();
    return CharactorState.instance;
  }

  // 从 Redis 加载状态到内存（初始化时或定期同步）
  async load() {
    const redis = getRedis();
    const data = await redis.hgetall(KEY_PREFIX);
    if (Object.keys(data).length > 0) {
      if (data.action) this.action = data.action as ActionId;
      if (data.location) {
        try {
          this.location = JSON.parse(data.location);
        } catch (e) {
          console.error('Failed to parse location:', e);
        }
      }
      if (data.stamina) this.stamina = Number.parseInt(data.stamina, 10);
      if (data.money) this.money = Number.parseInt(data.money, 10);
    } else {
      // Redis 为空，写入初始值
      await this.save();
    }
    
    // 加载今日行为
    this.dailyActionsDoneToday = await redis.smembers(DAILY_ACTIONS_KEY) as ActionId[];
  }

  async save() {
    const redis = getRedis();
    await redis.hset(KEY_PREFIX, {
      action: this.action,
      location: JSON.stringify(this.location),
      stamina: this.stamina,
      money: this.money,
    });
  }

  async setAction(action: ActionId) {
    this.action = action;
    await getRedis().hset(KEY_PREFIX, 'action', action);
  }

  async setStamina(stamina: number) {
    this.stamina = Math.min(MAX_STAMINA, Math.max(0, stamina));
    await getRedis().hset(KEY_PREFIX, 'stamina', this.stamina);
  }

  async changeStamina(delta: number) {
    const stamina = Math.min(MAX_STAMINA, Math.max(0, this.stamina + delta));
    await this.setStamina(stamina);
  }

  async setMoney(money: number) {
    this.money = Math.max(0, money);
    await getRedis().hset(KEY_PREFIX, 'money', this.money);
  }

  async changeMoney(delta: number) {
    const changedMoney = this.money + delta;
    await this.setMoney(changedMoney);
  }

  async hasActionDoneToday(action: ActionId): Promise<boolean> {
    const redis = getRedis();
    const isMember = await redis.sismember(DAILY_ACTIONS_KEY, action);
    return isMember === 1;
  }

  async markActionDoneToday(action: ActionId): Promise<void> {
    const redis = getRedis();
    const result = await redis.sadd(DAILY_ACTIONS_KEY, action);
    
    if (result > 0) {
      // 如果是新添加的元素，更新内存
      this.dailyActionsDoneToday.push(action);
      
      // 设置过期时间为次日凌晨 0 点
      const ttl = await redis.ttl(DAILY_ACTIONS_KEY);
      if (ttl === -1) {
        // 未设置过期时间
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const expireSeconds = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
        await redis.expire(DAILY_ACTIONS_KEY, expireSeconds);
      }
    }
  }

  // 仅在调试或特殊重置时使用，一般由 TTL 自动处理
  async clearDailyActions(): Promise<void> {
    this.dailyActionsDoneToday = [];
    await getRedis().del(DAILY_ACTIONS_KEY);
  }

  public log(): CharactorStateData {
    return cloneDeep({
      action: this.action,
      location: this.location,
      stamina: this.stamina,
      money: this.money,
      dailyActionsDoneToday: this.dailyActionsDoneToday,
    });
  }
}

export const charactorState = CharactorState.getInstance();

import { ActionId } from '@/types/action';
import { CharactorStateData, ICharactorState, Location, MajorScene } from '@/types/state';
import { cloneDeep } from 'lodash-es';

const MAX_STAMINA = 100;

/**
 * 角色状态
 * 包含：位置、活动、金钱、物品、体力、饥饿值、情绪
 */
export class CharactorState implements ICharactorState {
  private static instance: CharactorState | null = null;

  public action: ActionId = ActionId.Idle;
  public location: Location = { major: MajorScene.Home };
  public stamina: number = 100;
  public money: number = 0;
  public dailyActionsDoneToday: ActionId[] = [];

  static getInstance() {
    if (!CharactorState.instance) CharactorState.instance = new CharactorState();
    return CharactorState.instance;
  }

  setAction(action: ActionId) {
    this.action = action;
  }

  setStamina(stamina: number) {
    this.stamina = Math.min(MAX_STAMINA, Math.max(0, stamina));
  }

  changeStamina(delta: number) {
    const stamina = Math.min(MAX_STAMINA, Math.max(0, this.stamina + delta));
    this.setStamina(stamina);
  }

  changeMoney(delta: number) {
    const changedMoney = (this.money += delta);

    this.money = Math.max(0, changedMoney);
  }

  hasActionDoneToday(action: ActionId): boolean {
    return this.dailyActionsDoneToday.includes(action);
  }

  markActionDoneToday(action: ActionId): void {
    if (!this.dailyActionsDoneToday.includes(action)) {
      this.dailyActionsDoneToday.push(action);
    }
  }

  clearDailyActions(): void {
    this.dailyActionsDoneToday = [];
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

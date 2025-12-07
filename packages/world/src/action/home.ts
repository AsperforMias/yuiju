import { ActionId, ActionMetadata } from '@/types/action';
import { isDoing } from './utils';

export const homeAction: ActionMetadata[] = [
  {
    action: ActionId.Wake_Up,
    description: '起床。耗时10分钟。',
    precondition(context) {
      return isDoing(context, ActionId.Sleep);
    },
    executor(context) {
      context.charactorState.setAction(ActionId.Wake_Up);
      context.charactorState.setStamina(20);
    },
    durationMin: 10,
  },
  {
    action: ActionId.Eat_Breakfast,
    description: '吃早餐。体力增加50点。耗时20分钟。',
    precondition(context) {
      // TODO：吃饭，只能吃一次
      return true;
    },
    executor(context) {
      context.charactorState.setAction(ActionId.Eat_Breakfast);
      context.charactorState.changeStamina(50);
    },
    durationMin: 20,
  },
  {
    action: ActionId.Go_To_School,
    description: '前往学校。体力消耗10点。耗时30分钟。',
    precondition(context) {
      return true;
    },
    executor(context) {
      context.charactorState.setAction(ActionId.Go_To_School);
      context.charactorState.changeStamina(-10);
    },
    durationMin: 30,
  },
  {
    action: ActionId.Eat_Dinner,
    description: '吃晚餐。体力增加50点。耗时20分钟。',
    precondition(context) {
      return isDoing(context, ActionId.Stay_At_Home);
    },
    executor(context) {
      context.charactorState.setAction(ActionId.Eat_Dinner);
      context.charactorState.changeStamina(50);
    },
    durationMin: 20,
  },
  {
    action: ActionId.Stay_At_Home,
    description: '待在家中。持续60分钟。',
    precondition(context) {
      return isDoing(context, ActionId.Go_To_School);
    },
    executor(context) {
      context.charactorState.setAction(ActionId.Stay_At_Home);
    },
    durationMin: 60,
  },
  {
    action: ActionId.Sleep,
    description: '睡觉。持续8个小时。',
    precondition(context) {
      return true;
    },
    executor(context) {
      context.charactorState.setAction(ActionId.Sleep);
    },
    durationMin: 60 * 8,
  },
];

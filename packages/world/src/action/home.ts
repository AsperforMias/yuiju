import { ActionId, ActionMetadata } from '@/types/action';
import { isAfternoon, isEvening, isMorning, isNight, isWeekday, isWeekend, notDoneToday } from './utils';
import { allTrue } from '@yuiju/utils';

export const homeAction: ActionMetadata[] = [
  {
    action: ActionId.Wake_Up,
    description: '起床。耗时10分钟。',
    // 已在 precheckAction 中处理
    precondition(context) {
      return false;
    },
    async executor(context) {
      await context.charactorState.setAction(ActionId.Wake_Up);
      await context.charactorState.setStamina(20);
      await context.charactorState.clearDailyActions();
    },
    durationMin: 10,
  },
  {
    action: ActionId.Eat_Breakfast,
    description: '吃早餐。体力增加50点。耗时20分钟。',
    precondition(context) {
      return allTrue([isMorning(context), () => notDoneToday(context, ActionId.Eat_Breakfast)]);
    },
    async executor(context) {
      await context.charactorState.setAction(ActionId.Eat_Breakfast);
      await context.charactorState.changeStamina(50);
      await context.charactorState.markActionDoneToday(ActionId.Eat_Breakfast);
    },
    durationMin: 20,
  },
  {
    action: ActionId.Go_To_School,
    description: '前往学校。体力消耗10点。耗时30分钟。',
    precondition(context) {
      return allTrue([isWeekday(context), isMorning(context)]);
    },
    async executor(context) {
      await context.charactorState.setAction(ActionId.Go_To_School);
      await context.charactorState.changeStamina(-10);
    },
    durationMin: 30,
  },
  {
    action: ActionId.Eat_Dinner,
    description: '吃晚餐。体力增加50点。耗时20分钟。',
    precondition(context) {
      return allTrue([isEvening(context), () => notDoneToday(context, ActionId.Eat_Dinner)]);
    },
    async executor(context) {
      await context.charactorState.setAction(ActionId.Eat_Dinner);
      await context.charactorState.changeStamina(50);
      await context.charactorState.markActionDoneToday(ActionId.Eat_Dinner);
    },
    durationMin: 20,
  },
  {
    action: ActionId.Stay_At_Home,
    description: '待在家中，放松、学习。持续60分钟。',
    precondition(context) {
      if (isWeekend(context)) {
        return true;
      } else {
        return allTrue([isAfternoon(context), isEvening(context)]);
      }
    },
    async executor(context) {
      await context.charactorState.setAction(ActionId.Stay_At_Home);
    },
    durationMin: 60,
  },
  {
    action: ActionId.Sleep,
    description: '睡觉。持续8个小时。',
    precondition(context) {
      return allTrue([isNight(context)]);
    },
    executor(context) {
      context.charactorState.setAction(ActionId.Sleep);
    },
    durationMin: 60 * 8,
  },
];

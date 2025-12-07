import { ActionId, ActionMetadata } from '@/types/action';
import { allTrue } from '@yuiju/utils';

export const schoolAction: ActionMetadata[] = [
  {
    action: ActionId.Study_At_School,
    description: '在学校上课。每次消耗体力30点。耗时3小时。',
    precondition(context) {
      return allTrue([
        () => {
          // 只能在9点到16点之间上课
          const hour = context.worldState.time.get('hour');
          return hour >= 9 && hour < 16;
        },
        () => {
          const weekday = context.worldState.time.day();
          // 只能在周一到周五上课
          return weekday >= 1 && weekday <= 5;
        },
      ]);
    },
    executor(context) {
      context.charactorState.setAction(ActionId.Study_At_School);
      context.charactorState.changeStamina(-30);
    },
    durationMin: 60 * 3,
  },
  {
    action: ActionId.Go_Home_From_School,
    description: '从学校回家。消耗体力10点。耗时30分钟。',
    precondition(context) {
      return context.charactorState.stamina >= 10;
    },
    executor(context) {
      context.charactorState.setAction(ActionId.Go_Home_From_School);
      context.charactorState.changeStamina(-5);
    },
    durationMin: 30,
  },
];

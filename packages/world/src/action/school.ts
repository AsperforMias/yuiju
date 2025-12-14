import { ActionId, ActionMetadata } from '@/types/action';
import { allTrue } from '@yuiju/utils';
import { isAfternoon, isWeekday } from './utils';

export const schoolAction: ActionMetadata[] = [
  {
    // TODO：逻辑优化，上课时间应该是固定的时间段，而不是随时可以上课
    action: ActionId.Study_At_School,
    description: '在学校上课。每次消耗体力30点。耗时3小时。',
    precondition(context) {
      return allTrue([
        () => {
          // 只能在9点到16点之间上课
          const hour = context.worldState.time.get('hour');
          return hour >= 9 && hour < 16;
        },
        isWeekday(context),
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
      return allTrue([context.charactorState.stamina >= 10, isAfternoon(context)]);
    },
    executor(context) {
      context.charactorState.setAction(ActionId.Go_Home_From_School);
      context.charactorState.changeStamina(-5);
    },
    durationMin: 30,
  },
];

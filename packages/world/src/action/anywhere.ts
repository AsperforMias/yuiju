import { ActionId, ActionMetadata } from '@/types/action';
import { isNotDoing, notDoneToday } from './utils';
import { allTrue } from '@yuiju/utils';

export const anywhereAction: ActionMetadata[] = [
  {
    action: ActionId.Idle,
    description: '休息等待，可以在任何地点进行。需要给出等待多少分钟。',
    precondition(context) {
      return isNotDoing(context, ActionId.Sleep);
    },
    async executor(context) {
      await context.charactorState.setAction(ActionId.Idle);
    },
    async durationMin(context, durationMinute) {
      return durationMinute ?? 10;
    },
  },
  {
    action: ActionId.Eat_Lunch,
    description: '吃午饭，恢复50点体力。耗时20分钟。',
    precondition(context) {
      const hour = context.worldState.time.get('hour');
      return allTrue([
        isNotDoing(context, ActionId.Sleep),
        () => hour >= 11 && hour < 14,
        () => notDoneToday(context, ActionId.Eat_Lunch),
      ]);
    },
    async executor(context) {
      await context.charactorState.setAction(ActionId.Eat_Lunch);
      await context.charactorState.changeStamina(50);
      await context.charactorState.markActionDoneToday(ActionId.Eat_Lunch);
    },
    durationMin: 20,
  },
];

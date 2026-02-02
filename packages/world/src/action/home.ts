import { ActionId, type ActionMetadata, allTrue, MajorScene } from "@yuiju/utils";
import {
  isAfternoon,
  isEvening,
  isMorning,
  isNight,
  isWeekday,
  isWeekend,
  notDoneToday,
} from "./utils";

export const homeAction: ActionMetadata[] = [
  {
    action: ActionId.Wake_Up,
    description: "起床并洗漱。耗时10分钟。",
    // 已在 precheckAction 中处理
    precondition(context) {
      return false;
    },
    async executor(context) {
      await context.characterState.setAction(ActionId.Wake_Up);
      await context.characterState.setStamina(20);
      await context.characterState.clearDailyActions();
    },
    durationMin: 10,
  },
  {
    action: ActionId.Sleep_For_A_Little,
    description: "再睡一会。耗时10分钟。",
    precondition(context) {
      // 已在 precheckAction 中处理
      return false;
    },
    async executor(context) {},
    durationMin: 10,
  },
  {
    action: ActionId.Eat_Breakfast,
    description: "吃早餐。体力增加50点。耗时20分钟。",
    precondition(context) {
      return allTrue([isMorning(context), () => notDoneToday(context, ActionId.Eat_Breakfast)]);
    },
    async executor(context) {
      await context.characterState.setAction(ActionId.Eat_Breakfast);
      await context.characterState.changeStamina(50);
      await context.characterState.markActionDoneToday(ActionId.Eat_Breakfast);
    },
    durationMin: 20,
  },
  {
    action: ActionId.Go_To_School_From_Home,
    description: "前往学校。体力消耗10点。耗时30分钟。",
    precondition(context) {
      return allTrue([isWeekday(context), isMorning(context)]);
    },
    async executor(context) {
      await context.characterState.setAction(ActionId.Go_To_School_From_Home);
      await context.characterState.setLocation({
        major: MajorScene.School,
      });
      await context.characterState.changeStamina(-10);
    },
    durationMin: 30,
  },
  {
    action: ActionId.Go_To_Shop_From_Home,
    description: "从家前往商店。消耗体力5点。耗时20分钟。",
    precondition(context) {
      return context.characterState.stamina >= 5 && !isNight(context);
    },
    async executor(context) {
      await context.characterState.setAction(ActionId.Go_To_Shop_From_Home);
      await context.characterState.setLocation({
        major: MajorScene.Shop,
      });
      await context.characterState.changeStamina(-5);
    },
    durationMin: 20,
  },
  {
    action: ActionId.Eat_Dinner,
    description: "吃晚餐。体力增加50点。耗时20分钟。",
    precondition(context) {
      return allTrue([isEvening(context), () => notDoneToday(context, ActionId.Eat_Dinner)]);
    },
    async executor(context) {
      await context.characterState.setAction(ActionId.Eat_Dinner);
      await context.characterState.changeStamina(50);
      await context.characterState.markActionDoneToday(ActionId.Eat_Dinner);
    },
    durationMin: 20,
  },
  {
    action: ActionId.Stay_At_Home,
    description: "待在家中，放松、学习。持续60分钟。",
    precondition(context) {
      if (isWeekend(context)) {
        return true;
      } else {
        return allTrue([isAfternoon(context), isEvening(context)]);
      }
    },
    async executor(context) {
      await context.characterState.setAction(ActionId.Stay_At_Home);
    },
    durationMin: 60,
  },
  {
    action: ActionId.Sleep,
    description: "睡觉。持续8个小时。",
    precondition(context) {
      return allTrue([isNight(context)]);
    },
    async executor(context) {
      context.characterState.setAction(ActionId.Sleep);
    },
    durationMin: async (context) => {
      const now = context.worldState.time.clone();
      let target = now.hour(7).minute(30).second(0).millisecond(0);

      if (target.isBefore(now)) {
        target = target.add(1, "day");
      }

      return target.diff(now, "minute");
    },
    completionEvent: "闹钟响了",
  },
];

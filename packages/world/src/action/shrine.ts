import { ActionId, type ActionMetadata, allTrue, MajorScene } from "@yuiju/utils";
import { isNight } from "./utils";

const SHRINE_OFFERING_COST = 5;
const SHRINE_PRAY_MOOD_GAIN = 4;
const SHRINE_OFFERING_MOOD_GAIN = 8;

function isAtShrine(major: MajorScene) {
  return major === MajorScene.Shrine;
}

/**
 * 解析参拜时是否投币。
 *
 * 当前策略：
 * - 当余额足够支付 5 元香火钱时，自动采用“投币参拜”；
 * - 否则退化为普通参拜。
 *
 * 这样可以在不引入额外参数选择链路的前提下，让单个“参拜”行为覆盖两种结果。
 */
function resolveShrinePrayerOption(money: number) {
  const shouldOffer = money >= SHRINE_OFFERING_COST;

  return {
    shouldOffer,
    moodGain: shouldOffer ? SHRINE_OFFERING_MOOD_GAIN : SHRINE_PRAY_MOOD_GAIN,
    moneyCost: shouldOffer ? SHRINE_OFFERING_COST : 0,
  };
}

export const shrineAction: ActionMetadata[] = [
  {
    action: ActionId.Pray_At_Shrine,
    description:
      "在神社参拜并向神明许愿；若身上有钱会顺手投币，投币会让心情更好。[心情+?][耗时10分钟]",
    precondition(context) {
      return allTrue([
        () => isAtShrine(context.characterState.location.major),
        () => !isNight(context),
      ]);
    },
    async executor(context) {
      const prayerOption = resolveShrinePrayerOption(context.characterState.money);

      await context.characterState.setAction(ActionId.Pray_At_Shrine);

      if (prayerOption.moneyCost > 0) {
        await context.characterState.changeMoney(-prayerOption.moneyCost);
      }

      await context.characterState.changeMood(prayerOption.moodGain);

      if (prayerOption.shouldOffer) {
        return `在神社投了${prayerOption.moneyCost}元香火钱，认真参拜并许愿，心情提升了${prayerOption.moodGain}点`;
      }

      return `在神社认真参拜并许愿，心情提升了${prayerOption.moodGain}点`;
    },
    durationMin: 10,
  },
  {
    action: ActionId.Go_To_Park_From_Shrine,
    description: "从神社回到公园。[体力-2][饱腹-1][耗时10分钟]",
    precondition(context) {
      return isAtShrine(context.characterState.location.major);
    },
    async executor(context) {
      await context.characterState.setAction(ActionId.Go_To_Park_From_Shrine);
      await context.characterState.setLocation({ major: MajorScene.Park });
      await context.characterState.changeStamina(-2);
      await context.characterState.changeSatiety(-1);
    },
    durationMin: 10,
  },
];

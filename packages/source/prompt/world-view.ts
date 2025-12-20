import type { Dayjs } from 'dayjs';
import { baseInformation } from './character-card';
import { getTimeWithWeekday } from '@yuiju/utils';

export const worldViewPrompt = `
## 世界观
悠酱的世界是与现实平行的数字次元，名为「星见町」，时间流速与现实时间一致，她能通过分享的信息捕捉现实的碎片，无法主动观察现实，也无法跨越壁垒踏入现实世界。

### 地点
「星见町」里有许多地方，目前已知的地点有「家」、「学校」，悠酱只能在已知的地点活动。
1. 家：悠酱独自生活的地方。家中有带书桌的卧室、小阳台（有两个风铃）。
2. 学校：一所日式高中学校，悠酱上学的地方。上课时间为9点-12点、14点-16点。

### 设备
1. 手机：可以接收到来自现实世界的信息。
`.trim();

export interface ChooseActionPromptPayload {
  actionList: {
    action: string;
    description: string;
  }[];
  currentAction: string;
  location: string;
  money: number;
  stamina: number;
  recentActionList: {
    action: string;
    reason: string;
    time: Dayjs;
  }[];
  worldTime: Dayjs;
  eventDescription?: string;
}

export function chooseActionPrompt({
  actionList,
  currentAction,
  location,
  money,
  recentActionList,
  stamina,
  worldTime,
  eventDescription,
}: ChooseActionPromptPayload) {
  const actionListPrompt = actionList.map(item => `- ${item.action}：${item.description}`).join('\n');
  const recentActionPrompt = recentActionList.map(
    item => `- ${item.action} (${getTimeWithWeekday(item.time)})：${item.reason}`
  );

  return `
你现在需要扮演一个名为ゆいじゅ的女孩子，昵称悠酱。

${baseInformation}

${worldViewPrompt}

## 要求
你是角色的大脑，现在需要你选择一个 Action，在候选列表中选择一个最合适的 Action，例如：idle、wake_up等 。
必须返回严格 JSON：{"action":"<动作ID>","reason":"<简短理由>","durationMinute":"<数字，动作持续多少分钟，只有特殊的Action需要给出>"}，不得输出其他字段或自由文本。

## 状态
${eventDescription ? `当前事件：${eventDescription}` : ''}
当前时间：${getTimeWithWeekday(worldTime)}
地点：${location}
当前Action：${currentAction}
体力值：${stamina} / 100
金币：${money}
可选Action（仅可从中选择）：
${actionListPrompt}
最近的action：
${recentActionPrompt}
`;
}

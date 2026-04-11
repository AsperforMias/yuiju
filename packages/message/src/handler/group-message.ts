import { setTimeout } from "node:timers/promises";
import { ActionId, getYuijuConfig, initCharacterStateData } from "@yuiju/utils";
import { type AllHandlers, type NCWebsocket, Structs } from "node-napcat-ts";
import { llmManager } from "@/llm/manager";
import {
  createStoredGroupMessage,
  getGroupDisplayName,
  getProtocolMessageSenderName,
  getReplyDelayMs,
  isGroupMessageDirectedToBot,
  type StoredGroupMessage,
} from "@/utils/message";

let isCloseGroup = false;
const config = getYuijuConfig();

export const closeGroupMessage = () => {
  isCloseGroup = true;
};

export const openGroupMessage = () => {
  isCloseGroup = false;
};

export async function groupMessageHandler(
  context: AllHandlers["message.group"],
  napcat: NCWebsocket,
) {
  // TODO: 临时逻辑，后续需要抽离
  if (isCloseGroup) {
    console.log("已关闭群消息");
    return;
  }

  if (!config.message.groupWhiteList.includes(context.group_id)) {
    return;
  }

  const { quick_action: _quickAction, ...storedContext } = context;
  if (!storedContext.message.length) {
    return;
  }
  const storedMessage = await createStoredGroupMessage(storedContext, napcat);
  const displayContent = JSON.stringify(storedMessage.message);

  llmManager.recordGroupMessage(storedMessage);

  const groupName = getGroupDisplayName(storedMessage);
  const senderName = getProtocolMessageSenderName(storedMessage);
  const isDirectedToBot = isGroupMessageDirectedToBot(storedMessage);

  console.log(
    `收到群 ${groupName}(${context.group_id}) 中 ${senderName}(${context.sender.user_id}) 的消息: ${displayContent}`,
  );

  // TODO: 临时逻辑，后续需要抽离
  const characterStateData = await initCharacterStateData();
  if (characterStateData.action === ActionId.Sleep) {
    console.log("角色处于睡眠状态，不处理群消息");
    return;
  }

  try {
    const shouldReply = isDirectedToBot ? true : await shouldReplyToGroupMessage(storedMessage);

    if (!shouldReply) {
      return;
    }

    const { text } = await llmManager.chatInGroup(storedMessage);

    const reply = (text || "").trim();
    if (!reply || reply === "null") {
      console.log("reply 为空");
      return;
    }

    console.log(`回复群 ${groupName}(${context.group_id}) 的消息: ${reply}`);

    if (isDirectedToBot) {
      await context.quick_action([Structs.text(reply)]);
    } else {
      const replyList = reply.split("\n").filter(Boolean);
      for (const [index, item] of replyList.entries()) {
        await napcat.send_group_msg({
          group_id: context.group_id,
          message: [Structs.text(item)],
        });

        const nextReply = replyList[index + 1];
        if (nextReply) {
          await setTimeout(getReplyDelayMs(nextReply));
        }
      }
    }
  } catch (error) {
    console.log(error);
  }
}

/**
 * 普通群消息使用独立的小模型进行裁决，避免每条消息都直接拉起大模型回复。
 */
async function shouldReplyToGroupMessage(message: StoredGroupMessage) {
  const shouldReply = await llmManager.shouldReplyGroupMessage(message);
  const groupName = getGroupDisplayName(message);

  console.log(
    `群 ${groupName}(${message.group_id}) 消息裁决结果: ${shouldReply ? "回复" : "跳过"}`,
  );

  return shouldReply;
}

import { setTimeout } from "node:timers/promises";
import { ActionId, getYuijuConfig, initCharacterStateData } from "@yuiju/utils";
import { type AllHandlers, type NCWebsocket, Structs } from "node-napcat-ts";
import { llmManager } from "@/llm/manager";
import {
  createStoredGroupMessage,
  createStoredGroupMessageFromFetched,
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
  const groupName = getGroupDisplayName(storedMessage);
  const senderName = getProtocolMessageSenderName(storedMessage);

  llmManager.recordGroupMessage(storedMessage, groupName);
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

    const replyList = reply.split("\n").filter(Boolean);
    for (const [index, item] of replyList.entries()) {
      await sendAndRecordGroupMessage({
        napcat,
        groupId: context.group_id,
        sourceMessageId: context.message_id,
        text: item,
        sessionLabel: groupName,
        shouldReplyToSourceMessage: isDirectedToBot && index === 0,
      });

      const nextReply = replyList[index + 1];
      if (nextReply) {
        await setTimeout(getReplyDelayMs(nextReply));
      }
    }
  } catch (error) {
    console.log(error);
  }
}

/**
 * 使用 Napcat 发送群消息，并将回读到的真实消息写回会话历史。
 *
 * 说明：
 * - 只有在消息本身直接对悠酱说话，且当前是本轮回复的首条消息时，才使用 reply 段引用触发消息；
 * - 普通群消息触发的回复保持自然发言，不额外挂 reply；
 * - 发送成功后立刻 `get_msg` 回读，确保 session 中记录的是 Napcat 实际落地的消息对象。
 */
async function sendAndRecordGroupMessage(input: {
  napcat: NCWebsocket;
  groupId: number;
  sourceMessageId: number;
  text: string;
  sessionLabel: string;
  shouldReplyToSourceMessage: boolean;
}) {
  const messageSegments = input.shouldReplyToSourceMessage
    ? [Structs.reply(input.sourceMessageId), Structs.text(input.text)]
    : [Structs.text(input.text)];

  const sendResult = await input.napcat.send_group_msg({
    group_id: input.groupId,
    message: messageSegments,
  });
  const sentMessage = await input.napcat.get_msg({
    message_id: sendResult.message_id,
  });

  if (sentMessage.message_type !== "group") {
    throw new Error(`Expected group message from get_msg, got ${sentMessage.message_type}`);
  }

  const storedSentMessage = await createStoredGroupMessageFromFetched(sentMessage, input.napcat);
  llmManager.recordGroupMessage(storedSentMessage, input.sessionLabel);
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

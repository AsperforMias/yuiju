import "@yuiju/utils/env";
import { setTimeout } from "node:timers/promises";
import { getYuijuConfig } from "@yuiju/utils";
import { type AllHandlers, type NCWebsocket, Structs } from "node-napcat-ts";
import { llmManager } from "@/llm/manager";
import {
  createStoredPrivateMessage,
  createStoredPrivateMessageFromFetched,
  getProtocolMessageSenderName,
  getReplyDelayMs,
} from "@/utils/message";
import { closeGroupMessage, openGroupMessage } from "./group-message";

const config = getYuijuConfig();
const whiteList = config.message.whiteList;

function groupMessageAction(action: string | null) {
  if (action === "/关闭") {
    closeGroupMessage();
    return true;
  }
  if (action === "/关闭") {
    openGroupMessage();
    return true;
  }
  return false;
}

export async function privateMessageHandler(
  context: AllHandlers["message.private"],
  napcat: NCWebsocket,
) {
  let receiveMessage: string | null = null;
  for (const item of context.message) {
    if (item.type === "text") {
      receiveMessage = item.data.text;
    }
  }

  if (groupMessageAction(receiveMessage)) {
    return;
  }

  if (!receiveMessage) {
    return;
  }

  if (!whiteList.includes(context.sender.user_id) && !context.sender.nickname) {
    return;
  }

  console.log(
    `收到来自 ${context.sender.nickname}(${context.sender.user_id}) 的消息: ${receiveMessage}`,
  );

  try {
    const { quick_action: _quickAction, ...rawMessage } = context;
    const storedMessage = await createStoredPrivateMessage(rawMessage, napcat);
    const sessionLabel = getProtocolMessageSenderName(storedMessage);
    llmManager.recordPrivateMessage(storedMessage, sessionLabel);
    const { text } = await llmManager.chatWithLLM(storedMessage);

    const reply = (text || "").trim();
    if (!reply || reply === "null") {
      console.log("reply 为空");
      return;
    }
    console.log(`回复给 ${context.sender.nickname}(${context.sender.user_id}) 的消息: ${reply}`);

    const replyList = reply.split("\n").filter(Boolean);
    for (const [index, item] of replyList.entries()) {
      await sendAndRecordPrivateMessage({
        napcat,
        userId: context.user_id,
        sourceMessageId: context.message_id,
        text: item,
        sessionLabel,
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
 * 使用 Napcat 发送私聊消息，并将回读到的真实消息写回会话历史。
 *
 * 说明：
 * - 私聊不再依赖 `quick_action`，统一走真实发送接口；
 * - 只有首条回复消息会引用当前触发消息，后续分段保持自然发言；
 * - 发送后立即 `get_msg` 回读，避免继续手工构造机器人的历史消息对象。
 */
async function sendAndRecordPrivateMessage(input: {
  napcat: NCWebsocket;
  userId: number;
  sourceMessageId: number;
  text: string;
  sessionLabel: string;
}) {
  const sendResult = await input.napcat.send_private_msg({
    user_id: input.userId,
    message: [Structs.text(input.text)],
  });
  const sentMessage = await input.napcat.get_msg({
    message_id: sendResult.message_id,
  });

  if (sentMessage.message_type !== "private") {
    throw new Error(`Expected private message from get_msg, got ${sentMessage.message_type}`);
  }

  const storedSentMessage = await createStoredPrivateMessageFromFetched(sentMessage, input.napcat);
  llmManager.recordPrivateMessage(storedSentMessage, input.sessionLabel);
}

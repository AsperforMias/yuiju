import { ActionId, getYuijuConfig, initCharacterStateData } from "@yuiju/utils";
import type { AllHandlers, NCWebsocket } from "node-napcat-ts";
import { llmManager } from "@/llm/manager";
import { logger } from "@/utils/logger";
import {
  createStoredGroupMessage,
  getGroupDisplayName,
  isGroupMessageDirectedToBot,
} from "@/utils/message";
import { sendAndRecordGroupReply } from "@/utils/reply";

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
  const groupName = getGroupDisplayName(storedMessage);

  const isDirectedToBot = isGroupMessageDirectedToBot(storedMessage);

  logger.info("[message.receive.group] 收到群消息", {
    groupName,
    sender: storedMessage.sender.card || storedMessage.sender.nickname || storedMessage.user_id,
    rawMessage: storedMessage.raw_message,
  });

  llmManager.recordGroupMessage(storedMessage, groupName);

  // TODO: 临时逻辑，后续需要抽离
  const characterStateData = await initCharacterStateData();
  if (characterStateData.action === ActionId.Sleep) {
    return;
  }

  try {
    const shouldReply = isDirectedToBot
      ? true
      : await llmManager.shouldReplyGroupMessage(storedMessage);

    if (!shouldReply) {
      return;
    }

    const { text } = await llmManager.chatInGroup(storedMessage);

    const reply = (text || "").trim();
    if (!reply || reply === "null") {
      return;
    }

    await sendAndRecordGroupReply({
      napcat,
      groupId: context.group_id,
      sourceMessageId: context.message_id,
      reply,
      sessionLabel: groupName,
      shouldReplyToSourceMessage: isDirectedToBot,
    });
  } catch (error) {
    logger.error("[message.reply.group] 处理群消息失败", error);
  }
}

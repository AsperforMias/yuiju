import { basename, extname } from "node:path";
import { setTimeout } from "node:timers/promises";
import { type NCWebsocket, type SendMessageSegment, Structs } from "node-napcat-ts";
import { llmManager } from "@/llm/manager";
import { logger } from "@/utils/logger";
import {
  createStoredGroupMessageFromFetched,
  createStoredPrivateMessageFromFetched,
  getReplyDelayMs,
} from "@/utils/message";
import { getResolvedSticker } from "@/utils/sticker";

const STICKER_TOKEN_REGEX = /\[\[sticker:([a-zA-Z0-9_-]+)\]\]/g;

function getStickerFileNameWithoutExtension(absoluteUri: string): string {
  const fileName = basename(absoluteUri);
  const extension = extname(fileName);
  return extension ? fileName.slice(0, -extension.length) : fileName;
}

/**
 * 将单行回复直接解析为可发送的消息段。
 *
 * 说明：
 * - 只识别严格格式 `[[sticker:key]]`；
 * - 未知表情包会降级为原始文本，避免丢失模型输出内容；
 * - 空白文本不会生成消息段，防止发出空消息。
 */
function buildMessageSegmentsFromLine(line: string): SendMessageSegment[] {
  const messageSegments: SendMessageSegment[] = [];
  let lastIndex = 0;

  for (const match of line.matchAll(STICKER_TOKEN_REGEX)) {
    const fullMatch = match[0];
    const key = match[1];
    const startIndex = match.index ?? -1;

    if (startIndex < 0) {
      continue;
    }

    if (startIndex > lastIndex) {
      const text = line.slice(lastIndex, startIndex);
      if (text.trim()) {
        messageSegments.push(Structs.text(text));
      }
    }

    const sticker = getResolvedSticker(key);
    if (!sticker) {
      logger.warn("[message.sticker] 命中未知或不可用表情包，降级为文本发送", {
        key,
        rawToken: fullMatch,
      });
      messageSegments.push(Structs.text(fullMatch));
    } else {
      messageSegments.push(
        Structs.image(sticker.fileBuffer, getStickerFileNameWithoutExtension(sticker.absoluteUri)),
      );
    }

    lastIndex = startIndex + fullMatch.length;
  }

  if (lastIndex < line.length) {
    const text = line.slice(lastIndex);
    if (text.trim()) {
      messageSegments.push(Structs.text(text));
    }
  }

  return messageSegments;
}

/**
 * 发送并记录完整的私聊回复。
 */
export async function sendAndRecordPrivateReply(input: {
  napcat: NCWebsocket;
  userId: number;
  reply: string;
  sessionLabel: string;
}) {
  const replyLines = input.reply.split("\n").filter((line) => line.trim().length > 0);

  for (const [lineIndex, line] of replyLines.entries()) {
    const messageSegments = buildMessageSegmentsFromLine(line);
    if (!messageSegments.length) {
      continue;
    }

    const sendResult = await input.napcat.send_private_msg({
      user_id: input.userId,
      message: messageSegments,
    });

    const sentMessage = await input.napcat.get_msg({
      message_id: sendResult.message_id,
    });

    if (sentMessage.message_type !== "private") {
      throw new Error(`Expected private message from get_msg, got ${sentMessage.message_type}`);
    }

    const storedSentMessage = await createStoredPrivateMessageFromFetched(
      sentMessage,
      input.napcat,
    );
    llmManager.recordPrivateMessage(storedSentMessage, input.sessionLabel);

    const nextLine = replyLines[lineIndex + 1];
    if (nextLine) {
      await setTimeout(getReplyDelayMs(nextLine));
    }
  }
}

/**
 * 发送并记录完整的群聊回复。
 */
export async function sendAndRecordGroupReply(input: {
  napcat: NCWebsocket;
  groupId: number;
  sourceMessageId: number;
  reply: string;
  sessionLabel: string;
  shouldReplyToSourceMessage: boolean;
}) {
  const replyLines = input.reply.split("\n").filter((line) => line.trim().length > 0);
  let hasAttachedReplySegment = false;

  for (const [lineIndex, line] of replyLines.entries()) {
    const payloadSegments = buildMessageSegmentsFromLine(line);
    if (!payloadSegments.length) {
      continue;
    }

    const shouldAttachReplySegment = input.shouldReplyToSourceMessage && !hasAttachedReplySegment;
    const messageSegments = shouldAttachReplySegment
      ? [Structs.reply(input.sourceMessageId), ...payloadSegments]
      : payloadSegments;

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

    if (shouldAttachReplySegment) {
      hasAttachedReplySegment = true;
    }

    const nextLine = replyLines[lineIndex + 1];
    if (nextLine) {
      await setTimeout(getReplyDelayMs(nextLine));
    }
  }
}

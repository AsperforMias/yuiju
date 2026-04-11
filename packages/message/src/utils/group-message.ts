import type { AllHandlers, Receive } from "node-napcat-ts";

type MessageSegment = Receive[keyof Receive];

export type StoredGroupMessage = Omit<AllHandlers["message.group"], "quick_action">;
export type StoredPrivateMessage = Omit<AllHandlers["message.private"], "quick_action">;

interface AssistantSentMessageBase {
  self_id: number;
  user_id: number;
  time: number;
  message_id: number;
  message_seq: number;
  real_id: number;
  raw_message: string;
  font: number;
  sender: {
    user_id: number;
    nickname: string;
    card: string;
    role?: "owner" | "admin" | "member";
  };
  post_type: "message_sent";
  message_format: "array";
  message: MessageSegment[];
}

export interface AssistantSentPrivateMessage extends AssistantSentMessageBase {
  message_type: "private";
  sub_type: "friend" | "group";
}

export interface AssistantSentGroupMessage extends AssistantSentMessageBase {
  message_type: "group";
  sub_type: "normal";
  group_id: number;
}

export type StoredProtocolMessage =
  | StoredPrivateMessage
  | StoredGroupMessage
  | AssistantSentPrivateMessage
  | AssistantSentGroupMessage;

export interface HistoryMessageItem {
  type: "message";
  role: "user" | "assistant";
  speaker: string;
  time: string;
  content: MessageSegment[];
}

/**
 * 供 LLM 消费的结构化历史项。
 *
 * 说明：
 * - 这里只描述真实消息，不再混入滚动摘要；
 * - 摘要会由上层 prompt 以独立文本章节注入。
 */
export type HistoryJsonItem = HistoryMessageItem;

/**
 * 统一判断群消息是否在当前语义上“直接对悠酱说话”。
 *
 * 说明：
 * - 这里不再依赖 Napcat 的额外查询，只基于当前消息段做本地判断；
 * - `@self` 明确视为直接对话；
 * - `reply` 段在当前方案下也视作直接回复链路，避免漏掉最常见的引用回复场景。
 */
export function isGroupMessageDirectedToBot(message: StoredGroupMessage): boolean {
  return message.message.some((segment) => {
    if (segment.type === "at") {
      return segment.data.qq === String(message.self_id);
    }

    return segment.type === "reply";
  });
}

export function segmentsTransfer(segments: MessageSegment[], selfId: number) {
  return segments.map((segment) => {
    switch (segment.type) {
      case "text":
        return segment;
      case "at":
        if (segment.data.qq === "all") {
          return "[@全体成员]";
        }

        if (segment.data.qq === String(selfId)) {
          return "[提及悠酱]";
        }

        return `[@QQ:${segment.data.qq}]`;
      case "reply":
        return segment;
      case "image":
      case "face":
      case "record":
      case "video":
      case "file":
        return segment;
      default:
        return segment;
    }
  });
}

/**
 * 获取群会话展示名，优先使用运行时携带的群名，没有时回退到群号。
 */
export function getGroupDisplayName(message: StoredGroupMessage): string {
  if ("group_name" in message && typeof message.group_name === "string") {
    const groupName = message.group_name.trim();
    if (groupName) {
      return groupName;
    }
  }

  return String(message.group_id);
}

/**
 * 获取协议消息发送者展示名，优先群名片，其次昵称，最后回退到 user_id。
 */
export function getProtocolMessageSenderName(message: StoredProtocolMessage): string {
  if (message.post_type === "message_sent") {
    return message.sender.card || message.sender.nickname || String(message.sender.user_id);
  }

  return getSenderDisplayName(message.sender);
}

function getSenderDisplayName(sender: { user_id: number; nickname: string; card: string }): string {
  const card = sender.card?.trim();
  const nickname = sender.nickname?.trim();
  return card || nickname || String(sender.user_id);
}

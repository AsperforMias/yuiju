import { SUBJECT_NAME } from "@yuiju/utils";
import type { AllHandlers, NCWebsocket, Receive } from "node-napcat-ts";

type MessageSegment = Receive[keyof Receive];
type AtMessageSegment = Extract<MessageSegment, { type: "at" }>;
type ReplyMessageSegment = Extract<MessageSegment, { type: "reply" }>;
type NonEnhancedMessageSegment = Exclude<MessageSegment, AtMessageSegment | ReplyMessageSegment>;

export type RawGroupMessage = Omit<AllHandlers["message.group"], "quick_action">;
export type RawPrivateMessage = Omit<AllHandlers["message.private"], "quick_action">;

export interface ResolvedReplyMessage {
  messageId: number;
  messageType: "private" | "group";
  speaker: string;
  time: number;
  rawMessage: string;
  message: EnhancedMessageSegment[];
}

export interface EnhancedAtSegment extends Omit<AtMessageSegment, "data"> {
  data: AtMessageSegment["data"] & {
    displayName: string;
    isSelf: boolean;
  };
}

export interface EnhancedReplySegment extends Omit<ReplyMessageSegment, "data"> {
  data: ReplyMessageSegment["data"] & {
    resolvedMessage: ResolvedReplyMessage | null;
  };
}

export type EnhancedMessageSegment =
  | NonEnhancedMessageSegment
  | EnhancedAtSegment
  | EnhancedReplySegment;

export type StoredGroupMessage = Omit<RawGroupMessage, "message" | "post_type"> & {
  post_type: "message" | "message_sent";
  message: EnhancedMessageSegment[];
};

export type StoredPrivateMessage = Omit<RawPrivateMessage, "message" | "post_type"> & {
  post_type: "message" | "message_sent";
  message: EnhancedMessageSegment[];
};

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
  message: EnhancedMessageSegment[];
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

export interface HistoryReplySegment {
  type: "reply";
  data: {
    speaker?: string;
    content: HistoryMessageSegment[];
  };
}

export interface HistoryAtSegment {
  type: "at";
  data: {
    displayName: string;
  };
}

export type HistoryMessageSegment =
  | Exclude<EnhancedMessageSegment, EnhancedReplySegment | EnhancedAtSegment>
  | HistoryAtSegment
  | HistoryReplySegment;

export interface HistoryMessageItem {
  speaker: string;
  time: string;
  content: HistoryMessageSegment[];
}

/**
 * 供 LLM 消费的结构化历史项。
 *
 * 说明：
 * - 这里只描述真实消息，不再混入滚动摘要；
 * - 摘要会由上层 prompt 以独立文本章节注入。
 */
export type HistoryJsonItem = HistoryMessageItem;

interface BaseSegmentsTransferInput {
  napcat: NCWebsocket;
  segments: MessageSegment[];
  selfId: number;
  resolveReply: boolean;
}

interface GroupSegmentsTransferInput extends BaseSegmentsTransferInput {
  scene: "group";
  groupId: number;
}

interface PrivateSegmentsTransferInput extends BaseSegmentsTransferInput {
  scene: "private";
}

type SegmentsTransferInput = GroupSegmentsTransferInput | PrivateSegmentsTransferInput;

type ReplyMessage = Awaited<ReturnType<NCWebsocket["get_msg"]>>;

/**
 * 根据“下一条即将发送”的文本长度估算等待间隔，让消息节奏更接近真人组织下一句回复。
 *
 * 说明：
 * - 基础等待保证极短句也不会瞬间连发；
 * - 按字符数线性增加等待时间，使长句拥有更自然的停顿；
 * - 使用上下限避免回复过慢；
 * - 叠加轻微随机扰动，减少固定模板感。
 */
export function getReplyDelayMs(text: string): number {
  const baseDelayMs = 1000;
  const perCharacterDelayMs = 200;
  const minDelayMs = 400;
  const maxDelayMs = 10000;
  const randomJitterMs = (Math.random() - 0.5) * 360;
  const estimatedDelayMs = baseDelayMs + text.trim().length * perCharacterDelayMs;

  return Math.round(Math.min(maxDelayMs, Math.max(minDelayMs, estimatedDelayMs + randomJitterMs)));
}

/**
 * 统一判断群消息是否在当前语义上“直接对悠酱说话”。
 *
 * 说明：
 * - `@self` 明确视为直接对话；
 * - `reply` 段视作直接回复链路，避免漏掉最常见的引用回复场景。
 */
export function isGroupMessageDirectedToBot(
  message: RawGroupMessage | StoredGroupMessage,
): boolean {
  return message.message.some((segment) => {
    if (segment.type === "at") {
      return segment.data.qq === String(message.self_id);
    }

    return segment.type === "reply";
  });
}

/**
 * 将 Napcat 原始消息段增强为更适合 LLM 理解的结构化消息段。
 *
 * 说明：
 * - `at` 会补齐展示昵称；
 * - `reply` 会直接拉取被引用消息，并只展开一层；
 * - 其他消息段保持原始结构，避免额外包装。
 */
export async function segmentsTransfer(
  input: SegmentsTransferInput,
): Promise<EnhancedMessageSegment[]> {
  return Promise.all(
    input.segments.map(async (segment) => {
      switch (segment.type) {
        case "text":
        case "image":
        case "face":
        case "record":
        case "video":
        case "file":
          return segment;
        case "at":
          return resolveAtSegment(segment, input);
        case "reply":
          return resolveReplySegment(segment, input);
        default:
          return segment as NonEnhancedMessageSegment;
      }
    }),
  );
}

/**
 * 将群聊原始消息转换为 session 中保存的增强消息。
 */
export async function createStoredGroupMessage(
  message: RawGroupMessage,
  napcat: NCWebsocket,
): Promise<StoredGroupMessage> {
  return {
    ...message,
    message: await segmentsTransfer({
      napcat,
      segments: message.message,
      selfId: message.self_id,
      scene: "group",
      groupId: message.group_id,
      resolveReply: true,
    }),
  };
}

/**
 * 将私聊原始消息转换为 session 中保存的增强消息。
 */
export async function createStoredPrivateMessage(
  message: RawPrivateMessage,
  napcat: NCWebsocket,
): Promise<StoredPrivateMessage> {
  return {
    ...message,
    message: await segmentsTransfer({
      napcat,
      segments: message.message,
      selfId: message.self_id,
      scene: "private",
      resolveReply: true,
    }),
  };
}

/**
 * 获取群会话展示名，优先使用运行时携带的群名，没有时回退到群号。
 */
export function getGroupDisplayName(message: RawGroupMessage | StoredGroupMessage): string {
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

  return message.sender.card || message.sender.nickname || String(message.sender.user_id);
}

/**
 * 将增强后的消息段进一步投影为更适合 LLM 理解的历史内容。
 *
 * 说明：
 * - 顶层 `reply` 仅保留“引用了谁”和“引用内容是什么”；
 * - reply 的冗余元数据（id、时间、raw_message 等）会被剔除；
 * - 嵌套 reply 不再继续保留，避免引用链层层展开。
 */
export function projectHistoryMessageContent(
  segments: EnhancedMessageSegment[],
): HistoryMessageSegment[] {
  return segments.map<HistoryMessageSegment>((segment) => {
    if (segment.type === "at") {
      return {
        type: "at",
        data: {
          displayName: segment.data.displayName,
        },
      };
    }

    if (segment.type !== "reply") {
      return segment;
    }

    const resolvedMessage = segment.data.resolvedMessage;
    const content = resolvedMessage ? projectReplyContentSegments(resolvedMessage.message) : [];

    return {
      type: "reply",
      data: {
        speaker: resolvedMessage?.speaker,
        content,
      },
    };
  });
}

async function resolveAtSegment(
  segment: AtMessageSegment,
  input: SegmentsTransferInput,
): Promise<EnhancedAtSegment> {
  const qq = segment.data.qq;

  if (qq === "all") {
    return {
      ...segment,
      data: {
        ...segment.data,
        displayName: "全体成员",
        isSelf: false,
      },
    };
  }

  if (qq === String(input.selfId)) {
    return {
      ...segment,
      data: {
        ...segment.data,
        displayName: SUBJECT_NAME,
        isSelf: true,
      },
    };
  }

  const displayName =
    input.scene === "group"
      ? await resolveGroupMemberDisplayName(input.napcat, input.groupId, qq)
      : await resolvePrivateMentionDisplayName(input.napcat, qq);

  return {
    ...segment,
    data: {
      ...segment.data,
      displayName,
      isSelf: false,
    },
  };
}

async function resolveReplySegment(
  segment: ReplyMessageSegment,
  input: SegmentsTransferInput,
): Promise<EnhancedReplySegment> {
  if (!input.resolveReply) {
    return {
      ...segment,
      data: {
        ...segment.data,
        resolvedMessage: null,
      },
    };
  }

  const resolvedMessage = await getResolvedReplyMessage(
    segment.data.id,
    input.napcat,
    input.selfId,
  );

  return {
    ...segment,
    data: {
      ...segment.data,
      resolvedMessage,
    },
  };
}

async function resolveGroupMemberDisplayName(
  napcat: NCWebsocket,
  groupId: number,
  qq: string,
): Promise<string> {
  const userId = Number(qq);
  if (Number.isNaN(userId)) {
    return qq;
  }

  try {
    const member = await napcat.get_group_member_info({
      group_id: groupId,
      user_id: userId,
    });

    return member.card || member.nickname || String(member.user_id);
  } catch {
    return qq;
  }
}

async function resolvePrivateMentionDisplayName(napcat: NCWebsocket, qq: string): Promise<string> {
  const userId = Number(qq);
  if (Number.isNaN(userId)) {
    return qq;
  }

  try {
    const stranger = await napcat.get_stranger_info({
      user_id: userId,
    });

    return stranger.nickname?.trim() || String(stranger.user_id);
  } catch {
    return qq;
  }
}

async function getResolvedReplyMessage(
  replyMessageId: string,
  napcat: NCWebsocket,
  selfId: number,
): Promise<ResolvedReplyMessage | null> {
  const messageId = Number(replyMessageId);
  if (Number.isNaN(messageId)) {
    return null;
  }

  try {
    const message = await napcat.get_msg({ message_id: messageId });
    return buildResolvedReplyMessage(message, napcat, selfId);
  } catch {
    return null;
  }
}

async function buildResolvedReplyMessage(
  message: ReplyMessage,
  napcat: NCWebsocket,
  selfId: number,
): Promise<ResolvedReplyMessage> {
  const storedMessage = await segmentsTransfer(
    message.message_type === "group"
      ? {
          napcat,
          segments: message.message,
          selfId,
          scene: "group",
          groupId: message.group_id,
          resolveReply: false,
        }
      : {
          napcat,
          segments: message.message,
          selfId,
          scene: "private",
          resolveReply: false,
        },
  );

  return {
    messageId: message.message_id,
    messageType: message.message_type,
    speaker:
      message.sender.card?.trim() ||
      message.sender.nickname?.trim() ||
      String(message.sender.user_id),
    time: message.time,
    rawMessage: message.raw_message,
    message: storedMessage,
  };
}

function projectReplyContentSegments(segments: EnhancedMessageSegment[]): HistoryMessageSegment[] {
  return segments.flatMap<HistoryMessageSegment>((segment) => {
    if (segment.type === "reply") {
      return [];
    }

    if (segment.type === "at") {
      return [
        {
          type: "at",
          data: {
            displayName: segment.data.displayName,
          },
        },
      ];
    }

    return [segment];
  });
}

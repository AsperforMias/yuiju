import type { AllHandlers, NCWebsocket, Receive } from "node-napcat-ts";

type GroupMessageContext = AllHandlers["message.group"];
type MessageSegment = Receive[keyof Receive];
type FetchedMessage = Awaited<ReturnType<NCWebsocket["get_msg"]>>;

export interface ParsedGroupMessage {
  groupDisplayName: string;
  senderName: string;
  plainText: string;
  textForLLM: string;
  isDirectedToBot: boolean;
}

/**
 * 统一解析群消息，提取后续决策与回复真正关心的字段。
 *
 * 说明：
 * - 文本内容与 mention 会按原始顺序一起重建，避免丢失“这句话在对谁说”的语义；
 * - “是否在直接对悠酱说话”同时覆盖 @ 悠酱与 reply 悠酱两种场景；
 * - 对其他被 @ 的用户，会通过 Napcat 查询群名片/昵称，让模型看到更自然的称呼。
 */
export async function parseGroupMessage(
  context: GroupMessageContext,
  napcat: NCWebsocket,
): Promise<ParsedGroupMessage> {
  const memberNameCache = new Map<string, string>();
  const replyParseCache = new Map<string, ParsedReplySegment>();
  const parsedSegments = await parseMessageSegments({
    context,
    napcat,
    segments: context.message,
    memberNameCache,
    replyParseCache,
    currentDepth: 0,
    trackDirectedToBot: true,
  });
  const plainText = parsedSegments.plainText.trim();
  const normalizedText = parsedSegments.normalizedText.trim();

  return {
    groupDisplayName: getGroupDisplayName(context),
    senderName: getSenderDisplayName(context),
    plainText,
    textForLLM: buildTextForLLM(normalizedText, parsedSegments.isDirectedToBot),
    isDirectedToBot: parsedSegments.isDirectedToBot,
  };
}

interface ParseMessageSegmentsInput {
  context: GroupMessageContext;
  napcat: NCWebsocket;
  segments: MessageSegment[];
  memberNameCache: Map<string, string>;
  replyParseCache: Map<string, ParsedReplySegment>;
  currentDepth: number;
  trackDirectedToBot: boolean;
}

interface ParseMessageSegmentsResult {
  plainText: string;
  normalizedText: string;
  isDirectedToBot: boolean;
}

interface ParsedReplySegment {
  normalizedText: string;
  isReplyToBot: boolean;
}

/**
 * 按消息段顺序重建可供 LLM 理解的文本。
 *
 * 说明：
 * - 顶层消息会同时提取 `plainText` 与 `isDirectedToBot`；
 * - reply 引用会递归展开成“回复某人：原消息内容”的自然文本；
 * - 嵌套 reply 仅用于补充语义，不会改变当前消息是否在直接对悠酱说话的判断。
 */
async function parseMessageSegments(
  input: ParseMessageSegmentsInput,
): Promise<ParseMessageSegmentsResult> {
  let isDirectedToBot = false;
  const textList: string[] = [];
  const normalizedSegmentList: string[] = [];

  for (const segment of input.segments) {
    if (segment.type === "at") {
      const normalizedMention = await normalizeMentionSegment({
        context: input.context,
        napcat: input.napcat,
        mentionQQ: segment.data.qq,
        memberNameCache: input.memberNameCache,
      });

      if (input.trackDirectedToBot && segment.data.qq === String(input.context.self_id)) {
        isDirectedToBot = true;
      }

      normalizedSegmentList.push(normalizedMention);
      continue;
    }

    if (segment.type === "reply") {
      const parsedReplySegment = await normalizeReplySegment({
        context: input.context,
        napcat: input.napcat,
        replyId: segment.data.id,
        memberNameCache: input.memberNameCache,
        replyParseCache: input.replyParseCache,
        currentDepth: input.currentDepth,
      });

      if (input.trackDirectedToBot && parsedReplySegment.isReplyToBot) {
        isDirectedToBot = true;
      }

      normalizedSegmentList.push(parsedReplySegment.normalizedText);
      continue;
    }

    if (segment.type === "text") {
      textList.push(segment.data.text);
      normalizedSegmentList.push(segment.data.text);
    }
  }

  return {
    plainText: textList.join(""),
    normalizedText: normalizedSegmentList.join(""),
    isDirectedToBot,
  };
}

function getSenderDisplayName(context: GroupMessageContext): string {
  const card = context.sender.card?.trim();
  const nickname = context.sender.nickname?.trim();
  return card || nickname || String(context.sender.user_id);
}

function getGroupDisplayName(context: GroupMessageContext): string {
  if ("group_name" in context && typeof context.group_name === "string") {
    const groupName = context.group_name.trim();
    if (groupName) {
      return groupName;
    }
  }

  return String(context.group_id);
}

function buildTextForLLM(normalizedText: string, isDirectedToBot: boolean): string {
  if (normalizedText) {
    return normalizedText;
  }

  if (isDirectedToBot) {
    return "（对方只提及了你，没有附带文字）";
  }

  return "";
}

/**
 * 将 reply 段展开为更完整的上下文，帮助 LLM 理解“这句话是在回复什么”。
 *
 * 说明：
 * - 通过 `get_msg` 拉取被引用消息；
 * - 递归解析被引用消息中的 text / at / reply；
 * - 使用缓存避免同一条引用消息在一次解析中被重复请求。
 */
async function normalizeReplySegment(input: {
  context: GroupMessageContext;
  napcat: NCWebsocket;
  replyId: string;
  memberNameCache: Map<string, string>;
  replyParseCache: Map<string, ParsedReplySegment>;
  currentDepth: number;
}) {
  const cachedReplyParseResult = input.replyParseCache.get(input.replyId);
  if (cachedReplyParseResult) {
    return cachedReplyParseResult;
  }

  if (input.currentDepth >= 2) {
    return createFallbackReplySegment(false);
  }

  const messageId = Number(input.replyId);
  if (Number.isNaN(messageId)) {
    return createFallbackReplySegment(false);
  }

  try {
    const repliedMessage = await input.napcat.get_msg({
      message_id: messageId,
    });
    const senderName = getFetchedMessageSenderName(repliedMessage);
    const repliedContent = await getFetchedMessageContent({
      context: input.context,
      napcat: input.napcat,
      message: repliedMessage,
      memberNameCache: input.memberNameCache,
      replyParseCache: input.replyParseCache,
      currentDepth: input.currentDepth + 1,
    });
    const parsedReplySegment: ParsedReplySegment = {
      normalizedText: repliedContent
        ? `[回复 ${senderName}：${repliedContent}]`
        : `[回复 ${senderName} 的一条消息]`,
      isReplyToBot: repliedMessage.sender.user_id === input.context.self_id,
    };

    input.replyParseCache.set(input.replyId, parsedReplySegment);
    return parsedReplySegment;
  } catch (error) {
    console.error(`解析引用消息 ${input.replyId} 失败，回退为通用提示`, error);
    const fallbackReplySegment = createFallbackReplySegment(false);
    input.replyParseCache.set(input.replyId, fallbackReplySegment);
    return fallbackReplySegment;
  }
}

/**
 * 将 `get_msg` 返回的结构化消息继续复用当前解析逻辑，保证 reply / at / text
 * 在正文与引用中保持一致的语义表达。
 */
async function getFetchedMessageContent(input: {
  context: GroupMessageContext;
  napcat: NCWebsocket;
  message: FetchedMessage;
  memberNameCache: Map<string, string>;
  replyParseCache: Map<string, ParsedReplySegment>;
  currentDepth: number;
}) {
  const parsedMessage = await parseMessageSegments({
    context: input.context,
    napcat: input.napcat,
    segments: input.message.message,
    memberNameCache: input.memberNameCache,
    replyParseCache: input.replyParseCache,
    currentDepth: input.currentDepth,
    trackDirectedToBot: false,
  });

  return parsedMessage.normalizedText.trim();
}

function getFetchedMessageSenderName(message: FetchedMessage): string {
  const card = message.sender.card?.trim();
  const nickname = message.sender.nickname?.trim();
  return card || nickname || String(message.sender.user_id);
}

function createFallbackReplySegment(isReplyToBot: boolean): ParsedReplySegment {
  return {
    normalizedText: "[回复一条消息]",
    isReplyToBot,
  };
}

/**
 * 将群消息中的 @ segment 转成更适合 LLM 理解的自然文本。
 *
 * 说明：
 * - @ 机器人会固定转成 `[提及悠酱]`；
 * - @ 全体成员会转成 `[@全体成员]`；
 * - @ 其他成员会尽量查询群名片/昵称，失败时再回退到 QQ 号。
 */
async function normalizeMentionSegment(input: {
  context: GroupMessageContext;
  napcat: NCWebsocket;
  mentionQQ: string | "all";
  memberNameCache: Map<string, string>;
}) {
  if (input.mentionQQ === "all") {
    return "[@全体成员]";
  }

  if (input.mentionQQ === String(input.context.self_id)) {
    return "[提及悠酱]";
  }

  const memberName = await getMentionedMemberName(input);
  return `[@${memberName}]`;
}

async function getMentionedMemberName(input: {
  context: GroupMessageContext;
  napcat: NCWebsocket;
  mentionQQ: string;
  memberNameCache: Map<string, string>;
}) {
  const cachedName = input.memberNameCache.get(input.mentionQQ);
  if (cachedName) {
    return cachedName;
  }

  try {
    const memberInfo = await input.napcat.get_group_member_info({
      group_id: input.context.group_id,
      user_id: Number(input.mentionQQ),
      no_cache: false,
    });

    const displayName =
      memberInfo.card?.trim() || memberInfo.nickname?.trim() || `QQ:${input.mentionQQ}`;
    input.memberNameCache.set(input.mentionQQ, displayName);
    return displayName;
  } catch (error) {
    console.error(
      `查询群 ${input.context.group_id} 成员 ${input.mentionQQ} 信息失败，回退到 QQ 号展示`,
      error,
    );
    const fallbackName = `QQ:${input.mentionQQ}`;
    input.memberNameCache.set(input.mentionQQ, fallbackName);
    return fallbackName;
  }
}

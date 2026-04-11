import type { MemoryEpisode } from "@yuiju/utils";
import { DEFAULT_MEMORY_SUBJECT_ID, getTimeWithWeekday } from "@yuiju/utils";
import dayjs from "dayjs";
import {
  type StoredProtocolMessage,
  projectProtocolMessageToHistoryItem,
  segmentsToDisplayText,
} from "@/utils/group-message";

export interface ChatWindowMessageItem {
  speaker_name: string;
  content: string;
  timestamp: string;
}

export interface UserWindowState {
  sessionLabel: string;
  windowStartMs: number;
  lastTsMs: number;
  messages: StoredProtocolMessage[];
}

interface ConversationEpisodePayload {
  subjectName: string;
  counterpartyName: string;
  windowStart: string;
  windowEnd: string;
  messageCount: number;
  messages: ChatWindowMessageItem[];
}

/**
 * 构建对话窗口 Episode。
 *
 * 说明：
 * - 窗口内部保存的是原始协议消息，归档时再统一投影为可读文本；
 * - payload 里仍保留稳定的展示结构，方便后续长期记忆和调试直接消费。
 */
export function buildConversationEpisode(input: {
  sessionLabel: string;
  state: UserWindowState;
  isDev: boolean;
  assistantName: string;
}): MemoryEpisode<ConversationEpisodePayload> {
  const windowStart = new Date(input.state.windowStartMs);
  const windowEnd = new Date(input.state.lastTsMs);
  const projectedMessages = input.state.messages.map((message) => {
    const historyItem = projectProtocolMessageToHistoryItem(message, input.assistantName);
    return {
      speaker_name: historyItem.speaker,
      content: segmentsToDisplayText(historyItem.content, message.self_id),
      timestamp: historyItem.time,
    };
  });
  const messageCount = projectedMessages.length;
  const previewText = projectedMessages
    .slice(-3)
    .map((message) => `${message.speaker_name}：${message.content}`)
    .join(" | ");

  return {
    source: "chat",
    type: "conversation",
    subject: DEFAULT_MEMORY_SUBJECT_ID,
    counterparty: input.sessionLabel,
    happenedAt: windowEnd,
    summaryText: [
      `悠酱与 ${input.sessionLabel} 完成了一段对话窗口归档`,
      `时间范围：${getTimeWithWeekday(dayjs(windowStart))} 至 ${getTimeWithWeekday(dayjs(windowEnd))}`,
      `消息数量：${messageCount}`,
      previewText ? `最近内容：${previewText}` : undefined,
    ]
      .filter(Boolean)
      .join("；"),
    extractionStatus: "pending",
    isDev: input.isDev,
    payload: {
      subjectName: DEFAULT_MEMORY_SUBJECT_ID,
      counterpartyName: input.sessionLabel,
      windowStart: getTimeWithWeekday(dayjs(windowStart)),
      windowEnd: getTimeWithWeekday(dayjs(windowEnd)),
      messageCount,
      messages: projectedMessages,
    },
  };
}

import {
  emitMemoryEpisode,
  getTimeWithWeekday,
  isDev,
  processPendingMemoryEpisodes,
  smallModel,
} from "@yuiju/utils";
import { generateText } from "ai";
import dayjs from "dayjs";
import {
  getProtocolMessageSenderName,
  type HistoryJsonItem,
  projectHistoryMessageContent,
  type StoredPrivateMessage,
} from "@/utils/message";
import { buildConversationEpisode } from "../memory/episode-builder";
import {
  AbstractChatSessionManager,
  type ChatMessageInput,
  type ChatSessionManagerOptions,
  type SessionHistoryContext,
} from "./abstract-chat-session-manager";

interface PrivateWindowState {
  sessionLabel: string;
  windowStartMs: number;
  lastTsMs: number;
  messages: StoredPrivateMessage[];
}

/**
 * 私聊会话管理器。
 *
 * 说明：
 * - 只负责私聊历史、窗口切分、摘要和归档；
 * - 与群聊完全拆开，避免通用实现继续耦合两种场景。
 */
export class PrivateChatSessionManager extends AbstractChatSessionManager<StoredPrivateMessage> {
  private conversationBySessionId = new Map<string, StoredPrivateMessage[]>();
  private windowStateBySessionId = new Map<string, PrivateWindowState>();
  private summaryBySessionId = new Map<string, string>();
  private pendingSummaryBySessionId = new Map<string, Promise<void>>();
  private conversationLimit: number;
  private conversationTtlMs: number;
  private windowMs: number;
  private isDev: boolean;

  constructor(options: ChatSessionManagerOptions) {
    super();
    this.conversationLimit = options.conversationLimit;
    this.conversationTtlMs = options.conversationTtlMs;
    this.windowMs = options.windowMs ?? 20 * 60 * 1000;
    this.isDev = isDev();
  }

  recordMessage(input: ChatMessageInput<StoredPrivateMessage>) {
    this.appendConversationEntry(input);
    this.appendWindowMessage(input);
  }

  async getHistoryJson(sessionId: string): Promise<SessionHistoryContext> {
    await this.pendingSummaryBySessionId.get(sessionId);

    const trimmedMessages = this.getTrimmedConversation(sessionId);
    const summary = this.summaryBySessionId.get(sessionId);
    const historyItems = this.buildHistoryItems(trimmedMessages);

    return {
      summary,
      historyJson: JSON.stringify(historyItems, null, 2),
    };
  }

  async flushUserWindow(sessionId: string) {
    const state = this.windowStateBySessionId.get(sessionId);
    if (!state) return;

    this.windowStateBySessionId.delete(sessionId);
    await this.finalizeWindow(sessionId, state);
  }

  private appendConversationEntry(input: ChatMessageInput<StoredPrivateMessage>) {
    const list = this.conversationBySessionId.get(input.sessionId) ?? [];
    list.push(input.message);
    this.conversationBySessionId.set(input.sessionId, this.trimConversation(list));
  }

  private appendWindowMessage(input: ChatMessageInput<StoredPrivateMessage>) {
    const messageTimeMs = this.getMessageTimeMs(input.message);
    const state = this.windowStateBySessionId.get(input.sessionId);

    if (!state) {
      this.windowStateBySessionId.set(input.sessionId, {
        sessionLabel: input.sessionLabel,
        windowStartMs: messageTimeMs,
        lastTsMs: messageTimeMs,
        messages: [input.message],
      });
      return;
    }

    const gapMs = messageTimeMs - state.lastTsMs;
    if (gapMs > this.windowMs) {
      this.windowStateBySessionId.delete(input.sessionId);
      void this.finalizeWindow(input.sessionId, state);

      this.windowStateBySessionId.set(input.sessionId, {
        sessionLabel: input.sessionLabel,
        windowStartMs: messageTimeMs,
        lastTsMs: messageTimeMs,
        messages: [input.message],
      });
      return;
    }

    state.lastTsMs = messageTimeMs;
    state.messages.push(input.message);
  }

  private async finalizeWindow(sessionId: string, state: PrivateWindowState) {
    await Promise.allSettled([
      this.enqueueSummaryRefresh(sessionId, state),
      this.writeChatWindowEpisode(state),
    ]);
  }

  private enqueueSummaryRefresh(sessionId: string, state: PrivateWindowState): Promise<void> {
    const previousTask = this.pendingSummaryBySessionId.get(sessionId) ?? Promise.resolve();

    const task = previousTask
      .catch(() => {})
      .then(async () => {
        try {
          const previousSummary = this.summaryBySessionId.get(sessionId);
          const nextSummary = await this.generateSessionSummary({
            sessionLabel: state.sessionLabel,
            previousSummary,
            state,
          });

          if (!nextSummary) {
            this.summaryBySessionId.delete(sessionId);
            return;
          }

          this.summaryBySessionId.set(sessionId, nextSummary);
        } catch (error) {
          console.error("Failed to update private chat session summary:", error);
        }
      })
      .finally(() => {
        if (this.pendingSummaryBySessionId.get(sessionId) === task) {
          this.pendingSummaryBySessionId.delete(sessionId);
        }
      });

    this.pendingSummaryBySessionId.set(sessionId, task);
    return task;
  }

  /**
   * 私聊摘要与 history JSON 复用同一份消息格式化逻辑，避免两套输出漂移。
   */
  private async generateSessionSummary(input: {
    sessionLabel: string;
    previousSummary?: string;
    state: PrivateWindowState;
  }): Promise<string | null> {
    const transcript = JSON.stringify(this.buildHistoryItems(input.state.messages), null, 2);

    const result = await generateText({
      model: smallModel,
      prompt: [
        "你是聊天历史摘要器，请把“既有历史摘要”和“本轮新增对话”整合成一段新的滚动摘要。",
        "要求：",
        "1. 只输出摘要正文，不要标题、不要列表、不要额外解释。",
        "2. 使用自然中文，尽量控制在 200 字以内。",
        "3. 优先保留稳定事实、最近持续话题、明确情绪变化、待跟进事项。",
        "4. 不要编造，不要把无关寒暄写进去。",
        "5. 如果目前没有值得保留的上下文，只输出“无”。",
        `会话：${input.sessionLabel}`,
        `既有历史摘要：${input.previousSummary ?? "无"}`,
        "本轮新增对话：",
        transcript,
      ].join("\n"),
    });

    const summaryText = result.text.trim();
    if (!summaryText || summaryText === "无") {
      return null;
    }

    return summaryText;
  }

  /**
   * 构建供下游复用的结构化历史项。
   *
   * 说明：
   * - `getHistoryJson` 与摘要 prompt 都应复用这份格式，避免结构漂移；
   * - 这里只做纯格式化，不负责 trim、summary 合并等会话控制逻辑。
   */
  private buildHistoryItems(messages: StoredPrivateMessage[]): HistoryJsonItem[] {
    return messages.map((message) => ({
      speaker: getProtocolMessageSenderName(message),
      time: getTimeWithWeekday(dayjs.unix(message.time)),
      content: projectHistoryMessageContent(message.message),
    }));
  }

  private async writeChatWindowEpisode(state: PrivateWindowState) {
    const episode = buildConversationEpisode({
      sessionLabel: state.sessionLabel,
      state,
      isDev: this.isDev,
    });

    try {
      await emitMemoryEpisode(episode);
      processPendingMemoryEpisodes({ limit: 1, isDev: this.isDev }).catch((error) => {
        console.error("Failed to process pending memory episodes:", error);
      });
    } catch (error) {
      console.error("Failed to write private chat window episode:", error);
    }
  }

  private getTrimmedConversation(sessionId: string): StoredPrivateMessage[] {
    const list = this.conversationBySessionId.get(sessionId) ?? [];
    const trimmed = this.trimConversation(list);

    if (trimmed.length !== list.length) {
      this.conversationBySessionId.set(sessionId, trimmed);
    }

    return trimmed;
  }

  private trimConversation(list: StoredPrivateMessage[]): StoredPrivateMessage[] {
    const cutoffMs = Date.now() - this.conversationTtlMs;
    const filtered = list.filter((message) => this.getMessageTimeMs(message) >= cutoffMs);

    return filtered.length > this.conversationLimit
      ? filtered.slice(filtered.length - this.conversationLimit)
      : filtered;
  }

  private getMessageTimeMs(message: StoredPrivateMessage): number {
    return message.time * 1000;
  }
}

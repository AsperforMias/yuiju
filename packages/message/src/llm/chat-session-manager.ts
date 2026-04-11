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
  type StoredProtocolMessage,
  segmentsTransfer,
} from "@/utils/group-message";
import { buildConversationEpisode, type UserWindowState } from "../memory/episode-builder";

export interface SessionHistoryContext {
  /**
   * 当前会话的滚动摘要。
   *
   * 说明：
   * - 摘要会单独返回给上层，由 prompt 构建器决定如何注入；
   * - 不再把摘要伪装成 JSON 历史项，避免和真实消息结构混在一起。
   */
  summary?: string;
  historyJson: string;
}

export interface ChatMessageInput {
  sessionId: string;
  sessionLabel: string;
  message: StoredProtocolMessage;
}

export interface ChatSessionManagerOptions {
  conversationLimit?: number;
  conversationTtlMs?: number;
  /**
   * 静默刷新时间
   */
  windowMs?: number;
}

export class ChatSessionManager {
  /**
   * 每个会话最近一段原始协议消息，会在读取和写入时按 TTL 与最大条数双重裁剪。
   */
  private conversationBySessionId = new Map<string, StoredProtocolMessage[]>();

  /**
   * 每个会话当前仍在进行中的聊天窗口。
   *
   * 说明：
   * - 用于判断是否发生“静默超时切窗”；
   * - 窗口结束后会触发摘要更新与 memory episode 归档。
   */
  private windowStateBySessionId = new Map<string, UserWindowState>();

  /**
   * 每个会话的滚动自然语言摘要，会在后续请求里作为独立上下文提供给 prompt。
   */
  private summaryBySessionId = new Map<string, string>();

  /**
   * 每个会话当前正在执行的摘要刷新任务。
   *
   * 说明：
   * - 用来串行化同一会话的摘要更新，避免连续切窗时发生覆盖；
   * - 读取历史 JSON 前会先等待该任务完成，保证 summary 与消息窗口一致。
   */
  private pendingSummaryBySessionId = new Map<string, Promise<void>>();

  /**
   * 单个会话最多保留多少条原始消息给 LLM。
   */
  private conversationLimit: number;

  /**
   * 原始消息的存活时间，超过该时间的消息不会再进入 LLM 上下文。
   */
  private conversationTtlMs: number;

  /**
   * 两条消息之间允许的最大静默间隔；超过该时间视为旧窗口结束。
   */
  private windowMs: number;

  /**
   * 当前运行环境标记，会透传到 memory episode 里，区分 dev / production。
   */
  private isDev: boolean;

  constructor(options: ChatSessionManagerOptions = {}) {
    this.conversationLimit = options.conversationLimit ?? 20;
    this.conversationTtlMs = options.conversationTtlMs ?? 3600 * 1000;
    this.windowMs = options.windowMs ?? 20 * 60 * 1000;
    this.isDev = isDev();
  }

  recordMessage(input: ChatMessageInput) {
    this.appendConversationEntry(input);
    this.appendWindowMessage(input);
  }

  async getHistoryJson(sessionId: string): Promise<SessionHistoryContext> {
    await this.pendingSummaryBySessionId.get(sessionId);

    const trimmedMessages = this.getTrimmedConversation(sessionId);
    const summary = this.summaryBySessionId.get(sessionId);

    const historyItems: HistoryJsonItem[] = trimmedMessages.map((message) => ({
      type: "message",
      role: message.post_type === "message_sent" ? "assistant" : "user",
      speaker: getProtocolMessageSenderName(message),
      time: getTimeWithWeekday(dayjs.unix(message.time)),
      content: message.message,
    }));

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

  private appendConversationEntry(input: ChatMessageInput) {
    const list = this.conversationBySessionId.get(input.sessionId) ?? [];
    list.push(input.message);
    this.conversationBySessionId.set(input.sessionId, this.trimConversation(list));
  }

  private appendWindowMessage(input: ChatMessageInput) {
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

  /**
   * 会话窗口结束后，同时推进两条链路：
   * 1. 归档为 memory episode，供长期记忆消费；
   * 2. 更新滚动摘要，供后续 prompt 作为中期上下文使用。
   */
  private async finalizeWindow(sessionId: string, state: UserWindowState) {
    await Promise.allSettled([
      this.enqueueSummaryRefresh(sessionId, state),
      this.writeChatWindowEpisode(state),
    ]);
  }

  /**
   * 将滚动摘要更新串行化，避免同一会话在短时间内多次切窗时发生摘要覆盖。
   */
  private enqueueSummaryRefresh(sessionId: string, state: UserWindowState): Promise<void> {
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
          console.error("Failed to update chat session summary:", error);
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
   * 使用小模型维护一段滚动摘要，供后续 prompt 单独注入。
   */
  private async generateSessionSummary(input: {
    sessionLabel: string;
    previousSummary?: string;
    state: UserWindowState;
  }): Promise<string | null> {
    const transcript = input.state.messages
      .map((message) => {
        const speaker = getProtocolMessageSenderName(message);
        const time = getTimeWithWeekday(dayjs.unix(message.time));
        const content = segmentsTransfer(message.message, message.self_id);
        return `[${time}] ${speaker}：${content}`;
      })
      .join("\n");

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

  private async writeChatWindowEpisode(state: UserWindowState) {
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
      console.error("Failed to write chat window episode:", error);
    }
  }

  private getTrimmedConversation(sessionId: string): StoredProtocolMessage[] {
    const list = this.conversationBySessionId.get(sessionId) ?? [];
    const trimmed = this.trimConversation(list);

    if (trimmed.length !== list.length) {
      this.conversationBySessionId.set(sessionId, trimmed);
    }

    return trimmed;
  }

  private trimConversation(list: StoredProtocolMessage[]): StoredProtocolMessage[] {
    const cutoffMs = Date.now() - this.conversationTtlMs;
    const filtered = list.filter((message) => this.getMessageTimeMs(message) >= cutoffMs);

    return filtered.length > this.conversationLimit
      ? filtered.slice(filtered.length - this.conversationLimit)
      : filtered;
  }

  private getMessageTimeMs(message: StoredProtocolMessage): number {
    return message.time * 1000;
  }
}

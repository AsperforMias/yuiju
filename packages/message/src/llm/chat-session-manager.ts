import type { MemoryServiceClient } from "@yuiju/utils";
import {
  emitMemoryEpisode,
  getTimeWithWeekday,
  isDev,
  processPendingMemoryEpisodes,
  smallModel,
} from "@yuiju/utils";
import { generateText, type ModelMessage } from "ai";
import dayjs from "dayjs";
import { buildConversationEpisode, type UserWindowState } from "../memory/episode-builder";

type Role = "user" | "assistant";

export const SUBJECT_NAME = "ゆいじゅ";

interface ConversationEntry {
  role: Role;
  content: string;
  timeMs: number;
}

/**
 * 供上层 LLM 调用方消费的会话上下文。
 *
 * 说明：
 * - `messages` 只包含真实对话消息，避免将 system message 混入消息数组；
 * - `summary` 作为独立字段返回，由上层统一拼接进顶层 system prompt。
 */
export interface SessionLLMContext {
  messages: ModelMessage[];
  summary?: string;
}

export interface ChatMessageInput {
  sessionId: string;
  sessionLabel: string;
  role: Role;
  llmContent: string;
  archiveContent?: string;
  speakerName?: string;
  timestamp: Date;
}

export interface ChatSessionManagerOptions {
  conversationLimit?: number;
  conversationTtlMs?: number;
  /**
   * 静默刷新时间
   */
  windowMs?: number;
  memoryClient?: MemoryServiceClient | null;
}

export class ChatSessionManager {
  /**
   * 每个会话最近一段可直接发送给 LLM 的原始消息。
   *
   * 说明：
   * - 这里只保存 llmContent，不掺入窗口摘要和 episode 归档信息；
   * - 会在读取和写入时按 TTL 与最大条数双重裁剪。
   */
  private conversationBySessionId = new Map<string, ConversationEntry[]>();

  /**
   * 每个会话当前仍在进行中的聊天窗口。
   *
   * 说明：
   * - 用于判断是否发生“静默超时切窗”；
   * - 窗口结束后会触发摘要更新与 memory episode 归档。
   */
  private windowStateBySessionId = new Map<string, UserWindowState>();

  /**
   * 每个会话的滚动自然语言摘要，会在后续请求里由上层拼接进顶层 system prompt。
   */
  private summaryBySessionId = new Map<string, string>();

  /**
   * 每个会话当前正在执行的摘要刷新任务。
   *
   * 说明：
   * - 用来串行化同一会话的摘要更新，避免连续切窗时发生覆盖；
   * - getLLMMessages 会先等待这个任务完成，再返回最终上下文。
   */
  private pendingSummaryBySessionId = new Map<string, Promise<void>>();

  /**
   * 会话展示名缓存。
   *
   * 说明：
   * - sessionId 用于内部索引；
   * - sessionLabel 用于摘要、归档文案和 prompt 展示。
   */
  private sessionLabelBySessionId = new Map<string, string>();

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
    this.sessionLabelBySessionId.set(input.sessionId, input.sessionLabel);
    this.appendConversationEntry(input);
    this.appendWindowMessage(input);
  }

  async getLLMMessages(sessionId: string): Promise<SessionLLMContext> {
    await this.pendingSummaryBySessionId.get(sessionId);

    const nowMs = Date.now();
    const cutoffMs = nowMs - this.conversationTtlMs;
    const list = this.conversationBySessionId.get(sessionId) ?? [];

    const filtered = list.filter((e) => e.timeMs >= cutoffMs);
    const trimmed =
      filtered.length > this.conversationLimit
        ? filtered.slice(filtered.length - this.conversationLimit)
        : filtered;

    if (trimmed.length !== list.length) {
      this.conversationBySessionId.set(sessionId, trimmed);
    }

    // const summary = this.summaryBySessionId.get(sessionId);
    const summary = "聊得很激烈";
    const messages = trimmed.map((e) => {
      if (e.role === "user") {
        const timeText = getTimeWithWeekday(dayjs(e.timeMs));
        return { role: e.role, content: `${e.content}\n\n[用户发送时间：${timeText}]` };
      }

      return { role: e.role, content: e.content };
    });

    return {
      messages,
      summary,
    };
  }

  async flushUserWindow(sessionId: string) {
    const state = this.windowStateBySessionId.get(sessionId);
    if (!state) return;

    this.windowStateBySessionId.delete(sessionId);
    await this.finalizeWindow(sessionId, state);
  }

  private appendConversationEntry(input: ChatMessageInput) {
    const nowMs = Date.now();
    const cutoffMs = nowMs - this.conversationTtlMs;

    const list = this.conversationBySessionId.get(input.sessionId) ?? [];
    list.push({
      role: input.role,
      content: input.llmContent,
      timeMs: input.timestamp.getTime(),
    });

    const filtered = list.filter((e) => e.timeMs >= cutoffMs);
    const trimmed =
      filtered.length > this.conversationLimit
        ? filtered.slice(filtered.length - this.conversationLimit)
        : filtered;

    this.conversationBySessionId.set(input.sessionId, trimmed);
  }

  private appendWindowMessage(input: ChatMessageInput) {
    const tsMs = input.timestamp.getTime();
    const state = this.windowStateBySessionId.get(input.sessionId);
    const speakerName =
      input.speakerName ?? (input.role === "assistant" ? SUBJECT_NAME : input.sessionLabel);
    const archiveContent = input.archiveContent ?? input.llmContent;

    if (!state) {
      this.windowStateBySessionId.set(input.sessionId, {
        sessionLabel: input.sessionLabel,
        windowStartMs: tsMs,
        lastTsMs: tsMs,
        messages: [
          {
            speaker_name: speakerName,
            content: archiveContent,
            timestamp: getTimeWithWeekday(dayjs(input.timestamp)),
          },
        ],
      });
      return;
    }

    const gapMs = tsMs - state.lastTsMs;
    if (gapMs > this.windowMs) {
      this.windowStateBySessionId.delete(input.sessionId);
      this.finalizeWindow(input.sessionId, state);

      this.windowStateBySessionId.set(input.sessionId, {
        sessionLabel: input.sessionLabel,
        windowStartMs: tsMs,
        lastTsMs: tsMs,
        messages: [
          {
            speaker_name: speakerName,
            content: archiveContent,
            timestamp: getTimeWithWeekday(dayjs(input.timestamp)),
          },
        ],
      });
      return;
    }

    state.lastTsMs = tsMs;
    state.messages.push({
      speaker_name: speakerName,
      content: archiveContent,
      timestamp: getTimeWithWeekday(dayjs(input.timestamp)),
    });
  }

  /**
   * 会话窗口结束后，同时推进两条链路：
   * 1. 归档为 memory episode，供长期记忆消费；
   * 2. 更新滚动摘要，供后续 prompt 作为中期上下文。
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
   * 使用小模型维护一段可直接注入 prompt 的自然语言滚动摘要。
   *
   * 说明：
   * - 旧摘要与新窗口一起输入，让模型输出最新版本的压缩结果；
   * - 只保留后续续聊真正有帮助的信息，避免把日常流水原样搬进 prompt；
   * - 返回 "无" 时视为当前无需保留摘要。
   */
  private async generateSessionSummary(input: {
    sessionLabel: string;
    previousSummary?: string;
    state: UserWindowState;
  }): Promise<string | null> {
    const transcript = input.state.messages
      .map((message) => `[${message.timestamp}] ${message.speaker_name}：${message.content}`)
      .join("\n");

    const result = await generateText({
      model: smallModel,
      prompt: [
        "你是聊天历史摘要器，请把“既有历史摘要”和“本轮新增对话”整合成一段新的滚动摘要，供后续聊天续接使用。",
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
      return;
    }
  }
}

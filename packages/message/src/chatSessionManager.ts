import type { MemoryServiceClient, WriteEpisodeInput } from "@yuiju/utils";
import { isDev } from "@yuiju/utils";
import type { ModelMessage } from "ai";

type Role = "user" | "assistant";

interface ConversationEntry {
  role: Role;
  content: string;
  timeMs: number;
}

export interface ChatMessageInput {
  counterparty_name: string;
  role: Role;
  content: string;
  timestamp: Date;
}

interface ChatWindowMessageItem {
  role: Role;
  content: string;
  timestamp: string;
}

interface UserWindowState {
  windowStartMs: number;
  lastTsMs: number;
  messages: ChatWindowMessageItem[];
}

export interface ChatSessionManagerOptions {
  conversationLimit?: number;
  conversationTtlMs?: number;
  windowMs?: number;
  memoryClient?: MemoryServiceClient | null;
}

export class ChatSessionManager {
  private conversationByCounterparty = new Map<string, ConversationEntry[]>();
  private windowStateByCounterparty = new Map<string, UserWindowState>();

  private conversationLimit: number;
  private conversationTtlMs: number;
  private windowMs: number;
  private memoryClient: MemoryServiceClient | null;
  private isDev: boolean;

  constructor(options: ChatSessionManagerOptions = {}) {
    this.conversationLimit = options.conversationLimit ?? 10;
    this.conversationTtlMs = options.conversationTtlMs ?? 3600 * 1000;
    this.windowMs = options.windowMs ?? 10 * 60 * 1000;
    this.memoryClient = options.memoryClient ?? null;
    this.isDev = isDev;
  }

  recordMessage(input: ChatMessageInput) {
    this.appendConversationEntry(input);
    this.appendWindowMessage(input);
  }

  getLLMMessages(counterparty_name: string): ModelMessage[] {
    const nowMs = Date.now();
    const cutoffMs = nowMs - this.conversationTtlMs;
    const list = this.conversationByCounterparty.get(counterparty_name) ?? [];

    const filtered = list.filter((e) => e.timeMs >= cutoffMs);
    const trimmed =
      filtered.length > this.conversationLimit
        ? filtered.slice(filtered.length - this.conversationLimit)
        : filtered;

    if (trimmed.length !== list.length) {
      this.conversationByCounterparty.set(counterparty_name, trimmed);
    }

    return trimmed.map((e) => ({ role: e.role, content: e.content }));
  }

  async flushUserWindow(counterparty_name: string) {
    const state = this.windowStateByCounterparty.get(counterparty_name);
    if (!state) return;

    this.windowStateByCounterparty.delete(counterparty_name);
    await this.writeChatWindowEpisode(counterparty_name, state);
  }

  private appendConversationEntry(input: ChatMessageInput) {
    const nowMs = Date.now();
    const cutoffMs = nowMs - this.conversationTtlMs;

    const list = this.conversationByCounterparty.get(input.counterparty_name) ?? [];
    list.push({
      role: input.role,
      content: input.content,
      timeMs: input.timestamp.getTime(),
    });

    const filtered = list.filter((e) => e.timeMs >= cutoffMs);
    const trimmed =
      filtered.length > this.conversationLimit
        ? filtered.slice(filtered.length - this.conversationLimit)
        : filtered;

    this.conversationByCounterparty.set(input.counterparty_name, trimmed);
  }

  private appendWindowMessage(input: ChatMessageInput) {
    const tsMs = input.timestamp.getTime();
    const state = this.windowStateByCounterparty.get(input.counterparty_name);

    if (!state) {
      this.windowStateByCounterparty.set(input.counterparty_name, {
        windowStartMs: tsMs,
        lastTsMs: tsMs,
        messages: [
          {
            role: input.role,
            content: input.content,
            timestamp: input.timestamp.toISOString(),
          },
        ],
      });
      return;
    }

    const gapMs = tsMs - state.lastTsMs;
    if (gapMs > this.windowMs) {
      this.windowStateByCounterparty.delete(input.counterparty_name);
      void this.writeChatWindowEpisode(input.counterparty_name, state).catch(() => {});

      this.windowStateByCounterparty.set(input.counterparty_name, {
        windowStartMs: tsMs,
        lastTsMs: tsMs,
        messages: [
          {
            role: input.role,
            content: input.content,
            timestamp: input.timestamp.toISOString(),
          },
        ],
      });
      return;
    }

    state.lastTsMs = tsMs;
    state.messages.push({
      role: input.role,
      content: input.content,
      timestamp: input.timestamp.toISOString(),
    });
  }

  private async writeChatWindowEpisode(counterparty_name: string, state: UserWindowState) {
    if (!this.memoryClient) return;

    const windowStart = new Date(state.windowStartMs);
    const windowEnd = new Date(state.lastTsMs);

    const episodeContent = {
      counterparty_name,
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      messages: state.messages,
    };

    const payload: WriteEpisodeInput = {
      type: "chat_window",
      counterparty_name,
      content: episodeContent,
      reference_time: windowEnd,
      is_dev: this.isDev,
    };

    try {
      await this.memoryClient.writeEpisode(payload);
    } catch {
      return;
    }
  }
}

import type { MemoryServiceClient, WriteEpisodeInput } from "@yuiju/utils";

type Role = "user" | "assistant";

export interface ChatMessageItem {
  role: Role;
  content: string;
  timestamp: string;
}

interface UserWindowState {
  windowStartMs: number;
  lastTsMs: number;
  messages: ChatMessageItem[];
}

export class ChatEpisodeBuffer {
  private stateByUser = new Map<string, UserWindowState>();

  constructor(
    private opts: {
      windowMs: number;
      memoryClient: MemoryServiceClient | null;
    },
  ) {}

  /**
   * 追加一条消息到时间窗 buffer。
   *
   * 规则：
   * - 若与上一条消息间隔 > windowMs：先结算上一段为 chat_window episode 写入记忆服务，再开启新窗口
   * - 否则：追加到当前窗口
   */
  async addMessage(input: { user_name: string; role: Role; content: string; timestamp: Date }) {
    const tsMs = input.timestamp.getTime();
    const state = this.stateByUser.get(input.user_name);
    if (!state) {
      this.stateByUser.set(input.user_name, {
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
    if (gapMs > this.opts.windowMs) {
      await this.flushUserWindow(input.user_name);
      this.stateByUser.set(input.user_name, {
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

  /**
   * 结算某个用户的当前窗口为一条 chat_window episode。
   *
   * 说明：
   * - 若未配置 MEMORY_SERVICE_URL，则跳过写入（不影响 message 正常回复）。
   */
  async flushUserWindow(user_name: string) {
    const memoryClient = this.opts.memoryClient;
    const state = this.stateByUser.get(user_name);
    if (!state) return;

    this.stateByUser.delete(user_name);
    if (!memoryClient) return;

    const windowStart = new Date(state.windowStartMs);
    const windowEnd = new Date(state.lastTsMs);

    const episodeContent = {
      user_name,
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      messages: state.messages,
    };

    const payload: WriteEpisodeInput = {
      user_name,
      type: "chat_window",
      content: episodeContent,
      reference_time: windowEnd,
    };

    await memoryClient.writeEpisode(payload);
  }
}

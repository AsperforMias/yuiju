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

export interface ChatMessageInput<TMessage> {
  sessionId: string;
  sessionLabel: string;
  message: TMessage;
}

export interface ChatSessionManagerOptions {
  conversationLimit: number;
  conversationTtlMs: number;
  /**
   * 静默刷新时间
   */
  windowMs: number;
}

/**
 * LLMManager 依赖的会话管理抽象契约。
 *
 * 说明：
 * - 这里只定义对外能力，不承载任何通用状态或通用实现；
 * - 群聊和私聊会各自维护独立的内部逻辑。
 */
export abstract class AbstractChatSessionManager<TMessage> {
  abstract recordMessage(input: ChatMessageInput<TMessage>): void;

  abstract getHistoryJson(sessionId: string): Promise<SessionHistoryContext>;

  abstract flushUserWindow(sessionId: string): Promise<void>;
}

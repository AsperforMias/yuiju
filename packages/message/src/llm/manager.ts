import {
  deepseekProvider,
  getCharacterCardPrompt,
  memorySearchTool,
  queryStateTool,
  queryWorldMapTool,
  SUBJECT_NAME,
  smallModel,
} from "@yuiju/utils";
import { generateText, Output, stepCountIs } from "ai";
import { z } from "zod";
import {
  getGroupDisplayName,
  getProtocolMessageSenderName,
  type StoredGroupMessage,
  type StoredPrivateMessage,
} from "@/utils/message";
import {
  type AbstractChatSessionManager,
  GroupChatSessionManager,
  PrivateChatSessionManager,
} from "./chat-session-manager";

export class LLMManager {
  private privateSession: AbstractChatSessionManager<StoredPrivateMessage>;
  private groupSession: AbstractChatSessionManager<StoredGroupMessage>;

  constructor() {
    /**
     * 群聊/私聊先保留两份独立配置入口，方便后续在不改调用方的前提下继续分叉策略。
     */
    const privateSessionOptions = {
      conversationLimit: 20,
      conversationTtlMs: 8 * 60 * 60 * 1000,
      summaryFlushMessageCount: 15,
      summaryFlushIdleMs: 30 * 60 * 1000,
      episodeIdleMs: 4 * 60 * 60 * 1000,
    } as const;
    const groupSessionOptions = {
      conversationLimit: 20,
      conversationTtlMs: 8 * 60 * 60 * 1000,
      summaryFlushMessageCount: 15,
      summaryFlushIdleMs: 30 * 60 * 1000,
      episodeIdleMs: 4 * 60 * 60 * 1000,
    } as const;

    this.privateSession = new PrivateChatSessionManager({
      ...privateSessionOptions,
    });
    this.groupSession = new GroupChatSessionManager({
      ...groupSessionOptions,
    });
  }

  public async chatWithLLM(message: StoredPrivateMessage) {
    const sessionId = this.buildPrivateSessionKey(message.user_id);
    const { historyJson, summary } = await this.privateSession.getHistoryJson(sessionId);
    const result = await generateText({
      model: deepseekProvider("deepseek-chat"),
      system: getCharacterCardPrompt(),
      messages: [
        {
          role: "user",
          content: this.buildHistoryUserPrompt({
            summary,
            historyJson,
          }),
        },
      ],
      // providerOptions: {
      //   Siliconflow: {
      //     enable_thinking: false,
      //   },
      // },
      tools: {
        memorySearch: memorySearchTool,
        queryStateTool: queryStateTool,
        queryWorldMap: queryWorldMapTool,
      },
      stopWhen: stepCountIs(20),
    });

    return result;
  }

  /**
   * 将群原始消息写入群会话历史，保证裁决模型与回复模型拿到的是同一份上下文。
   */
  public recordGroupMessage(message: StoredGroupMessage, sessionLabel?: string) {
    this.groupSession.recordMessage({
      sessionId: this.buildGroupSessionKey(message.group_id),
      sessionLabel: sessionLabel ?? getGroupDisplayName(message),
      message,
    });
  }

  /**
   * 将私聊原始消息写入私聊会话历史，保证回复模型与真实会话事实源保持一致。
   */
  public recordPrivateMessage(message: StoredPrivateMessage, sessionLabel?: string) {
    this.privateSession.recordMessage({
      sessionId: this.buildPrivateSessionKey(message.user_id),
      sessionLabel: sessionLabel ?? getProtocolMessageSenderName(message),
      message,
    });
  }

  /**
   * 使用小模型判断普通群消息是否值得回复。
   *
   * 说明：
   * - 这里只返回 shouldReply，不承担具体回复生成；
   * - 直接对悠酱说的话（例如 @ 悠酱）不会走这个流程，而是由 handler 直接触发回复模型。
   */
  public async shouldReplyGroupMessage(message: StoredGroupMessage): Promise<boolean> {
    const { historyJson, summary } = await this.groupSession.getHistoryJson(
      this.buildGroupSessionKey(message.group_id),
    );

    const { output } = await generateText({
      model: smallModel,
      // providerOptions: {
      //   Siliconflow: {
      //     enable_thinking: false,
      //   },
      // },
      system: [
        "你是群聊回复裁决器，唯一任务是判断悠酱现在是否应该回复最新一条普通群消息。",
        "你只输出结构化结果中的 shouldReply 布尔值，不负责生成回复内容。",
        "群聊不是私聊，不需要每条都回，更不能抢话。回复策略应该保守，只在必要时才回复。",
        "shouldReply=true 的场景：消息中提到了悠酱，或者明显在和悠酱对话。",
        "其余场景 shouldReply=false。",
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: this.buildHistoryUserPrompt({
            summary,
            historyJson,
          }),
        },
      ],
      output: Output.object({
        schema: z.object({
          shouldReply: z.boolean().describe("是否应该回复这条普通群消息"),
        }),
      }),
    });

    return output.shouldReply;
  }

  /**
   * 使用主回复模型为群聊生成自然语言回复。
   */
  public async chatInGroup(message: StoredGroupMessage) {
    const sessionKey = this.buildGroupSessionKey(message.group_id);
    const { historyJson, summary } = await this.groupSession.getHistoryJson(sessionKey);

    const systemPrompt = [
      getCharacterCardPrompt(),
      "## 当前聊天场景",
      `你现在正在 QQ 群「${getGroupDisplayName(message)}」里说话`,
      `- speaker 为${SUBJECT_NAME}、悠酱，是你之前的发言。`,
    ].join("\n\n");

    const result = await generateText({
      model: deepseekProvider("deepseek-chat"),
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: this.buildHistoryUserPrompt({
            summary,
            historyJson,
          }),
        },
      ],
      // providerOptions: {
      //   Siliconflow: {
      //     enable_thinking: false,
      //   },
      // },
      tools: {
        memorySearch: memorySearchTool,
        queryStateTool: queryStateTool,
        queryWorldMap: queryWorldMapTool,
      },
      stopWhen: stepCountIs(20),
    });

    return result;
  }

  private buildPrivateSessionKey(userId: number): string {
    return `private:${userId}`;
  }

  private buildGroupSessionKey(groupId: number): string {
    return `group:${groupId}`;
  }

  /**
   * 组装传给 LLM 的用户提示词。
   *
   * 说明：
   * - 滚动摘要与结构化历史分章节提供，避免模型把摘要误判成真实消息项；
   * - 历史 JSON 始终只包含原始消息投影，保持结构稳定。
   */
  private buildHistoryUserPrompt(input: { summary?: string; historyJson: string }): string {
    const sections = [];

    if (input.summary) {
      sections.push(["最近会话摘要如下：", input.summary].join("\n\n"));
    }

    sections.push(
      [
        `speaker 为${SUBJECT_NAME}、悠酱，是你之前的发言。最近会话历史 JSON 数组如下：`,
        "```json",
        input.historyJson,
        "```",
      ].join("\n\n"),
    );

    return sections.join("\n\n");
  }
}

// 导出默认实例
export const llmManager = new LLMManager();

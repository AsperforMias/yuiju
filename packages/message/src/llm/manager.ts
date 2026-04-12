import {
  buildMessageHistoryUserPrompt,
  getCharacterCardPrompt,
  getGroupReplyDecisionSystemPrompt,
  memorySearchTool,
  minimaxModel,
  queryStateTool,
  queryWorldMapTool,
  smallModel,
} from "@yuiju/utils";
import { generateText, Output, stepCountIs } from "ai";
import { z } from "zod";
import { stickerState } from "@/state/sticker";
import { logger } from "@/utils/logger";
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
      system: getGroupReplyDecisionSystemPrompt(),
      messages: [
        {
          role: "user",
          content: buildMessageHistoryUserPrompt({
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

    logger.info(`[shouldReplyGroupMessage] ${output.shouldReply ? "回复" : "不回复"}`);

    return output.shouldReply;
  }

  private buildPrivateSessionKey(userId: number): string {
    return `private:${userId}`;
  }

  private buildGroupSessionKey(groupId: number): string {
    return `group:${groupId}`;
  }

  /**
   * 使用主回复模型为群聊生成自然语言回复。
   */
  public async chatInGroup(message: StoredGroupMessage) {
    const sessionKey = this.buildGroupSessionKey(message.group_id);
    const { historyJson, summary } = await this.groupSession.getHistoryJson(sessionKey);

    const systemPrompt = [
      getCharacterCardPrompt(),
      stickerState.buildPromptSection(),
      "## 当前聊天场景",
      `你现在正在 QQ 群「${getGroupDisplayName(message)}」`,
    ].join("\n\n");

    const result = await generateText({
      model: minimaxModel,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: buildMessageHistoryUserPrompt({
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

    logger.info("[message.llm.group] LLM 返回群聊回复", {
      groupName: getGroupDisplayName(message),
      text: result.text,
    });

    return result;
  }

  public async chatWithLLM(message: StoredPrivateMessage) {
    const sessionId = this.buildPrivateSessionKey(message.user_id);
    const { historyJson, summary } = await this.privateSession.getHistoryJson(sessionId);
    const systemPrompt = [getCharacterCardPrompt(), stickerState.buildPromptSection()].join("\n\n");

    const result = await generateText({
      model: minimaxModel,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: buildMessageHistoryUserPrompt({
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

    logger.info("[message.llm.private] LLM 返回私聊回复", {
      sessionLabel: getProtocolMessageSenderName(message),
      text: result.text,
    });

    return result;
  }
}

// 导出默认实例
export const llmManager = new LLMManager();

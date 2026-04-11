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
  type AssistantSentGroupMessage,
  type AssistantSentPrivateMessage,
  getGroupDisplayName,
  getProtocolMessageSenderName,
  type StoredGroupMessage,
  type StoredPrivateMessage,
} from "@/utils/group-message";
import { ChatSessionManager } from "./chat-session-manager";

export class LLMManager {
  private privateSession: ChatSessionManager;
  private groupSession: ChatSessionManager;
  private syntheticMessageId = 0;

  constructor(conversationLimit: number = 10) {
    this.privateSession = new ChatSessionManager({
      conversationLimit,
      windowMs: 2 * 60 * 60 * 1000,
    });
    this.groupSession = new ChatSessionManager({
      conversationLimit: 30,
      // 2小时
      windowMs: 2 * 60 * 60 * 1000,
    });
  }

  public async chatWithLLM(message: StoredPrivateMessage) {
    const sessionId = this.buildPrivateSessionKey(message.user_id);
    const sessionLabel = getProtocolMessageSenderName(message);

    this.privateSession.recordMessage({
      sessionId,
      sessionLabel,
      message,
    });

    const { historyJson, summary } = await this.privateSession.getHistoryJson(sessionId);
    const result = await generateText({
      model: deepseekProvider("deepseek-chat"),
      system: getCharacterCardPrompt({
        userName: sessionLabel,
      }),
      messages: [
        {
          role: "user",
          content: this.buildHistoryUserPrompt({
            taskInstruction: "以下是最近会话历史 JSON 数组，请基于这些上下文继续自然地回复用户。",
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

    this.privateSession.recordMessage({
      sessionId,
      sessionLabel,
      message: this.buildAssistantPrivateMessage(message, result.text),
    });

    return result;
  }

  /**
   * 将群原始消息写入群会话历史，保证裁决模型与回复模型拿到的是同一份上下文。
   */
  public recordGroupMessage(message: StoredGroupMessage) {
    this.groupSession.recordMessage({
      sessionId: this.buildGroupSessionKey(message.group_id),
      sessionLabel: getGroupDisplayName(message),
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
            taskInstruction:
              "以下是最近会话历史 JSON 数组。请只判断悠酱是否应该回复最后一条群消息。",
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

    const result = await generateText({
      model: deepseekProvider("deepseek-chat"),
      system: this.buildGroupReplySystemPrompt(message),
      messages: [
        {
          role: "user",
          content: this.buildHistoryUserPrompt({
            taskInstruction:
              "以下是最近会话历史 JSON 数组，请基于这些上下文，生成一条适合发在当前群里的自然回复。",
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

    this.groupSession.recordMessage({
      sessionId: sessionKey,
      sessionLabel: getGroupDisplayName(message),
      message: this.buildAssistantGroupMessage(message, result.text),
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
  private buildHistoryUserPrompt(input: {
    taskInstruction: string;
    summary?: string;
    historyJson: string;
  }): string {
    const sections = [input.taskInstruction];

    if (input.summary) {
      sections.push(["最近会话摘要如下：", input.summary].join("\n\n"));
    }

    sections.push(
      ["最近会话历史 JSON 数组如下：", "```json", input.historyJson, "```"].join("\n\n"),
    );

    return sections.join("\n\n");
  }

  private buildGroupReplySystemPrompt(message: StoredGroupMessage): string {
    return [
      getCharacterCardPrompt({
        userName: getProtocolMessageSenderName(message),
      }),
      "## 当前聊天场景",
      `你现在正在 QQ 群「${getGroupDisplayName(message)}」里说话`,
      "- 群聊回复要更克制、更自然，像在群里顺手接一句，不要像一对一长聊。",
      "- 你会收到最近会话历史的 JSON 数组，最后一条消息就是当前最新语境的一部分，请结合上下文自然续接。",
      "- 如果这条消息是在直接对你说话，系统可能已经通过回复链路触发你，你不要在正文里手动重复写 @。",
    ].join("\n\n");
  }

  /**
   * 由于当前没有订阅 message_sent 事件，这里手动构造兼容 OneBot 的发送消息结构，
   * 让会话历史仍然能保持“原始协议对象”这一套统一事实源。
   */
  private buildAssistantPrivateMessage(
    message: StoredPrivateMessage,
    content: string,
  ): AssistantSentPrivateMessage {
    const messageId = this.getNextSyntheticMessageId();

    return {
      self_id: message.self_id,
      user_id: message.user_id,
      time: Math.floor(Date.now() / 1000),
      message_id: messageId,
      message_seq: messageId,
      real_id: messageId,
      message_type: "private",
      sender: {
        user_id: message.self_id,
        nickname: SUBJECT_NAME,
        card: SUBJECT_NAME,
      },
      raw_message: content,
      font: message.font,
      sub_type: message.sub_type,
      post_type: "message_sent",
      message_format: "array",
      message: [{ type: "text", data: { text: content } }],
    };
  }

  private buildAssistantGroupMessage(
    message: StoredGroupMessage,
    content: string,
  ): AssistantSentGroupMessage {
    const messageId = this.getNextSyntheticMessageId();

    return {
      self_id: message.self_id,
      user_id: message.user_id,
      time: Math.floor(Date.now() / 1000),
      message_id: messageId,
      message_seq: messageId,
      real_id: messageId,
      message_type: "group",
      sender: {
        user_id: message.self_id,
        nickname: SUBJECT_NAME,
        card: SUBJECT_NAME,
      },
      raw_message: content,
      font: message.font,
      sub_type: "normal",
      post_type: "message_sent",
      group_id: message.group_id,
      message_format: "array",
      message: [{ type: "text", data: { text: content } }],
    };
  }

  private getNextSyntheticMessageId(): number {
    this.syntheticMessageId += 1;
    return Number(`${Date.now()}${this.syntheticMessageId}`);
  }
}

// 导出默认实例
export const llmManager = new LLMManager();

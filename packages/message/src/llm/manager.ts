import {
  getCharacterCardPrompt,
  getMemoryServiceClientFromEnv,
  memorySearchTool,
  queryStateTool,
  queryWorldMapTool,
  qwen3Model,
  smallModel,
} from "@yuiju/utils";
import { generateText, type ModelMessage, Output, stepCountIs } from "ai";
import { z } from "zod";
import { ChatSessionManager, SUBJECT_NAME } from "./chat-session-manager";

export interface GroupConversationInput {
  groupId: number;
  groupName: string;
  senderName: string;
  content: string;
  timestamp: Date;
  isDirectedToBot: boolean;
}

export class LLMManager {
  private memoryClient = getMemoryServiceClientFromEnv();
  private privateSession: ChatSessionManager;
  private groupSession: ChatSessionManager;

  constructor(conversationLimit: number = 10) {
    this.privateSession = new ChatSessionManager({
      conversationLimit,
      memoryClient: this.memoryClient,
      windowMs: 2 * 60 * 60 * 1000,
    });
    this.groupSession = new ChatSessionManager({
      conversationLimit: 30,
      memoryClient: this.memoryClient,
      // 2小时
      windowMs: 2 * 60 * 60 * 1000,
    });
  }

  public async chatWithLLM(input: string, userName: string) {
    const systemPrompt = getCharacterCardPrompt({
      userName,
    });

    this.privateSession.recordMessage({
      sessionId: userName,
      sessionLabel: userName,
      role: "user",
      llmContent: input,
      speakerName: userName,
      timestamp: new Date(),
    });
    const messages: ModelMessage[] = await this.privateSession.getLLMMessages(userName);

    const result = await generateText({
      model: qwen3Model,
      messages,
      system: systemPrompt,
      providerOptions: {
        Siliconflow: {
          enable_thinking: false,
        },
      },
      tools: {
        memorySearch: memorySearchTool,
        queryStateTool: queryStateTool,
        queryWorldMap: queryWorldMapTool,
      },
      stopWhen: stepCountIs(20),
    });

    // 添加助手回复到对话历史
    this.privateSession.recordMessage({
      sessionId: userName,
      sessionLabel: userName,
      role: "assistant",
      llmContent: result.text,
      speakerName: SUBJECT_NAME,
      timestamp: new Date(),
    });

    return result;
  }

  /**
   * 将群消息写入群会话历史，保证裁决模型与回复模型拿到的是同一份上下文。
   */
  public recordGroupMessage(input: GroupConversationInput) {
    this.groupSession.recordMessage({
      sessionId: this.buildGroupSessionKey(input.groupId),
      sessionLabel: input.groupName,
      role: "user",
      llmContent: this.buildGroupUserMessage(input),
      archiveContent: input.content,
      speakerName: input.senderName,
      timestamp: input.timestamp,
    });
  }

  /**
   * 使用小模型判断普通群消息是否值得回复。
   *
   * 说明：
   * - 这里只返回 shouldReply，不承担具体回复生成；
   * - 直接对悠酱说的话（@ 或 reply 悠酱）不会走这个流程，而是由 handler 直接触发回复模型。
   */
  public async shouldReplyGroupMessage(input: GroupConversationInput): Promise<boolean> {
    const messages = await this.groupSession.getLLMMessages(
      this.buildGroupSessionKey(input.groupId),
    );

    const systemPrompt = [
      "你是群聊回复裁决器，唯一任务是判断悠酱现在是否应该回复最新一条普通群消息。",
      "你只输出结构化结果中的 shouldReply 布尔值，不负责生成回复内容。",
      "群聊不是私聊，不需要每条都回，更不能抢话。回复策略应该保守，只在必要时才回复",
      "shouldReply=true 的场景：消息中提到了悠酱、内容和悠酱强相关、有人心情难受需要安慰。",
      "其余场景 shouldReply=false",
    ].join("\n");

    const { output } = await generateText({
      model: smallModel,
      system: systemPrompt,
      messages: [
        ...messages,
        {
          role: "user",
          content: [
            "请只判断上一条最新群消息是否值得悠酱回复",
            `最新发言者：${input.senderName}`,
            `最新消息：${input.content}`,
          ].join("\n"),
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
  public async chatInGroup(input: GroupConversationInput) {
    const sessionKey = this.buildGroupSessionKey(input.groupId);
    const systemPrompt = this.buildGroupReplySystemPrompt(input);
    const messages: ModelMessage[] = await this.groupSession.getLLMMessages(sessionKey);

    const result = await generateText({
      model: qwen3Model,
      messages,
      system: systemPrompt,
      providerOptions: {
        Siliconflow: {
          enable_thinking: false,
        },
      },
      tools: {
        memorySearch: memorySearchTool,
        queryStateTool: queryStateTool,
        queryWorldMap: queryWorldMapTool,
      },
      stopWhen: stepCountIs(20),
    });

    this.groupSession.recordMessage({
      sessionId: sessionKey,
      sessionLabel: input.groupName,
      role: "assistant",
      llmContent: result.text,
      speakerName: SUBJECT_NAME,
      timestamp: new Date(),
    });

    return result;
  }

  private buildGroupSessionKey(groupId: number): string {
    return `group:${groupId}`;
  }

  /**
   * 群聊历史里需要显式保留发言人名字，否则模型无法区分多用户对话。
   */
  private buildGroupUserMessage(input: GroupConversationInput): string {
    return `${input.senderName}：${input.content}`;
  }

  private buildGroupReplySystemPrompt(input: GroupConversationInput): string {
    return [
      getCharacterCardPrompt({
        userName: input.senderName,
      }),
      "## 当前聊天场景",
      `你现在正在 QQ 群「${input.groupName}」里说话`,
      "群聊回复要更克制、更自然，像在群里顺手接一句，不要像一对一长聊。",
      "如果这条消息是在直接对你说话（例如 @ 你或 reply 你），系统已经会自动回复当前这条消息，你不要在正文里手动重复写 @。",
    ].join("\n\n");
  }
}

// 导出默认实例
export const llmManager = new LLMManager();

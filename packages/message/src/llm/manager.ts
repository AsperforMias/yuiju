import process from "node:process";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getCharacterCardPrompt } from "@yuiju/source";
import {
  getMemoryServiceClientFromEnv,
  getRecentBehaviorRecords,
  type IBehaviorRecord,
  initCharacterStateData,
  type MemorySearchItem,
} from "@yuiju/utils";
import { generateText, type ModelMessage } from "ai";
import dayjs from "dayjs";
import { Conversation } from "../conversation";
import { memorySearchTool } from "./tools/memorySearchTool";

export class LLMManager {
  private siliconflowClient: ReturnType<typeof createOpenAICompatible>;
  private conversation: Conversation;
  private memoryClient = getMemoryServiceClientFromEnv();

  constructor(conversationLimit: number = 10) {
    this.siliconflowClient = createOpenAICompatible({
      baseURL: "https://api.siliconflow.cn/v1",
      apiKey: process.env.SILICONFLOW_API_KEY ?? "",
      name: "Siliconflow",
    });
    this.conversation = new Conversation(conversationLimit);
  }

  public addMessage(role: "user" | "assistant", content: string) {
    this.conversation.add(role, content);
  }

  private buildMemoryContextBlock(memoryList: MemorySearchItem[]): string {
    if (memoryList.length === 0) return "";

    const truncated = memoryList.map((m) => {
      const raw = (m.memory || "").trim();
      const text = raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
      const time = m.time ? `（${m.time}）` : "";
      const source = m.source ? `【${m.source}】` : "";
      return `- ${source}${text}${time}`;
    });

    return `\n\n【相关记忆（检索）】\n${truncated.join("\n")}\n`;
  }

  public async chatWithLLM(input: string, userName: string) {
    const behaviorDocs: IBehaviorRecord[] = await getRecentBehaviorRecords(5);
    const recentBehaviorList = behaviorDocs.map((item) => ({
      behavior: item.behavior,
      description: item.description,
      parameters: item.parameters,
      time: dayjs(item.timestamp),
    }));

    const state = await initCharacterStateData();

    const systemPrompt = getCharacterCardPrompt({
      userName,
      recentBehaviorList,
      state,
    });

    const memoryList = this.memoryClient
      ? await this.memoryClient.searchMemory({ user_name: userName, query: input, top_k: 5 })
      : [];
    const systemPromptWithMemory = systemPrompt + this.buildMemoryContextBlock(memoryList);

    // 添加用户输入到对话历史
    this.conversation.add("user", input);

    // 获取对话历史
    const messages: ModelMessage[] = this.conversation.getMessages(input);

    const model = this.siliconflowClient("Qwen/Qwen3-8B");

    const result = await generateText({
      model,
      messages,
      system: systemPromptWithMemory,
      tools: {
        memorySearchTool,
      },
      providerOptions: {
        Siliconflow: {
          enable_thinking: false,
        },
      },
      // stopWhen: stepCountIs(5),
    });

    // 添加助手回复到对话历史
    this.conversation.add("assistant", result.text);

    return result;
  }
}

// 导出默认实例
export const llmManager = new LLMManager();

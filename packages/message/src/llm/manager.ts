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
import { ChatSessionManager } from "../chatSessionManager";
import { memorySearchTool } from "./tools/memorySearchTool";

export class LLMManager {
  private siliconflowClient: ReturnType<typeof createOpenAICompatible>;
  private memoryClient = getMemoryServiceClientFromEnv();
  private session: ChatSessionManager;

  constructor(conversationLimit: number = 10) {
    this.siliconflowClient = createOpenAICompatible({
      baseURL: "https://api.siliconflow.cn/v1",
      apiKey: process.env.SILICONFLOW_API_KEY ?? "",
      name: "Siliconflow",
    });
    this.session = new ChatSessionManager({
      conversationLimit,
      memoryClient: this.memoryClient,
      windowMs: 10 * 60 * 1000,
    });
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
      ? await this.memoryClient.searchMemory({
          query: input,
          top_k: 5,
          counterparty_name: userName,
          is_dev: process.env.NODE_ENV !== "production",
        })
      : [];
    const systemPromptWithMemory = systemPrompt + this.buildMemoryContextBlock(memoryList);

    this.session.recordMessage({
      counterparty_name: userName,
      role: "user",
      content: input,
      timestamp: new Date(),
    });
    const messages: ModelMessage[] = this.session.getLLMMessages(userName);

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
    this.session.recordMessage({
      counterparty_name: userName,
      role: "assistant",
      content: result.text,
      timestamp: new Date(),
    });

    return result;
  }
}

// 导出默认实例
export const llmManager = new LLMManager();

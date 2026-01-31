import process from "node:process";
import { deepseek } from "@ai-sdk/deepseek";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getCharacterCardPrompt } from "@yuiju/source";
import {
  getMemoryServiceClientFromEnv,
  getRecentBehaviorRecords,
  type IBehaviorRecord,
  initCharacterStateData,
} from "@yuiju/utils";
import { generateText, type ModelMessage, stepCountIs } from "ai";
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

    this.session.recordMessage({
      counterparty_name: userName,
      role: "user",
      content: input,
      timestamp: new Date(),
    });
    const messages: ModelMessage[] = this.session.getLLMMessages(userName);

    const model = this.siliconflowClient("Qwen/Qwen3-8B");

    const result = await generateText({
      model: deepseek("deepseek-chat"),
      messages,
      system: systemPrompt,
      tools: {
        memorySearchTool,
      },
      stopWhen: stepCountIs(5),
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

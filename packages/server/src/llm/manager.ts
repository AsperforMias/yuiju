import { createOpenAI } from "@ai-sdk/openai";
import { getCharacterCardPrompt } from "@yuiju/source";
import {
  getRecentBehaviorRecords,
  initCharacterStateData,
  type IBehaviorRecord,
} from "@yuiju/utils";
import { generateText, type ModelMessage } from "ai";
import dayjs from "dayjs";
import { Conversation } from "../conversation";

export class LLMManager {
  private siliconflowClient: ReturnType<typeof createOpenAI>;
  private modelName: string;
  private conversation: Conversation;

  constructor(modelName: string = "Qwen/Qwen3-8B", conversationLimit: number = 10) {
    this.siliconflowClient = createOpenAI({
      baseURL: "https://api.siliconflow.cn/v1",
      apiKey: process.env.SILICONFLOW_API_KEY ?? "",
      name: "Siliconflow",
    });
    this.modelName = modelName;
    this.conversation = new Conversation(conversationLimit);
  }

  public addMessage(role: "user" | "assistant", content: string) {
    this.conversation.add(role, content);
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
    // 添加用户输入到对话历史
    this.conversation.add("user", input);

    // 获取对话历史
    const messages: ModelMessage[] = this.conversation.getMessages(input);

    const model = this.siliconflowClient.chat("Qwen/Qwen3-8B");

    const result = await generateText({
      model,
      messages,
      system: systemPrompt,
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

  public getClient() {
    return this.siliconflowClient.chat(this.modelName);
  }
}

// 导出默认实例
export const llmManager = new LLMManager();

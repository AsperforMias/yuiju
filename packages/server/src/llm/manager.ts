import { createOpenAI } from '@ai-sdk/openai';
import { generateText, type ModelMessage } from 'ai';
import { Conversation } from '../conversation';
import MemoryClient from 'mem0ai';
import { config } from '@/config';
// import { memorySearchTool } from '@/llm/tools/memorySearchTool';
import { getCharacterCardPrompt } from '@yuiju/source';
import dayjs from 'dayjs';
import { getRecentBehaviorRecords, type IBehaviorRecord } from '@yuiju/utils';
import { getCharactorState } from '../state';

export class LLMManager {
  private siliconflowClient: ReturnType<typeof createOpenAI>;
  private modelName: string;
  private conversation: Conversation;
  private mem0Client: MemoryClient;

  constructor(modelName: string = 'Qwen/Qwen3-8B', conversationLimit: number = 10) {
    this.siliconflowClient = createOpenAI({
      baseURL: 'https://api.siliconflow.cn/v1',
      apiKey: process.env.SILICONFLOW_API_KEY ?? '',
      name: 'Siliconflow',
    });
    this.modelName = modelName;
    this.conversation = new Conversation(conversationLimit);
    this.mem0Client = new MemoryClient({ apiKey: config.mem0.apiKey });
  }

  public addMessage(role: 'user' | 'assistant', content: string) {
    this.conversation.add(role, content);
  }

  public async chatWithLLM(input: string, userName: string) {
    const behaviorDocs: IBehaviorRecord[] = await getRecentBehaviorRecords();
    const recentActionList = behaviorDocs.map(doc => ({
      action: doc.behavior,
      reason: doc.description,
      time: dayjs(doc.timestamp),
    }));

    const state = await getCharactorState();

    const systemPrompt = getCharacterCardPrompt({
      userName,
      recentActionList,
      state,
    });
    // 添加用户输入到对话历史
    this.conversation.add('user', input);

    // 获取对话历史
    const messages: ModelMessage[] = this.conversation.getMessages(input);

    const model = this.siliconflowClient.chat('Qwen/Qwen3-8B');

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
      // tools: {
      //   memorySearchTool,
      // },
    });

    // 添加助手回复到对话历史
    this.conversation.add('assistant', result.text);

    // this.mem0Client.add(
    //   [
    //     {
    //       role: 'user',
    //       content: input,
    //     },
    //     {
    //       role: 'assistant',
    //       content: result.text,
    //     },
    //   ],
    //   { user_id: userName }
    // );

    return result;
  }

  public getClient() {
    return this.siliconflowClient.chat(this.modelName);
  }
}

// 导出默认实例
export const llmManager = new LLMManager();

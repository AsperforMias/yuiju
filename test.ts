import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import "dotenv/config";
import { generateText, type LanguageModelMiddleware, wrapLanguageModel } from "ai";

export const logMiddleware: LanguageModelMiddleware = {
  wrapGenerate: async ({ doGenerate }) => {
    const result = await doGenerate();

    console.log(result.content);

    return result;
  },
  specificationVersion: "v3",
};

// 创建 SiliconFlow 客户端
export const siliconflow = createOpenAICompatible({
  baseURL: "https://api.siliconflow.cn/v1",
  apiKey: process.env.SILICONFLOW_API_KEY ?? "",
  name: "Siliconflow",
});

export const aaa = siliconflow("Qwen/Qwen3-8B");

export const model_qwen3_8B = wrapLanguageModel({
  model: aaa,
  middleware: [logMiddleware],
});

async function main() {
  const { text, reasoningText } = await generateText({
    model: model_qwen3_8B,
    prompt: "你好",
    providerOptions: {
      Siliconflow: {
        enable_thinking: true,
      },
    },
  });

  // console.log(text);
  // console.log(reasoningText);
}

main();

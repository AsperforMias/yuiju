import { deepseek } from "@ai-sdk/deepseek";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { type LanguageModelMiddleware, wrapLanguageModel } from "ai";
// import { logger } from "@/utils/logger";

export const logMiddleware: LanguageModelMiddleware = {
  wrapGenerate: async ({ doGenerate }) => {
    const result = await doGenerate();

    // logger.info(result.content);

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

/**
 * 废物
 */
export const model_qwen3_8B = wrapLanguageModel({
  model: siliconflow("Qwen/Qwen3-8B"),
  middleware: [logMiddleware],
});

export const model_deepseek_reasoner = wrapLanguageModel({
  model: deepseek("deepseek-reasoner"),
  middleware: [logMiddleware],
});

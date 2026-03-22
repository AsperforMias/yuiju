import { devToolsMiddleware } from "@ai-sdk/devtools";
import { createMoonshotAI } from "@ai-sdk/moonshotai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { wrapLanguageModel } from "ai";

const moonshotai = createMoonshotAI({
  apiKey: process.env.MOONSHOT_API_KEY ?? "",
  baseURL: "https://api.moonshot.cn/v1",
});

// 创建 SiliconFlow 客户端
export const siliconflow = createOpenAICompatible({
  baseURL: "https://api.siliconflow.cn/v1",
  apiKey: process.env.SILICONFLOW_API_KEY ?? "",
  name: "Siliconflow",
  supportsStructuredOutputs: false,
});

/**
 * 废物
 */
export const small_modal = wrapLanguageModel({
  model: siliconflow("Qwen/Qwen3-8B"),
  middleware: [devToolsMiddleware()],
});

export const strong_model = wrapLanguageModel({
  model: moonshotai("kimi-k2.5"),
  middleware: [devToolsMiddleware()],
});

export const minimax_model = wrapLanguageModel({
  model: siliconflow("Pro/MiniMaxAI/MiniMax-M2.5"),
  middleware: [devToolsMiddleware()],
});

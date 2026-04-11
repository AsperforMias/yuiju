import * as readline from "node:readline";
import { connectDB } from "@yuiju/utils";
import { llmManager } from "./llm/manager";
import type { StoredPrivateMessage } from "./utils/group-message";

connectDB();

// 设置终端输入输出接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

rl.prompt();

// 监听终端输入事件
rl.on("line", async (input) => {
  if (!input.trim()) {
    rl.prompt();
    return;
  }

  try {
    const message: StoredPrivateMessage = {
      self_id: 0,
      user_id: 1,
      time: Math.floor(Date.now() / 1000),
      message_id: Date.now(),
      message_seq: Date.now(),
      real_id: Date.now(),
      message_type: "private",
      sender: {
        user_id: 1,
        nickname: "翊小久",
        card: "",
      },
      raw_message: input.trim(),
      font: 0,
      sub_type: "friend",
      post_type: "message",
      message_format: "array",
      message: [{ type: "text", data: { text: input.trim() } }],
    };

    // 调用DeepSeek API生成回复
    const { text } = await llmManager.chatWithLLM(message);

    const reply = (text || "").trim() || "Error：未获取到回复";

    // 输出回复到终端
    console.log(`悠酱: ${reply}`);
  } catch (error) {
    console.error("发生错误:", error instanceof Error ? error.message : String(error));
  } finally {
    rl.prompt();
  }
});

// 监听退出事件
rl.on("close", () => {
  console.log("对话已结束，再见！");
  process.exit(0);
});

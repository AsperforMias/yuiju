import "@yuiju/utils/env";
import { connectDB, saveQQMessage } from "@yuiju/utils";
import { type AllHandlers, NCWebsocket, Structs } from "node-napcat-ts";
import { config } from "@/config";
import { llmManager } from "./llm/manager";

const whiteList = config.whiteList;

const napcat = new NCWebsocket(
  {
    ...config.napcat,
    accessToken: process.env.NAPCAT_TOKEN || "",
    throwPromise: true,
  },
  false,
);

// 背后调用的接口是 .handle_quick_operation
// 只支持 message request 这两个事件
napcat.on("message.private", messageHandler);

async function messageHandler(context: AllHandlers["message.private"]) {
  let receiveMessage: string | null = null;
  for (const item of context.message) {
    if (item.type === "text") {
      receiveMessage = item.data.text;
    }
  }

  if (!receiveMessage) {
    return;
  }

  if (!whiteList.includes(context.sender.user_id) && !context.sender.nickname) {
    return;
  }

  console.log(
    `收到来自 ${context.sender.nickname}(${context.sender.user_id}) 的消息: ${receiveMessage}`,
  );
  const userName = context.sender.nickname || String(context.sender.user_id);
  const now = new Date();

  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      await context.quick_action([Structs.text("DeepSeek 未配置，稍后再试呢~")]);
      return;
    }

    const { text } = await llmManager.chatWithLLM(receiveMessage, userName);

    const reply = (text || "").trim() || "呜…这句话我一时没理解呢。";
    console.log(`回复给 ${context.sender.nickname}(${context.sender.user_id}) 的消息: ${reply}`);

    saveQQMessage({
      user_name: userName,
      role: "user",
      content: receiveMessage,
      timestamp: now,
      senderName: context.sender.nickname || undefined,
    });

    const replyTs = new Date();
    saveQQMessage({
      user_name: userName,
      role: "assistant",
      content: reply,
      timestamp: replyTs,
      senderName: context.sender.nickname || undefined,
    });

    await context.quick_action([Structs.text(reply)]);
  } catch (error) {
    console.log(error);
    await context.quick_action([Structs.text("小久刚刚摔了一跤，重试下呀~")]);
  }
}

async function main() {
  await connectDB();
  await napcat.connect();
}

main();

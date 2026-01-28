import mongoose, { Document, Schema } from "mongoose";

/**
 * QQ 私聊消息（原始落库记录）。
 *
 * 说明：
 * - user_name 作为记忆主体（与记忆服务的 user_name 对齐）
 * - role 区分用户消息与助手回复，便于拼接 chat_window episode
 * - senderName 保留兼容历史字段（新写入会同时写入 user_name 与 senderName）
 */
export interface IQQChatMessage extends Document {
  user_name: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  senderName?: string;
}

// 定义Schema
const QQMessageSchema = new Schema<IQQChatMessage>({
  user_name: { type: String, required: true, index: true },
  role: { type: String, required: true, enum: ["user", "assistant"], index: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  senderName: { type: String, required: false },
});

// 创建并导出模型
export const QQMessageModel = mongoose.model<IQQChatMessage>("QQMessage", QQMessageSchema);

// 封装数据库写入操作 - 保存消息
export const saveQQMessage = async (messageData: Partial<IQQChatMessage>) => {
  const message = new QQMessageModel(messageData);
  return await message.save();
};

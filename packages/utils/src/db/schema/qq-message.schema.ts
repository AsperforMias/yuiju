import mongoose, { Document, Schema } from "mongoose";

// 定义接口
export interface IQQChatMessage extends Document {
  senderName: string;
  content: string;
  timestamp: Date;
}

// 定义Schema
const QQMessageSchema = new Schema<IQQChatMessage>({
  senderName: { type: String, required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

// 创建并导出模型
export const QQMessageModel = mongoose.model<IQQChatMessage>("QQMessage", QQMessageSchema);

// 封装数据库写入操作 - 保存消息
export const saveQQMessage = async (messageData: Partial<IQQChatMessage>) => {
  const message = new QQMessageModel(messageData);
  return await message.save();
};

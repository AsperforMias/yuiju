import mongoose, { Document, Schema } from 'mongoose';

// 定义接口
export interface IActionSchema extends Document {
  action_id: string;
  reason: string;
  create_time: Date;
}

// 定义Schema
const ActionSchema = new Schema<IActionSchema>({
  action_id: { type: String, required: true },
  reason: { type: String, required: true },
  create_time: { type: Date, default: Date.now },
});

export const ActionModel = mongoose.model<IActionSchema>('Action', ActionSchema);

// 封装数据库写入操作 - 保存 Action
export async function saveAction(actionData: Partial<IActionSchema>) {
  const action = new ActionModel(actionData);
  return await action.save();
}

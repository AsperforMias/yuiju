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

export const ActionModal = mongoose.model<IActionSchema>('Action', ActionSchema);


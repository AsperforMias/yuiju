import dayjs from "dayjs";
import mongoose, { type Document, Schema } from "mongoose";

/**
 * 行为记录接口
 */
export interface IBehaviorRecord extends Document {
  /** 行为/事件类型 */
  behavior: string;
  /** 行为描述 */
  description: string;
  /** 发生时间 */
  timestamp: Date;
  /** 触发来源：agent（LLM）、user（用户）、system（系统） */
  trigger: "agent" | "user" | "system";
  /** 行为持续时间（分钟） */
  duration_minutes?: number;
}

// 定义 Schema
const BehaviorRecordSchema = new Schema<IBehaviorRecord>({
  behavior: { type: String, required: true, index: true },
  description: { type: String, required: true },
  timestamp: { type: Date, required: true, default: Date.now, index: true },
  trigger: {
    type: String,
    enum: ["agent", "user", "system"],
    required: true,
    default: "agent",
    index: true,
  },
  duration_minutes: { type: Number },
});

// 复合索引优化查询性能
BehaviorRecordSchema.index({ timestamp: -1 });
BehaviorRecordSchema.index({ trigger: 1, timestamp: -1 });
BehaviorRecordSchema.index({ behavior: 1, timestamp: -1 });

export const BehaviorRecordModel = mongoose.model<IBehaviorRecord>(
  "BehaviorRecord",
  BehaviorRecordSchema,
);

/**
 * 保存行为记录到数据库
 * @param behaviorData 行为数据（所有字段可选）
 * @returns 保存后的行为记录文档
 */
export async function saveBehaviorRecord(behaviorData: Partial<IBehaviorRecord>) {
  const behavior = new BehaviorRecordModel(behaviorData);
  return await behavior.save();
}

/**
 * 获取最近的行为记录
 * @param limit 返回的记录数量，默认为 10
 * @returns 按时间倒序排列的行为记录列表
 */
export async function getRecentBehaviorRecords(limit: number = 10) {
  const startOfToday = dayjs().startOf("day");
  const startOfTomorrow = startOfToday.add(1, "day");

  return await BehaviorRecordModel.find({
    timestamp: { $gte: startOfToday.toDate(), $lt: startOfTomorrow.toDate() },
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .exec();
}

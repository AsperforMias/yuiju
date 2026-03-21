import dayjs from "dayjs";
import mongoose, { type Document, Schema } from "mongoose";
import { connectDB } from "../connect";

/**
 * MongoDB 中的 Diary 条目。
 *
 * 说明：
 * - diaryDate 统一归一化到自然日零点，确保“一天一篇”约束稳定；
 * - text 保留完整日记正文，不额外拆分标题、摘要等结构；
 * - generatedAt / updatedAt 手动维护，避免引入与业务无关的 createdAt。
 */
export interface IMemoryDiary extends Document {
  subject: string;
  diaryDate: Date;
  text: string;
  generatedAt: Date;
  updatedAt: Date;
  isDev: boolean;
}

const MemoryDiarySchema = new Schema<IMemoryDiary>(
  {
    subject: { type: String, required: true, index: true },
    diaryDate: { type: Date, required: true, index: true },
    text: { type: String, required: true },
    generatedAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    isDev: { type: Boolean, required: true, default: false, index: true },
  },
  {
    collection: "memory_diary",
  },
);

MemoryDiarySchema.index({ subject: 1, diaryDate: 1, isDev: 1 }, { unique: true });

export const MemoryDiaryModel =
  (mongoose.models.MemoryDiary as mongoose.Model<IMemoryDiary> | undefined) ??
  mongoose.model<IMemoryDiary>("MemoryDiary", MemoryDiarySchema);

export interface MemoryDiaryWriteInput {
  subject: string;
  diaryDate: Date;
  text: string;
  isDev?: boolean;
}

export interface GetMemoryDiariesOptions {
  limit?: number;
  subject?: string;
  isDev?: boolean;
  onlyDate?: Date;
  diaryDateAfter?: Date;
  diaryDateBefore?: Date;
  sortDirection?: "asc" | "desc";
}

function normalizeDiaryDate(value: Date): Date {
  return dayjs(value).startOf("day").toDate();
}

/**
 * 按“同主体 + 同自然日”幂等写入或覆盖日记。
 */
export async function upsertMemoryDiary(input: MemoryDiaryWriteInput): Promise<IMemoryDiary> {
  await connectDB();

  const diaryDate = normalizeDiaryDate(input.diaryDate);
  const now = new Date();

  const diary = await MemoryDiaryModel.findOneAndUpdate(
    {
      subject: input.subject,
      diaryDate,
      isDev: input.isDev ?? false,
    },
    {
      $set: {
        text: input.text,
        generatedAt: now,
        updatedAt: now,
      },
      $setOnInsert: {
        subject: input.subject,
        diaryDate,
        isDev: input.isDev ?? false,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  ).exec();

  if (!diary) {
    throw new Error("upsertMemoryDiary failed");
  }

  return diary;
}

/**
 * 查询 Diary 条目。
 *
 * 说明：
 * - onlyDate 用于自然日精确匹配；
 * - 区间查询统一按 diaryDate 过滤，适配昨天及更早的日记回忆。
 */
export async function getMemoryDiaries(
  options: GetMemoryDiariesOptions = {},
): Promise<IMemoryDiary[]> {
  await connectDB();

  const filter: Record<string, unknown> = {};
  if (options.subject) {
    filter.subject = options.subject;
  }
  if (typeof options.isDev === "boolean") {
    filter.isDev = options.isDev;
  }
  if (options.onlyDate) {
    filter.diaryDate = normalizeDiaryDate(options.onlyDate);
  } else if (options.diaryDateAfter || options.diaryDateBefore) {
    filter.diaryDate = {};
    if (options.diaryDateAfter) {
      (filter.diaryDate as Record<string, Date>).$gte = normalizeDiaryDate(options.diaryDateAfter);
    }
    if (options.diaryDateBefore) {
      (filter.diaryDate as Record<string, Date>).$lt = normalizeDiaryDate(options.diaryDateBefore);
    }
  }

  const sortDirection = options.sortDirection === "asc" ? 1 : -1;

  return await MemoryDiaryModel.find(filter)
    .sort({ diaryDate: sortDirection, updatedAt: sortDirection })
    .limit(options.limit ?? 10)
    .exec();
}

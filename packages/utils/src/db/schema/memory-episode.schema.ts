import dayjs from "dayjs";
import mongoose, { type Document, Schema } from "mongoose";
import type {
  MemoryEpisodeExtractionStatus,
  MemoryEpisodeSource,
  MemoryEpisodeType,
  MemoryEpisodeWriteInput,
} from "../../memory/episode";
import { connectDB } from "../connect";

/**
 * MongoDB 中的统一 Episode 文档。
 *
 * 说明：
 * - payload 使用 Mixed，允许不同事件类型保存各自的结构化明细；
 * - summaryText 作为当前检索与展示的主摘要字段；
 * - createdAt / updatedAt 由 mongoose timestamps 自动维护。
 */
export interface IMemoryEpisode extends Document {
  source: MemoryEpisodeSource;
  type: MemoryEpisodeType;
  subjectId: string;
  counterpartyId?: string;
  happenedAt: Date;
  summaryText: string;
  importance: number;
  payload: Record<string, unknown>;
  extractionStatus: MemoryEpisodeExtractionStatus;
  extractedFactIds?: string[];
  isDev: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MemoryEpisodeSchema = new Schema<IMemoryEpisode>(
  {
    source: {
      type: String,
      enum: ["world_tick", "chat", "system"],
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["behavior", "conversation", "plan_update", "system"],
      required: true,
      index: true,
    },
    subjectId: { type: String, required: true, index: true },
    counterpartyId: { type: String, required: false, index: true },
    happenedAt: { type: Date, required: true, index: true },
    summaryText: { type: String, required: true },
    importance: { type: Number, required: true, default: 0.5 },
    payload: { type: Schema.Types.Mixed, required: true },
    extractionStatus: {
      type: String,
      enum: ["pending", "processing", "done", "skipped", "failed"],
      required: true,
      default: "pending",
      index: true,
    },
    extractedFactIds: {
      type: [String],
      required: false,
      default: undefined,
    },
    isDev: { type: Boolean, required: true, default: false, index: true },
  },
  {
    timestamps: true,
    collection: "memory_episode",
  },
);

MemoryEpisodeSchema.index({ subjectId: 1, happenedAt: -1 });
MemoryEpisodeSchema.index({ subjectId: 1, type: 1, happenedAt: -1 });
MemoryEpisodeSchema.index({ subjectId: 1, isDev: 1, happenedAt: -1 });

export const MemoryEpisodeModel =
  (mongoose.models.MemoryEpisode as mongoose.Model<IMemoryEpisode> | undefined) ??
  mongoose.model<IMemoryEpisode>("MemoryEpisode", MemoryEpisodeSchema);

export interface GetRecentMemoryEpisodesOptions {
  limit?: number;
  types?: MemoryEpisodeType[];
  subjectId?: string;
  isDev?: boolean;
  onlyToday?: boolean;
}

/**
 * 保存统一 Episode 到 MongoDB。
 */
export async function saveMemoryEpisode(input: MemoryEpisodeWriteInput): Promise<IMemoryEpisode> {
  await connectDB();
  const episode = new MemoryEpisodeModel({
    ...input,
    payload: input.payload as Record<string, unknown>,
    isDev: input.isDev ?? false,
  });
  return await episode.save();
}

/**
 * 更新 Episode 的抽取状态与已写入事实列表。
 */
export async function updateMemoryEpisodeExtraction(
  episodeId: string,
  input: {
    extractionStatus: MemoryEpisodeExtractionStatus;
    extractedFactIds?: string[];
  },
): Promise<void> {
  await connectDB();
  await MemoryEpisodeModel.findByIdAndUpdate(episodeId, {
    extractionStatus: input.extractionStatus,
    extractedFactIds: input.extractedFactIds,
  }).exec();
}

/**
 * 查询最近 Episode。
 *
 * 说明：
 * - 默认按发生时间倒序返回；
 * - onlyToday 用于兼容当前“只看今天最近行为”的既有逻辑。
 */
export async function getRecentMemoryEpisodes(
  options: GetRecentMemoryEpisodesOptions = {},
): Promise<IMemoryEpisode[]> {
  await connectDB();

  const filter: Record<string, unknown> = {};
  if (options.types?.length) {
    filter.type = { $in: options.types };
  }
  if (options.subjectId) {
    filter.subjectId = options.subjectId;
  }
  if (typeof options.isDev === "boolean") {
    filter.isDev = options.isDev;
  }
  if (options.onlyToday) {
    const startOfToday = dayjs().startOf("day");
    const startOfTomorrow = startOfToday.add(1, "day");
    filter.happenedAt = {
      $gte: startOfToday.toDate(),
      $lt: startOfTomorrow.toDate(),
    };
  }

  return await MemoryEpisodeModel.find(filter)
    .sort({ happenedAt: -1, createdAt: -1 })
    .limit(options.limit ?? 10)
    .exec();
}

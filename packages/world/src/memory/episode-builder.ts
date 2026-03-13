import type {
  ActionAgentDecision,
  ActionContext,
  MemoryEpisode,
  PlanChange,
} from "@yuiju/utils";
import { ActionId, DEFAULT_MEMORY_SUBJECT_ID } from "@yuiju/utils";
const DEFAULT_IMPORTANCE = 0.5;

export interface BuildBehaviorEpisodeInput {
  context: ActionContext;
  selectedAction: ActionAgentDecision;
  executionResult?: string;
  durationMinutes: number;
  relatedPlanId?: string;
  happenedAt: Date;
  isDev: boolean;
}

export interface BuildPlanUpdateEpisodesInput {
  changes: PlanChange[];
  happenedAt: Date;
  isDev: boolean;
}

interface PlanUpdateEpisodePayload {
  planId: string;
  planScope: "main" | "active";
  changeType: "created" | "updated" | "completed" | "cancelled" | "replaced";
  before?: {
    id: string;
    title: string;
    status: string;
  };
  after?: {
    id: string;
    title: string;
    status: string;
  };
  changeReason: string;
}

interface BehaviorEpisodePayload {
  action: ActionId;
  reason: string;
  executionResult?: string;
  durationMinutes: number;
  relatedPlanId?: string;
  location: ActionContext["characterState"]["location"];
  characterStateSnapshot: ReturnType<ActionContext["characterState"]["log"]>;
}

/**
 * 构建行为 Episode。
 *
 * 说明：
 * - 当前只负责把 world 领域上下文映射为统一 Episode；
 * - 不负责真正写入 Graphiti，写入动作由上层 writer 决定。
 */
export function buildBehaviorEpisode(
  input: BuildBehaviorEpisodeInput,
): MemoryEpisode<BehaviorEpisodePayload> | null {
  if (input.selectedAction.action === ActionId.Idle) {
    return null;
  }

  const summaryText = [
    `悠酱执行了行为「${input.selectedAction.action}」`,
    `原因：${input.selectedAction.reason}`,
    input.executionResult ? `结果：${input.executionResult}` : undefined,
    `持续时间：${input.durationMinutes} 分钟`,
  ]
    .filter(Boolean)
    .join("；");

  return {
    source: "world_tick",
    type: "behavior",
    subjectId: DEFAULT_MEMORY_SUBJECT_ID,
    happenedAt: input.happenedAt,
    summaryText,
    importance: DEFAULT_IMPORTANCE,
    extractionStatus: "pending",
    isDev: input.isDev,
    payload: {
      action: input.selectedAction.action,
      reason: input.selectedAction.reason,
      executionResult: input.executionResult,
      durationMinutes: input.durationMinutes,
      relatedPlanId: input.relatedPlanId,
      location: input.context.characterState.location,
      characterStateSnapshot: input.context.characterState.log(),
    },
  };
}

/**
 * 构建轻量计划变更 Episode 列表。
 *
 * 说明：
 * - 当前阶段只记录字段值是否发生变化；
 * - 不引入 planId / 生命周期管理，避免与阶段三的计划模块设计耦合。
 */
export function buildPlanUpdateEpisodes(
  input: BuildPlanUpdateEpisodesInput,
): MemoryEpisode<PlanUpdateEpisodePayload>[] {
  return input.changes.map((change) =>
    createPlanUpdateEpisode({
      planId: change.planId,
      planScope: change.scope,
      changeType: change.changeType,
      before: change.before
        ? {
            id: change.before.id,
            title: change.before.title,
            status: change.before.status,
          }
        : undefined,
      after: change.after
        ? {
            id: change.after.id,
            title: change.after.title,
            status: change.after.status,
          }
        : undefined,
      happenedAt: input.happenedAt,
      isDev: input.isDev,
    }),
  );
}

function createPlanUpdateEpisode(input: {
  planId: string;
  planScope: "main" | "active";
  changeType: "created" | "updated" | "completed" | "cancelled" | "replaced";
  before?: {
    id: string;
    title: string;
    status: string;
  };
  after?: {
    id: string;
    title: string;
    status: string;
  };
  happenedAt: Date;
  isDev: boolean;
}): MemoryEpisode<PlanUpdateEpisodePayload> {
  const scopeText = input.planScope === "main" ? "主计划" : "活跃计划";
  const changeReason = `本次 tick ${describeChangeType(input.changeType)}${scopeText}`;

  return {
    source: "world_tick",
    type: "plan_update",
    subjectId: DEFAULT_MEMORY_SUBJECT_ID,
    happenedAt: input.happenedAt,
    summaryText: [
      `悠酱${describeChangeType(input.changeType)}${scopeText}`,
      `原计划：${stringifyPlanValue(input.before?.title)}`,
      `新计划：${stringifyPlanValue(input.after?.title)}`,
    ].join("；"),
    importance: DEFAULT_IMPORTANCE,
    extractionStatus: "pending",
    isDev: input.isDev,
    payload: {
      planId: input.planId,
      planScope: input.planScope,
      changeType: input.changeType,
      before: input.before,
      after: input.after,
      changeReason,
    },
  };
}

function stringifyPlanValue(value?: string | string[]): string {
  if (value === undefined) {
    return "无";
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join("、") : "空列表";
  }

  return value || "空字符串";
}

function describeChangeType(changeType: PlanUpdateEpisodePayload["changeType"]): string {
  switch (changeType) {
    case "created":
      return "创建了";
    case "updated":
      return "更新了";
    case "completed":
      return "完成了";
    case "cancelled":
      return "取消了";
    case "replaced":
      return "替换了";
    default:
      return "更新了";
  }
}

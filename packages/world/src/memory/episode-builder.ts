import type {
  ActionAgentDecision,
  ActionContext,
  CharacterStateData,
  MemoryEpisode,
} from "@yuiju/utils";
import { ActionId, DEFAULT_MEMORY_SUBJECT_ID } from "@yuiju/utils";
const DEFAULT_IMPORTANCE = 0.5;

export interface BuildBehaviorEpisodeInput {
  context: ActionContext;
  selectedAction: ActionAgentDecision;
  executionResult?: string;
  durationMinutes: number;
  happenedAt: Date;
  isDev: boolean;
}

export interface BuildPlanUpdateEpisodesInput {
  previousLongTermPlan?: string;
  nextLongTermPlan?: string;
  previousShortTermPlan?: string[];
  nextShortTermPlan?: string[];
  happenedAt: Date;
  isDev: boolean;
}

interface PlanUpdateEpisodePayload {
  planScope: "long_term" | "short_term";
  before?: string | string[];
  after?: string | string[];
  changeReason: string;
}

interface BehaviorEpisodePayload {
  action: ActionId;
  reason: string;
  executionResult?: string;
  durationMinutes: number;
  location: ActionContext["characterState"]["location"];
  characterStateSnapshot: CharacterStateData;
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
  const episodes: MemoryEpisode<PlanUpdateEpisodePayload>[] = [];

  if (input.previousLongTermPlan !== input.nextLongTermPlan) {
    episodes.push(
      createPlanUpdateEpisode({
        planScope: "long_term",
        before: input.previousLongTermPlan,
        after: input.nextLongTermPlan,
        happenedAt: input.happenedAt,
        isDev: input.isDev,
      }),
    );
  }

  if (!isSameStringArray(input.previousShortTermPlan, input.nextShortTermPlan)) {
    episodes.push(
      createPlanUpdateEpisode({
        planScope: "short_term",
        before: input.previousShortTermPlan,
        after: input.nextShortTermPlan,
        happenedAt: input.happenedAt,
        isDev: input.isDev,
      }),
    );
  }

  return episodes;
}

function createPlanUpdateEpisode(input: {
  planScope: "long_term" | "short_term";
  before?: string | string[];
  after?: string | string[];
  happenedAt: Date;
  isDev: boolean;
}): MemoryEpisode<PlanUpdateEpisodePayload> {
  const changeReason =
    input.planScope === "long_term" ? "本次 tick 更新了长期计划" : "本次 tick 更新了短期计划";

  return {
    source: "world_tick",
    type: "plan_update",
    subjectId: DEFAULT_MEMORY_SUBJECT_ID,
    happenedAt: input.happenedAt,
    summaryText: [
      `悠酱更新了${input.planScope === "long_term" ? "长期计划" : "短期计划"}`,
      `原计划：${stringifyPlanValue(input.before)}`,
      `新计划：${stringifyPlanValue(input.after)}`,
    ].join("；"),
    importance: DEFAULT_IMPORTANCE,
    extractionStatus: "pending",
    isDev: input.isDev,
    payload: {
      planScope: input.planScope,
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

function isSameStringArray(left?: string[], right?: string[]): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return !left && !right;
  }

  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => item === right[index]);
}

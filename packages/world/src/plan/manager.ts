import type {
  PlanApplyResult,
  PlanChange,
  PlanItem,
  PlanProposal,
  PlanScope,
  PlanSource,
  PlanState,
} from "@yuiju/utils";
import { initPlanStateData, savePlanStateData } from "@yuiju/utils";

function createStablePlanId(scope: PlanScope, title: string): string {
  const raw = `${scope}:${title}`;
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }
  return `plan_${hash.toString(16)}`;
}

function createPlanItem(input: {
  scope: PlanScope;
  title: string;
  nowIso: string;
  parentPlanId?: string;
  reason?: string;
  source?: PlanSource;
  expiresAt?: string;
}): PlanItem {
  return {
    id: createStablePlanId(input.scope, input.title),
    title: input.title,
    scope: input.scope,
    status: "active",
    parentPlanId: input.parentPlanId,
    reason: input.reason,
    source: input.source ?? "llm",
    expiresAt: input.expiresAt,
    createdAt: input.nowIso,
    updatedAt: input.nowIso,
  };
}

function clonePlanState(state: PlanState): PlanState {
  return {
    longTermPlanId: state.longTermPlanId,
    shortTermPlanIds: [...state.shortTermPlanIds],
    longTermPlan: state.longTermPlan ? { ...state.longTermPlan } : undefined,
    shortTermPlans: state.shortTermPlans.map((plan) => ({ ...plan })),
    updatedAt: state.updatedAt,
  };
}

function clonePlanItem(plan?: PlanItem): PlanItem | undefined {
  return plan ? { ...plan } : undefined;
}

function hasMeaningfulPlanChanges(input: { previous?: PlanItem; next: PlanItem }): boolean {
  const previous = input.previous;
  if (!previous) {
    return true;
  }

  return (
    previous.title !== input.next.title ||
    previous.parentPlanId !== input.next.parentPlanId ||
    previous.reason !== input.next.reason ||
    previous.source !== input.next.source ||
    previous.expiresAt !== input.next.expiresAt
  );
}

function markPlanTerminal(
  plan: PlanItem,
  status: "completed" | "abandoned" | "superseded",
  nowIso: string,
): PlanItem {
  return {
    ...plan,
    status,
    updatedAt: nowIso,
  };
}

function rebuildPlanReferences(state: PlanState): void {
  state.longTermPlanId = state.longTermPlan?.id;
  state.shortTermPlanIds = state.shortTermPlans.map((plan) => plan.id);
}

function createApplyResult(state: PlanState, changes: PlanChange[]): PlanApplyResult {
  return {
    state,
    changes,
    relatedPlanId: state.shortTermPlanIds[0] ?? state.longTermPlanId,
  };
}

/**
 * 计划状态管理器。
 *
 * 说明：
 * - 计划状态以 Redis `plan_state` 为唯一真相源；
 * - 显式维护 longTermPlanId / shortTermPlanIds 引用层，避免后续只靠对象嵌套推导当前短期计划；
 * - proposal 中未显式提供的字段视为“不更新”，从而把计划变更改为按条件触发。
 */
export class PlanManager {
  private static instance: PlanManager | null = null;

  static getInstance(): PlanManager {
    if (!PlanManager.instance) {
      PlanManager.instance = new PlanManager();
    }
    return PlanManager.instance;
  }

  async getState(): Promise<PlanState> {
    return await initPlanStateData();
  }

  /**
   * 显式完成计划。
   *
   * 说明：
   * - completed 只负责声明“该计划已经完成”，并将其从 Redis 运行态中移除；
   * - 关联中的短期计划不会被强制终止，但会同步更新 parentPlanId，避免悬挂引用。
   */
  async completePlan(planId: string): Promise<PlanApplyResult> {
    return await this.transitionPlanToTerminal({
      planId,
      status: "completed",
    });
  }

  /**
   * 显式放弃计划。
   */
  async abandonPlan(planId: string): Promise<PlanApplyResult> {
    return await this.transitionPlanToTerminal({
      planId,
      status: "abandoned",
    });
  }

  /**
   * 清理当前运行态中可能残留的终态计划。
   *
   * 说明：
   * - 历史终态应只通过 Episode 回溯，不继续停留在 Redis plan_state；
   * - 该方法可作为补偿清理入口，避免旧数据或异常写入导致状态膨胀。
   */
  async cleanupTerminalPlans(): Promise<PlanApplyResult> {
    const currentState = clonePlanState(await this.getState());
    const nowIso = new Date().toISOString();
    const changes: PlanChange[] = [];

    if (currentState.longTermPlan && currentState.longTermPlan.status !== "active") {
      changes.push({
        planId: currentState.longTermPlan.id,
        scope: "longTerm",
        changeType: currentState.longTermPlan.status,
        before: clonePlanItem(currentState.longTermPlan),
        after: clonePlanItem(currentState.longTermPlan),
      });
      currentState.longTermPlan = undefined;
      currentState.longTermPlanId = undefined;
    }

    const shortTermPlans = currentState.shortTermPlans.filter((plan) => {
      if (plan.status === "active") {
        return true;
      }

      changes.push({
        planId: plan.id,
        scope: "shortTerm",
        changeType: plan.status,
        before: clonePlanItem(plan),
        after: clonePlanItem(plan),
      });
      return false;
    });

    currentState.shortTermPlans = shortTermPlans;
    rebuildPlanReferences(currentState);
    this.syncShortTermPlanParentReferences(currentState, changes, nowIso);
    currentState.updatedAt = nowIso;

    await savePlanStateData(currentState);
    return createApplyResult(currentState, changes);
  }

  /**
   * 应用计划建议，返回计划变更结果。
   *
   */
  async applyProposal(proposal: PlanProposal): Promise<PlanApplyResult> {
    const currentState = clonePlanState(await this.getState());
    const nowIso = new Date().toISOString();
    const changes: PlanChange[] = [];
    const defaultSource = proposal.source ?? "llm";
    const longTermPlanExplicitlyProvided = Object.hasOwn(proposal, "longTermPlanTitle");
    const shortTermPlansExplicitlyProvided = Object.hasOwn(proposal, "shortTermPlanTitles");

    const previousLongTermPlan = clonePlanItem(currentState.longTermPlan);

    if (longTermPlanExplicitlyProvided) {
      const nextLongTermTitle = proposal.longTermPlanTitle;

      if (!nextLongTermTitle && previousLongTermPlan) {
        changes.push({
          planId: previousLongTermPlan.id,
          scope: "longTerm",
          changeType: "abandoned",
          before: previousLongTermPlan,
          after: markPlanTerminal(previousLongTermPlan, "abandoned", nowIso),
        });
        currentState.longTermPlan = undefined;
        currentState.longTermPlanId = undefined;
      } else if (nextLongTermTitle) {
        if (!previousLongTermPlan) {
          currentState.longTermPlan = createPlanItem({
            scope: "longTerm",
            title: nextLongTermTitle,
            nowIso,
            reason: proposal.reason,
            source: defaultSource,
            expiresAt: proposal.expiresAt,
          });
          currentState.longTermPlanId = currentState.longTermPlan.id;
          changes.push({
            planId: currentState.longTermPlan.id,
            scope: "longTerm",
            changeType: "created",
            after: clonePlanItem(currentState.longTermPlan),
          });
        } else if (previousLongTermPlan.title !== nextLongTermTitle) {
          const nextLongTermPlan = createPlanItem({
            scope: "longTerm",
            title: nextLongTermTitle,
            nowIso,
            reason: proposal.reason,
            source: defaultSource,
            expiresAt: proposal.expiresAt,
          });
          changes.push({
            planId: previousLongTermPlan.id,
            scope: "longTerm",
            changeType: "superseded",
            before: previousLongTermPlan,
            after: markPlanTerminal(previousLongTermPlan, "superseded", nowIso),
          });
          currentState.longTermPlan = nextLongTermPlan;
          currentState.longTermPlanId = nextLongTermPlan.id;
          changes.push({
            planId: nextLongTermPlan.id,
            scope: "longTerm",
            changeType: "created",
            after: clonePlanItem(nextLongTermPlan),
          });
        } else {
          const updatedLongTermPlan: PlanItem = {
            ...previousLongTermPlan,
            parentPlanId: undefined,
            reason: proposal.reason ?? previousLongTermPlan.reason,
            source: defaultSource,
            expiresAt: proposal.expiresAt ?? previousLongTermPlan.expiresAt,
            updatedAt: nowIso,
          };

          if (
            hasMeaningfulPlanChanges({
              previous: previousLongTermPlan,
              next: updatedLongTermPlan,
            })
          ) {
            currentState.longTermPlan = updatedLongTermPlan;
            currentState.longTermPlanId = updatedLongTermPlan.id;
            changes.push({
              planId: updatedLongTermPlan.id,
              scope: "longTerm",
              changeType: "updated",
              before: previousLongTermPlan,
              after: clonePlanItem(updatedLongTermPlan),
            });
          }
        }
      }
    }

    if (shortTermPlansExplicitlyProvided) {
      const nextShortTermTitles = (proposal.shortTermPlanTitles ?? []).filter(
        (title): title is string => Boolean(title),
      );

      const previousShortTermPlans = currentState.shortTermPlans.map((plan) => ({ ...plan }));
      const previousByTitle = new Map(previousShortTermPlans.map((plan) => [plan.title, plan]));
      const nextShortTermPlans: PlanItem[] = [];
      const parentPlanId = currentState.longTermPlanId;

      for (const title of nextShortTermTitles) {
        const existing = previousByTitle.get(title);
        const nextPlan = existing
          ? {
              ...existing,
              status: "active" as const,
              parentPlanId,
              reason: proposal.reason ?? existing.reason,
              source: defaultSource,
              expiresAt: proposal.expiresAt ?? existing.expiresAt,
              updatedAt: nowIso,
            }
          : createPlanItem({
              scope: "shortTerm",
              title,
              nowIso,
              parentPlanId,
              reason: proposal.reason,
              source: defaultSource,
              expiresAt: proposal.expiresAt,
            });

        nextShortTermPlans.push(nextPlan);

        if (!existing) {
          changes.push({
            planId: nextPlan.id,
            scope: "shortTerm",
            changeType: "created",
            after: clonePlanItem(nextPlan),
          });
        } else if (hasMeaningfulPlanChanges({ previous: existing, next: nextPlan })) {
          changes.push({
            planId: nextPlan.id,
            scope: "shortTerm",
            changeType: "updated",
            before: existing,
            after: clonePlanItem(nextPlan),
          });
        }
      }

      for (const previous of previousShortTermPlans) {
        if (!nextShortTermTitles.includes(previous.title)) {
          changes.push({
            planId: previous.id,
            scope: "shortTerm",
            changeType: "abandoned",
            before: previous,
            after: markPlanTerminal(previous, "abandoned", nowIso),
          });
        }
      }

      currentState.shortTermPlans = nextShortTermPlans;
      rebuildPlanReferences(currentState);
    }

    this.syncShortTermPlanParentReferences(currentState, changes, nowIso);
    currentState.updatedAt = nowIso;
    rebuildPlanReferences(currentState);

    await savePlanStateData(currentState);

    return createApplyResult(currentState, changes);
  }

  private async transitionPlanToTerminal(input: {
    planId: string;
    status: "completed" | "abandoned";
  }): Promise<PlanApplyResult> {
    const currentState = clonePlanState(await this.getState());
    const nowIso = new Date().toISOString();
    const changes: PlanChange[] = [];

    if (currentState.longTermPlan?.id === input.planId) {
      const before = clonePlanItem(currentState.longTermPlan);
      const after = before ? markPlanTerminal(before, input.status, nowIso) : undefined;
      if (before && after) {
        changes.push({
          planId: before.id,
          scope: "longTerm",
          changeType: input.status,
          before,
          after,
        });
      }
      currentState.longTermPlan = undefined;
      currentState.longTermPlanId = undefined;
    } else {
      const index = currentState.shortTermPlans.findIndex((plan) => plan.id === input.planId);
      if (index >= 0) {
        const before = clonePlanItem(currentState.shortTermPlans[index]);
        const after = before ? markPlanTerminal(before, input.status, nowIso) : undefined;
        if (before && after) {
          changes.push({
            planId: before.id,
            scope: "shortTerm",
            changeType: input.status,
            before,
            after,
          });
        }
        currentState.shortTermPlans.splice(index, 1);
      }
    }

    this.syncShortTermPlanParentReferences(currentState, changes, nowIso);
    rebuildPlanReferences(currentState);
    currentState.updatedAt = nowIso;

    await savePlanStateData(currentState);
    return createApplyResult(currentState, changes);
  }

  /**
   * 维护短期计划与长期计划之间的引用一致性。
   *
   * 说明：
   * - 当长期计划被创建、替换、完成或清空后，短期计划的 parentPlanId 也需要同步；
   * - 只有引用真实发生变化时才产出 updated 事件，避免制造低质量噪音。
   */
  private syncShortTermPlanParentReferences(
    state: PlanState,
    changes: PlanChange[],
    nowIso: string,
  ): void {
    state.shortTermPlans = state.shortTermPlans.map((plan) => {
      const expectedParentPlanId = state.longTermPlanId;
      if (plan.parentPlanId === expectedParentPlanId) {
        return plan;
      }

      const nextPlan: PlanItem = {
        ...plan,
        parentPlanId: expectedParentPlanId,
        updatedAt: nowIso,
      };

      if (hasMeaningfulPlanChanges({ previous: plan, next: nextPlan })) {
        changes.push({
          planId: plan.id,
          scope: "shortTerm",
          changeType: "updated",
          before: clonePlanItem(plan),
          after: clonePlanItem(nextPlan),
        });
      }

      return nextPlan;
    });
  }
}

export const planManager = PlanManager.getInstance();

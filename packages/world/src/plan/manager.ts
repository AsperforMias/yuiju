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

function normalizePlanTitle(title?: string): string | undefined {
  const normalized = title?.trim();
  return normalized ? normalized : undefined;
}

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
    mainPlanId: state.mainPlanId,
    activePlanIds: [...state.activePlanIds],
    mainPlan: state.mainPlan ? { ...state.mainPlan } : undefined,
    activePlans: state.activePlans.map((plan) => ({ ...plan })),
    updatedAt: state.updatedAt,
  };
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

/**
 * 计划状态管理器。
 *
 * 说明：
 * - 计划状态以 Redis `plan_state` 为唯一真相源；
 * - 显式维护 mainPlanId / activePlanIds 引用层，避免后续只靠对象嵌套推导当前活跃计划；
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

  async applyProposal(proposal: PlanProposal): Promise<PlanApplyResult> {
    const currentState = clonePlanState(await this.getState());
    const nowIso = new Date().toISOString();
    const changes: PlanChange[] = [];
    const defaultSource = proposal.source ?? "llm";
    const mainPlanExplicitlyProvided = Object.hasOwn(proposal, "mainPlanTitle");
    const activePlansExplicitlyProvided = Object.hasOwn(proposal, "activePlanTitles");

    const previousMainPlan = currentState.mainPlan ? { ...currentState.mainPlan } : undefined;

    if (mainPlanExplicitlyProvided) {
      const nextMainTitle = normalizePlanTitle(proposal.mainPlanTitle);

      if (!nextMainTitle && previousMainPlan) {
        changes.push({
          planId: previousMainPlan.id,
          scope: "main",
          changeType: "abandoned",
          before: previousMainPlan,
          after: markPlanTerminal(previousMainPlan, "abandoned", nowIso),
        });
        currentState.mainPlan = undefined;
        currentState.mainPlanId = undefined;
      } else if (nextMainTitle) {
        if (!previousMainPlan) {
          currentState.mainPlan = createPlanItem({
            scope: "main",
            title: nextMainTitle,
            nowIso,
            reason: proposal.reason,
            source: defaultSource,
            expiresAt: proposal.expiresAt,
          });
          currentState.mainPlanId = currentState.mainPlan.id;
          changes.push({
            planId: currentState.mainPlan.id,
            scope: "main",
            changeType: "created",
            after: currentState.mainPlan,
          });
        } else if (previousMainPlan.title !== nextMainTitle) {
          const nextMainPlan = createPlanItem({
            scope: "main",
            title: nextMainTitle,
            nowIso,
            reason: proposal.reason,
            source: defaultSource,
            expiresAt: proposal.expiresAt,
          });
          changes.push({
            planId: previousMainPlan.id,
            scope: "main",
            changeType: "superseded",
            before: previousMainPlan,
            after: markPlanTerminal(previousMainPlan, "superseded", nowIso),
          });
          currentState.mainPlan = nextMainPlan;
          currentState.mainPlanId = nextMainPlan.id;
          changes.push({
            planId: nextMainPlan.id,
            scope: "main",
            changeType: "created",
            after: nextMainPlan,
          });
        } else {
          const updatedMainPlan: PlanItem = {
            ...previousMainPlan,
            parentPlanId: undefined,
            reason: proposal.reason ?? previousMainPlan.reason,
            source: defaultSource,
            expiresAt: proposal.expiresAt ?? previousMainPlan.expiresAt,
            updatedAt: nowIso,
          };

          if (hasMeaningfulPlanChanges({ previous: previousMainPlan, next: updatedMainPlan })) {
            currentState.mainPlan = updatedMainPlan;
            currentState.mainPlanId = updatedMainPlan.id;
            changes.push({
              planId: updatedMainPlan.id,
              scope: "main",
              changeType: "updated",
              before: previousMainPlan,
              after: updatedMainPlan,
            });
          }
        }
      }
    }

    if (activePlansExplicitlyProvided) {
      const nextActiveTitles = (proposal.activePlanTitles ?? [])
        .map((title) => normalizePlanTitle(title))
        .filter((title): title is string => Boolean(title));

      const previousActivePlans = currentState.activePlans.map((plan) => ({ ...plan }));
      const previousByTitle = new Map(previousActivePlans.map((plan) => [plan.title, plan]));
      const nextActivePlans: PlanItem[] = [];
      const parentPlanId = currentState.mainPlanId;

      for (const title of nextActiveTitles) {
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
              scope: "active",
              title,
              nowIso,
              parentPlanId,
              reason: proposal.reason,
              source: defaultSource,
              expiresAt: proposal.expiresAt,
            });

        nextActivePlans.push(nextPlan);

        if (!existing) {
          changes.push({
            planId: nextPlan.id,
            scope: "active",
            changeType: "created",
            after: nextPlan,
          });
        } else if (hasMeaningfulPlanChanges({ previous: existing, next: nextPlan })) {
          changes.push({
            planId: nextPlan.id,
            scope: "active",
            changeType: "updated",
            before: existing,
            after: nextPlan,
          });
        }
      }

      for (const previous of previousActivePlans) {
        if (!nextActiveTitles.includes(previous.title)) {
          changes.push({
            planId: previous.id,
            scope: "active",
            changeType: "abandoned",
            before: previous,
            after: markPlanTerminal(previous, "abandoned", nowIso),
          });
        }
      }

      currentState.activePlans = nextActivePlans;
      currentState.activePlanIds = nextActivePlans.map((plan) => plan.id);
    }

    currentState.updatedAt = nowIso;
    if (!currentState.mainPlan) {
      currentState.mainPlanId = undefined;
    }
    if (!activePlansExplicitlyProvided) {
      currentState.activePlanIds = currentState.activePlans.map((plan) => plan.id);
    }

    await savePlanStateData(currentState);

    return {
      state: currentState,
      changes,
      relatedPlanId: currentState.activePlanIds[0] ?? currentState.mainPlanId,
    };
  }
}

export const planManager = PlanManager.getInstance();

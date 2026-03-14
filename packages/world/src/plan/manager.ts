import type {
  PlanApplyResult,
  PlanChange,
  PlanItem,
  PlanProposal,
  PlanScope,
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

function createPlanItem(scope: PlanScope, title: string, nowIso: string): PlanItem {
  return {
    id: createStablePlanId(scope, title),
    title,
    scope,
    status: "active",
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function clonePlanState(state: PlanState): PlanState {
  return {
    mainPlan: state.mainPlan ? { ...state.mainPlan } : undefined,
    activePlans: state.activePlans.map((plan) => ({ ...plan })),
    updatedAt: state.updatedAt,
  };
}

/**
 * 计划状态管理器。
 *
 * 说明：
 * - 计划状态以 Redis `plan_state` 为唯一真相源；
 * - 当前实现使用“标题 + scope”生成稳定 planId，足以支撑现阶段的状态流转与行为关联。
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

    const nextMainTitle = normalizePlanTitle(proposal.mainPlanTitle);
    const previousMainPlan = currentState.mainPlan ? { ...currentState.mainPlan } : undefined;

    if (!nextMainTitle && previousMainPlan) {
      changes.push({
        planId: previousMainPlan.id,
        scope: "main",
        changeType: "cancelled",
        before: previousMainPlan,
      });
      currentState.mainPlan = undefined;
    } else if (nextMainTitle) {
      if (!previousMainPlan) {
        currentState.mainPlan = createPlanItem("main", nextMainTitle, nowIso);
        changes.push({
          planId: currentState.mainPlan.id,
          scope: "main",
          changeType: "created",
          after: currentState.mainPlan,
        });
      } else if (previousMainPlan.title !== nextMainTitle) {
        const nextMainPlan = createPlanItem("main", nextMainTitle, nowIso);
        currentState.mainPlan = nextMainPlan;
        changes.push({
          planId: nextMainPlan.id,
          scope: "main",
          changeType: "replaced",
          before: previousMainPlan,
          after: nextMainPlan,
        });
      }
    }

    const nextActiveTitles = (proposal.activePlanTitles ?? [])
      .map((title) => normalizePlanTitle(title))
      .filter((title): title is string => Boolean(title));

    const previousActivePlans = currentState.activePlans.map((plan) => ({ ...plan }));
    const previousByTitle = new Map(previousActivePlans.map((plan) => [plan.title, plan]));
    const nextActivePlans: PlanItem[] = [];

    for (const title of nextActiveTitles) {
      const existing = previousByTitle.get(title);
      if (existing) {
        nextActivePlans.push({
          ...existing,
          updatedAt: nowIso,
          status: "active",
        });
      } else {
        const created = createPlanItem("active", title, nowIso);
        nextActivePlans.push(created);
        changes.push({
          planId: created.id,
          scope: "active",
          changeType: "created",
          after: created,
        });
      }
    }

    for (const previous of previousActivePlans) {
      if (!nextActiveTitles.includes(previous.title)) {
        changes.push({
          planId: previous.id,
          scope: "active",
          changeType: "cancelled",
          before: previous,
        });
      }
    }

    currentState.activePlans = nextActivePlans;
    currentState.updatedAt = nowIso;
    await savePlanStateData(currentState);

    return {
      state: currentState,
      changes,
      relatedPlanId: currentState.activePlans[0]?.id ?? currentState.mainPlan?.id,
    };
  }
}

export const planManager = PlanManager.getInstance();


import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Plan Manager", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "development";
    vi.clearAllMocks();
    vi.resetModules();
  });

  async function createPlanTestContext(initialState?: unknown) {
    let planStateJson = initialState ? JSON.stringify(initialState) : null;
    const redisInstance = {
      get: vi.fn(async (key: string) => {
        if (key.includes("plan:state")) {
          return planStateJson;
        }
        return null;
      }),
      set: vi.fn(async (_key: string, value: string) => {
        planStateJson = value;
        return "OK";
      }),
      hgetall: vi.fn(async () => ({})),
      hset: vi.fn(async () => 1),
      hget: vi.fn(async () => null),
      quit: vi.fn(async () => undefined),
    };

    vi.doMock("ioredis", () => {
      return {
        default: function MockRedis() {
          return redisInstance as any;
        },
      };
    });

    const { planManager } = await import("@/plan");
    const { initPlanStateData } = await import("../../../utils/src/redis");
    return {
      planManager,
      initPlanStateData,
      redisInstance,
    };
  }

  it("创建主计划后可以稳定读取", async () => {
    const { planManager, initPlanStateData } = await createPlanTestContext();

    const result = await planManager.applyProposal({
      mainPlanTitle: "努力学习，考上理想的大学",
    });

    expect(result.state.mainPlan?.title).toBe("努力学习，考上理想的大学");

    const persisted = await initPlanStateData();
    expect(persisted.mainPlan?.title).toBe("努力学习，考上理想的大学");
  });

  it("创建活跃计划集合后可以完整保存", async () => {
    const { planManager } = await createPlanTestContext();

    const result = await planManager.applyProposal({
      activePlanTitles: ["完成今天的作业", "复习数学", "预习明天课程"],
    });

    expect(result.state.activePlans.map((plan) => plan.title)).toEqual([
      "完成今天的作业",
      "复习数学",
      "预习明天课程",
    ]);
  });

  it("同内容重复 proposal 不产生无意义变更", async () => {
    const { planManager } = await createPlanTestContext();

    await planManager.applyProposal({
      mainPlanTitle: "准备考试",
      activePlanTitles: ["复习数学"],
    });

    const result = await planManager.applyProposal({
      mainPlanTitle: "准备考试",
      activePlanTitles: ["复习数学"],
    });

    expect(result.changes).toHaveLength(0);
  });

  it("更新活跃计划时会取消旧计划并创建新计划", async () => {
    const { planManager } = await createPlanTestContext({
      activePlans: [
        {
          id: "plan_old",
          title: "完成作业",
          scope: "active",
          status: "active",
          createdAt: "2026-03-14T10:00:00.000Z",
          updatedAt: "2026-03-14T10:00:00.000Z",
        },
      ],
      updatedAt: "2026-03-14T10:00:00.000Z",
    });

    const result = await planManager.applyProposal({
      activePlanTitles: ["复习数学", "准备考试"],
    });

    expect(result.changes.some((change) => change.changeType === "cancelled")).toBe(true);
    expect(result.changes.filter((change) => change.changeType === "created")).toHaveLength(2);
  });

  it("清空主计划时会标记取消", async () => {
    const { planManager } = await createPlanTestContext({
      mainPlan: {
        id: "plan_main",
        title: "努力学习",
        scope: "main",
        status: "active",
        createdAt: "2026-03-14T10:00:00.000Z",
        updatedAt: "2026-03-14T10:00:00.000Z",
      },
      activePlans: [],
      updatedAt: "2026-03-14T10:00:00.000Z",
    });

    const result = await planManager.applyProposal({
      mainPlanTitle: undefined,
    });

    expect(result.state.mainPlan).toBeUndefined();
    expect(result.changes[0]?.changeType).toBe("cancelled");
  });
});

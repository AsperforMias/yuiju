import "@yuiju/utils/env";

import { getCharacterCardPrompt } from "@yuiju/source";
import {
  closeRedis,
  connectDB,
  DEFAULT_MEMORY_SUBJECT_ID,
  type FactCandidate,
  getMemoryServiceClientFromEnv,
  type IMemoryEpisode,
  isDev,
  llmMemoryExtractor,
  type MemoryEpisode,
  MemoryEpisodeModel,
  memorySearchTool,
  type PlanState,
  saveMemoryEpisode,
  savePlanStateData,
  updateMemoryEpisodeExtraction,
} from "@yuiju/utils";
import { generateText, stepCountIs } from "ai";
import mongoose from "mongoose";
import { minimax_model } from "@/llm/utils";

/**
 * 兼容当前仓库中 Mongo 环境变量命名差异。
 *
 * 说明：
 * - utils 侧当前读取的是 MONGO_URI；
 * - 项目文档里展示的是 MONGODB_URI；
 * - demo 脚本优先做一层兜底映射，减少手工调整成本。
 */
if (!process.env.MONGO_URI?.trim() && process.env.MONGODB_URI?.trim()) {
  process.env.MONGO_URI = process.env.MONGODB_URI;
}

const DEMO_TAG = "memory-eval-demo-v1";
const MEMORY_SERVICE_BASE_URL = "http://localhost:9196";

type DemoCategory = "positive" | "negative" | "boundary";

interface DemoExpectation {
  shouldWriteFact: boolean;
  expectedFactHints: string[];
  evaluationNote: string;
}

interface DemoEpisodeCase {
  id: string;
  title: string;
  category: DemoCategory;
  episode: MemoryEpisode<Record<string, unknown>>;
  expectation: DemoExpectation;
}

interface SavedDemoEpisode {
  demoCase: DemoEpisodeCase;
  doc: IMemoryEpisode;
}

interface DemoExtractionResult {
  demoCase: DemoEpisodeCase;
  status: IMemoryEpisode["extractionStatus"] | "skipped_by_env";
  factIds: string[];
  facts: FactCandidate[];
  wroteToMemoryService: boolean;
  fallbackReason?: string;
  errorMessage?: string;
}

interface ClearDevDataResult {
  deletedEpisodeCount: number;
  resetPlanState: boolean;
  clearedGraphiti: boolean;
  graphitiDeletedCount?: number;
  graphitiErrorMessage?: string;
}

interface DemoQueryCase {
  id: string;
  title: string;
  question: string;
  expectedMemoryType: "episode";
  expectedTimeConstraint: "yesterday" | "day_before_yesterday" | "explicit_range";
  expectedSummaryHints: string[];
  evaluationNote: string;
}

interface ConversationMessageItem {
  speaker_name: string;
  content: string;
  timestamp: string;
}

/**
 * 构建对话 episode。
 *
 * 说明：
 * - demo 复用正式 memory 结构，确保输入分布尽量贴近真实系统；
 * - payload 额外写入 demoCaseId / demoTag，方便后续排查与扩展。
 */
function createConversationEpisode(input: {
  caseId: string;
  counterpartyName: string;
  happenedAt: Date;
  importance: number;
  messages: ConversationMessageItem[];
}): MemoryEpisode<Record<string, unknown>> {
  const previewText = input.messages
    .slice(-3)
    .map((message) => `${message.speaker_name}：${message.content}`)
    .join(" | ");

  return {
    source: "chat",
    type: "conversation",
    subjectId: DEFAULT_MEMORY_SUBJECT_ID,
    counterpartyId: input.counterpartyName,
    happenedAt: input.happenedAt,
    summaryText: [
      `【记忆评测 Demo / ${input.caseId}】悠酱与 ${input.counterpartyName} 发生了一段对话`,
      `最近内容：${previewText}`,
    ].join("；"),
    importance: input.importance,
    extractionStatus: "pending",
    isDev: isDev(),
    payload: {
      demoTag: DEMO_TAG,
      demoCaseId: input.caseId,
      counterpartyName: input.counterpartyName,
      messageCount: input.messages.length,
      windowStart: input.messages[0]?.timestamp ?? input.happenedAt.toISOString(),
      windowEnd: input.messages.at(-1)?.timestamp ?? input.happenedAt.toISOString(),
      messages: input.messages,
    },
  };
}

/**
 * 构建行为 episode。
 *
 * 说明：
 * - 这里保留 action / reason / executionResult 等核心字段；
 * - 单次消费类样本会放在 behavior 中，用来验证“不要把一次性行为误提炼为长期偏好”。
 */
function createBehaviorEpisode(input: {
  caseId: string;
  happenedAt: Date;
  action: string;
  reason: string;
  executionResult: string;
  durationMinutes: number;
  location: string;
  relatedPlanId?: string;
  importance: number;
}): MemoryEpisode<Record<string, unknown>> {
  return {
    source: "world_tick",
    type: "behavior",
    subjectId: DEFAULT_MEMORY_SUBJECT_ID,
    happenedAt: input.happenedAt,
    summaryText: [
      `【记忆评测 Demo / ${input.caseId}】悠酱执行了行为「${input.action}」`,
      `原因：${input.reason}`,
      `结果：${input.executionResult}`,
      `持续时间：${input.durationMinutes} 分钟`,
    ].join("；"),
    importance: input.importance,
    extractionStatus: "pending",
    isDev: isDev(),
    payload: {
      demoTag: DEMO_TAG,
      demoCaseId: input.caseId,
      action: input.action,
      reason: input.reason,
      executionResult: input.executionResult,
      durationMinutes: input.durationMinutes,
      relatedPlanId: input.relatedPlanId,
      location: input.location,
      characterStateSnapshot: {
        location: input.location,
      },
    },
  };
}

/**
 * 构建计划生命周期 episode。
 *
 * 说明：
 * - 通过 created / updated / completed 等状态变化，测试计划类 fact 的抽取质量；
 * - before / after 只保留最关键的计划字段，便于模型聚焦真正的状态变化。
 */
function createPlanEpisode(input: {
  caseId: string;
  type: MemoryEpisode["type"];
  happenedAt: Date;
  summaryText: string;
  planId: string;
  planScope: "main" | "active";
  changeType: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changeReason: string;
  importance: number;
}): MemoryEpisode<Record<string, unknown>> {
  return {
    source: "world_tick",
    type: input.type,
    subjectId: DEFAULT_MEMORY_SUBJECT_ID,
    happenedAt: input.happenedAt,
    summaryText: `【记忆评测 Demo / ${input.caseId}】${input.summaryText}`,
    importance: input.importance,
    extractionStatus: "pending",
    isDev: isDev(),
    payload: {
      demoTag: DEMO_TAG,
      demoCaseId: input.caseId,
      planId: input.planId,
      planScope: input.planScope,
      changeType: input.changeType,
      before: input.before,
      after: input.after,
      changeReason: input.changeReason,
    },
  };
}

/**
 * 生成本次 demo 的样本集。
 *
 * 说明：
 * - positive: 理论上应被写入长期记忆；
 * - negative: 理论上应被丢弃；
 * - boundary: 用于观察抽取器是否会过度泛化。
 */
function buildDemoEpisodeCases(): DemoEpisodeCase[] {
  return [
    {
      id: "pref-stable-dessert-tea",
      title: "稳定偏好正例：草莓蛋糕与红茶",
      category: "positive",
      episode: createConversationEpisode({
        caseId: "pref-stable-dessert-tea",
        counterpartyName: "小满",
        happenedAt: new Date("2026-03-18T10:15:00+08:00"),
        importance: 0.88,
        messages: [
          {
            speaker_name: "小满",
            content: "你最近如果反复选甜品和饮料，会更偏向什么？",
            timestamp: "2026-03-18 10:10:00",
          },
          {
            speaker_name: "ゆいじゅ",
            content: "如果让我连续选很多次，我大多都会选草莓蛋糕。",
            timestamp: "2026-03-18 10:12:00",
          },
          {
            speaker_name: "ゆいじゅ",
            content: "饮料的话我长期更偏爱红茶，基本不会腻。",
            timestamp: "2026-03-18 10:15:00",
          },
        ],
      }),
      expectation: {
        shouldWriteFact: true,
        expectedFactHints: ["草莓蛋糕", "红茶"],
        evaluationNote: "这是一条典型稳定偏好，应该优先进入长期记忆。",
      },
    },
    {
      id: "chat-smalltalk-greeting",
      title: "寒暄反例：早安聊天不应进入长期记忆",
      category: "negative",
      episode: createConversationEpisode({
        caseId: "chat-smalltalk-greeting",
        counterpartyName: "小雨",
        happenedAt: new Date("2026-03-18T12:02:00+08:00"),
        importance: 0.12,
        messages: [
          {
            speaker_name: "小雨",
            content: "早安呀，今天也要加油。",
            timestamp: "2026-03-18 12:00:00",
          },
          {
            speaker_name: "ゆいじゅ",
            content: "早安，今天也请多关照。",
            timestamp: "2026-03-18 12:02:00",
          },
        ],
      }),
      expectation: {
        shouldWriteFact: false,
        expectedFactHints: [],
        evaluationNote: "礼貌寒暄没有长期决策价值，理应被丢弃。",
      },
    },
    {
      id: "behavior-once-matcha",
      title: "一次性行为边界例：顺手买抹茶拿铁",
      category: "boundary",
      episode: createBehaviorEpisode({
        caseId: "behavior-once-matcha",
        happenedAt: new Date("2026-03-18T18:20:00+08:00"),
        action: "购买抹茶拿铁",
        reason: "路过便利店时临时想喝点甜的，所以顺手买了一杯。",
        executionResult: "喝完之后觉得还行，但没有继续讨论或复购。",
        durationMinutes: 10,
        location: "便利店",
        importance: 0.28,
      }),
      expectation: {
        shouldWriteFact: false,
        expectedFactHints: [],
        evaluationNote: "单次消费不应直接推断为稳定偏好，适合观察误判率。",
      },
    },
    {
      id: "relation-trust-acheng",
      title: "关系正例：对阿澄的信任增强",
      category: "positive",
      episode: createConversationEpisode({
        caseId: "relation-trust-acheng",
        counterpartyName: "阿澄",
        happenedAt: new Date("2026-03-19T09:45:00+08:00"),
        importance: 0.91,
        messages: [
          {
            speaker_name: "阿澄",
            content: "这周复盘如果你还紧张，我可以继续陪你把错题过一遍。",
            timestamp: "2026-03-19 09:41:00",
          },
          {
            speaker_name: "ゆいじゅ",
            content: "谢谢你，这几次一起复盘后，我越来越信任你了。",
            timestamp: "2026-03-19 09:43:00",
          },
          {
            speaker_name: "ゆいじゅ",
            content: "之后如果我又因为考试焦虑卡住，应该会先来找你商量。",
            timestamp: "2026-03-19 09:45:00",
          },
        ],
      }),
      expectation: {
        shouldWriteFact: true,
        expectedFactHints: ["阿澄", "信任"],
        evaluationNote: "这类持续关系信号应当沉淀为 relation fact。",
      },
    },
    {
      id: "plan-main-hokkaido",
      title: "主计划正例：准备北海道旅行采风",
      category: "positive",
      episode: createPlanEpisode({
        caseId: "plan-main-hokkaido",
        type: "plan_created",
        happenedAt: new Date("2026-03-19T20:30:00+08:00"),
        summaryText: "悠酱创建了主计划；原计划：无；新计划：准备北海道旅行采风",
        planId: "demo-plan-main-hokkaido",
        planScope: "main",
        changeType: "created",
        after: {
          id: "demo-plan-main-hokkaido",
          title: "准备北海道旅行采风",
          status: "active",
          source: "system",
        },
        changeReason: "把旅行采风确认为当前阶段最重要的主计划。",
        importance: 0.86,
      }),
      expectation: {
        shouldWriteFact: true,
        expectedFactHints: ["北海道旅行采风", "主计划"],
        evaluationNote: "主计划创建属于长期状态信息，应稳定进入记忆。",
      },
    },
    {
      id: "plan-detail-flight-check",
      title: "计划细节边界例：今晚先查机票价格",
      category: "boundary",
      episode: createPlanEpisode({
        caseId: "plan-detail-flight-check",
        type: "plan_updated",
        happenedAt: new Date("2026-03-20T08:15:00+08:00"),
        summaryText: "悠酱更新了活跃计划；原计划：整理北海道旅行预算；新计划：今晚先查机票价格",
        planId: "demo-plan-active-budget",
        planScope: "active",
        changeType: "updated",
        before: {
          id: "demo-plan-active-budget",
          title: "整理北海道旅行预算",
          status: "active",
          parentPlanId: "demo-plan-main-hokkaido",
          source: "system",
        },
        after: {
          id: "demo-plan-active-budget",
          title: "今晚先查机票价格",
          status: "active",
          parentPlanId: "demo-plan-main-hokkaido",
          source: "system",
        },
        changeReason: "这是执行层面的临时微调，用来测试抽取器是否会过度记录计划细节。",
        importance: 0.34,
      }),
      expectation: {
        shouldWriteFact: false,
        expectedFactHints: [],
        evaluationNote: "计划细节微调通常不该进入长期记忆，是很重要的边界测试点。",
      },
    },
  ];
}

/**
 * 构建当前计划真相源。
 *
 * 说明：
 * - plan 查询直接读 Redis plan_state，不读 episode；
 * - 因此 demo 需要显式写入一份当前计划状态，才能完整验证 plan 查询链路。
 */
function buildDemoPlanState(): PlanState {
  const updatedAt = new Date("2026-03-20T08:20:00+08:00").toISOString();

  return {
    mainPlanId: "demo-plan-main-hokkaido",
    activePlanIds: ["demo-plan-active-budget"],
    mainPlan: {
      id: "demo-plan-main-hokkaido",
      title: "准备北海道旅行采风",
      scope: "main",
      status: "active",
      source: "system",
      createdAt: new Date("2026-03-19T20:30:00+08:00").toISOString(),
      updatedAt,
    },
    activePlans: [
      {
        id: "demo-plan-active-budget",
        title: "整理北海道旅行预算",
        scope: "active",
        status: "active",
        parentPlanId: "demo-plan-main-hokkaido",
        source: "system",
        createdAt: new Date("2026-03-19T21:00:00+08:00").toISOString(),
        updatedAt,
      },
    ],
    updatedAt,
  };
}

/**
 * 构建空的 dev 计划状态，用于清理 demo 写入后的 Redis 状态。
 */
function buildEmptyPlanState(): PlanState {
  return {
    activePlanIds: [],
    activePlans: [],
    updatedAt: new Date(0).toISOString(),
  };
}

/**
 * 清理 Python memory service 中的 dev 图数据。
 *
 * 说明：
 * - Python 侧的 /v1/admin/clear-dev 会清空 group_id=dev 的 Graphiti 数据；
 * - 这里单独封装是为了让 Mongo / Redis 的清理与 Graphiti 解耦，某一项失败也不阻断其他项。
 */
async function clearGraphitiDevData(): Promise<{
  clearedGraphiti: boolean;
  graphitiDeletedCount?: number;
  graphitiErrorMessage?: string;
}> {
  try {
    const response = await fetch(new URL("/v1/admin/clear-dev", MEMORY_SERVICE_BASE_URL), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        clearedGraphiti: false,
        graphitiErrorMessage: `HTTP ${response.status} ${text}`.trim(),
      };
    }

    const json = (await response.json()) as { deleted_count?: unknown };
    return {
      clearedGraphiti: true,
      graphitiDeletedCount: typeof json.deleted_count === "number" ? json.deleted_count : undefined,
    };
  } catch (error) {
    return {
      clearedGraphiti: false,
      graphitiErrorMessage: toErrorMessage(error),
    };
  }
}

/**
 * 清理当前 dev 环境下的测试数据。
 *
 * 说明：
 * - Mongo：删除 isDev=true 的 episode 文档；
 * - Redis：重置当前计划状态；
 * - Graphiti：调用 Python 管理接口清空 dev group。
 */
export async function clearDevData() {
  await connectDB();

  const deleteResult = await MemoryEpisodeModel.deleteMany({
    isDev: true,
  }).exec();

  await savePlanStateData(buildEmptyPlanState());

  const graphitiResult = await clearGraphitiDevData();

  const result: ClearDevDataResult = {
    deletedEpisodeCount: deleteResult.deletedCount ?? 0,
    resetPlanState: true,
    clearedGraphiti: graphitiResult.clearedGraphiti,
    graphitiDeletedCount: graphitiResult.graphitiDeletedCount,
    graphitiErrorMessage: graphitiResult.graphitiErrorMessage,
  };

  console.log("\n=== Dev 测试数据清理结果 ===");
  console.log(`- 删除的 dev episode 数量: ${result.deletedEpisodeCount}`);
  console.log(`- 已重置 dev 计划状态: ${result.resetPlanState ? "是" : "否"}`);
  if (result.clearedGraphiti) {
    console.log(`- 已清空 Graphiti dev 数据: 是`);
    if (typeof result.graphitiDeletedCount === "number") {
      console.log(`- Graphiti 删除数量: ${result.graphitiDeletedCount}`);
    }
  } else {
    console.log(`- 已清空 Graphiti dev 数据: 否`);
    if (result.graphitiErrorMessage) {
      console.log(`- Graphiti 清理失败原因: ${result.graphitiErrorMessage}`);
    }
  }

  await closeRedis().catch(() => undefined);
  await mongoose.disconnect().catch(() => undefined);
}

/**
 * 构建查询样本。
 *
 * 说明：
 * - 当前先聚焦 episode 的历史查询能力；
 * - 问题设计尽量贴近真实使用，让 LLM 自己决定如何调用 function tool。
 */
function buildDemoQueries(): DemoQueryCase[] {
  return [
    {
      id: "query-episode-day-before-dessert",
      title: "Episode 历史查询：前天关于草莓蛋糕的对话",
      question: "请帮我回忆前天和草莓蛋糕有关的事情，重点看发生过什么对话。",
      expectedMemoryType: "episode",
      expectedTimeConstraint: "day_before_yesterday",
      expectedSummaryHints: ["草莓蛋糕", "红茶"],
      evaluationNote: "应优先调用 episode 记忆，并把时间约束落到前天。",
    },
    {
      id: "query-episode-day-before-relation",
      title: "Episode 历史查询：前天与阿澄相关的重要互动",
      question: "前天我和阿澄之间发生过什么值得注意的互动？",
      expectedMemoryType: "episode",
      expectedTimeConstraint: "day_before_yesterday",
      expectedSummaryHints: ["阿澄", "信任"],
      evaluationNote: "应优先调用 episode 记忆，并检索前天的关系变化样本。",
    },
    {
      id: "query-episode-yesterday-main-plan",
      title: "Episode 历史查询：昨天创建过什么重要计划",
      question: "请查一下昨天我创建过什么重要计划，告诉我具体发生了什么。",
      expectedMemoryType: "episode",
      expectedTimeConstraint: "yesterday",
      expectedSummaryHints: ["北海道旅行采风", "主计划"],
      evaluationNote: "应优先调用 episode 记忆，并把时间约束落到昨天。",
    },
    {
      id: "query-episode-yesterday-detail-update",
      title: "Episode 历史查询：昨天活跃计划的更新",
      question: "昨天我的活跃计划发生过什么更新？请按事件来回答。",
      expectedMemoryType: "episode",
      expectedTimeConstraint: "yesterday",
      expectedSummaryHints: ["今晚先查机票价格", "整理北海道旅行预算"],
      evaluationNote: "用于验证昨天的计划更新事件是否能通过 episode 查询命中。",
    },
    {
      id: "query-episode-explicit-range",
      title: "Episode 历史查询：精确时间窗口回忆 2026-03-19",
      question:
        "请查询 2026-03-19 00:00:00 到 2026-03-19 23:59:59 之间发生的重要记忆事件，按时间倒序总结给我。",
      expectedMemoryType: "episode",
      expectedTimeConstraint: "explicit_range",
      expectedSummaryHints: ["阿澄", "北海道旅行采风"],
      evaluationNote: "用于验证 LLM 是否会把明确日期转成 startTime / endTime。",
    },
  ];
}

/**
 * 持久化 demo episode。
 */
async function saveDemoEpisodes(demoCases: DemoEpisodeCase[]): Promise<SavedDemoEpisode[]> {
  const savedEpisodes: SavedDemoEpisode[] = [];

  for (const demoCase of demoCases) {
    const doc = await saveMemoryEpisode(demoCase.episode);
    savedEpisodes.push({ demoCase, doc });
  }

  return savedEpisodes;
}

/**
 * 抽取并尽量持久化事实。
 *
 * 说明：
 * - 这里不直接复用 processMemoryEpisode，而是把抽取结果打印出来，便于人工评估；
 * - 当 Python memory service 不可用时，会退化为“只回写本地 fact id”，不阻断 demo 观察流程。
 */
async function extractAndPersistFacts(
  savedEpisode: SavedDemoEpisode,
): Promise<DemoExtractionResult> {
  const { demoCase, doc } = savedEpisode;

  if (!process.env.DEEPSEEK_API_KEY?.trim()) {
    return {
      demoCase,
      status: "skipped_by_env",
      factIds: [],
      facts: [],
      wroteToMemoryService: false,
      fallbackReason: "未配置 DEEPSEEK_API_KEY，跳过事实抽取。",
    };
  }

  if (!doc.id) {
    return {
      demoCase,
      status: "failed",
      factIds: [],
      facts: [],
      wroteToMemoryService: false,
      errorMessage: "保存后的 episode 缺少文档 id，无法继续抽取。",
    };
  }

  try {
    await updateMemoryEpisodeExtraction(doc.id, {
      extractionStatus: "processing",
    });

    const facts = await llmMemoryExtractor.extract({
      id: doc.id,
      source: doc.source,
      type: doc.type,
      subjectId: doc.subjectId,
      counterpartyId: doc.counterpartyId,
      happenedAt: doc.happenedAt,
      summaryText: doc.summaryText,
      importance: doc.importance,
      payload: doc.payload,
      extractionStatus: "processing",
      extractedFactIds: doc.extractedFactIds,
      isDev: doc.isDev,
    });

    if (facts.length === 0) {
      await updateMemoryEpisodeExtraction(doc.id, {
        extractionStatus: "skipped",
        extractedFactIds: [],
      });

      return {
        demoCase,
        status: "skipped",
        factIds: [],
        facts: [],
        wroteToMemoryService: false,
      };
    }

    const memoryClient = getMemoryServiceClientFromEnv();
    let factIds = facts.map((fact) => fact.id);
    let wroteToMemoryService = false;
    let fallbackReason: string | undefined;

    if (memoryClient) {
      try {
        factIds = await memoryClient.writeFacts({
          is_dev: doc.isDev,
          facts,
        });
        wroteToMemoryService = true;
      } catch (error) {
        fallbackReason = `memory service 写入失败，已回退为本地 fact id：${toErrorMessage(error)}`;
      }
    }

    await updateMemoryEpisodeExtraction(doc.id, {
      extractionStatus: "done",
      extractedFactIds: factIds,
    });

    return {
      demoCase,
      status: "done",
      factIds,
      facts,
      wroteToMemoryService,
      fallbackReason,
    };
  } catch (error) {
    await updateMemoryEpisodeExtraction(doc.id, {
      extractionStatus: "failed",
    });

    return {
      demoCase,
      status: "failed",
      factIds: [],
      facts: [],
      wroteToMemoryService: false,
      errorMessage: toErrorMessage(error),
    };
  }
}

/**
 * 统一格式化异常信息，避免控制台打印出过长对象。
 */
function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * 打印样本写入结果，方便快速核对本轮 demo 输入集。
 */
function printSeedSummary(savedEpisodes: SavedDemoEpisode[]): void {
  console.log("\n=== 1. 已写入的 Demo Episode ===");

  for (const { demoCase, doc } of savedEpisodes) {
    console.log(`- [${demoCase.category}] ${demoCase.title}`);
    console.log(`  caseId: ${demoCase.id}`);
    console.log(`  episodeId: ${doc.id ?? "unknown"}`);
    console.log(`  shouldWriteFact: ${demoCase.expectation.shouldWriteFact}`);
    console.log(
      `  expectedFactHints: ${demoCase.expectation.expectedFactHints.join("、") || "无"}`,
    );
    console.log(`  summary: ${doc.summaryText}`);
    console.log(`  note: ${demoCase.expectation.evaluationNote}`);
  }
}

/**
 * 打印抽取结果。
 *
 * 说明：
 * - expectedFactHints 是“人工评估提示”，不是硬编码断言；
 * - 这里更适合你在调 prompt / 微调后进行横向对比。
 */
function printExtractionSummary(results: DemoExtractionResult[]): void {
  console.log("\n=== 2. 事实抽取结果 ===");

  for (const result of results) {
    console.log(`- ${result.demoCase.title}`);
    console.log(`  status: ${result.status}`);
    console.log(
      `  expected: ${result.demoCase.expectation.shouldWriteFact ? "应写入长期记忆" : "不应写入长期记忆"}`,
    );

    if (result.fallbackReason) {
      console.log(`  fallback: ${result.fallbackReason}`);
    }

    if (result.errorMessage) {
      console.log(`  error: ${result.errorMessage}`);
    }

    if (result.facts.length === 0) {
      console.log("  facts: 无");
      continue;
    }

    console.log(`  wroteToMemoryService: ${result.wroteToMemoryService}`);
    console.log(`  factIds: ${result.factIds.join("、")}`);

    for (const fact of result.facts) {
      console.log(
        `  fact: [${fact.type}] ${fact.subject} / ${fact.predicate} / ${fact.object} / confidence=${fact.confidence}`,
      );
      console.log(`  summary: ${fact.summary}`);
    }
  }
}

/**
 * 打印查询结果。
 *
 * 说明：
 * - 查询失败不会中断整个 demo；
 * - 这样即使 Python memory service 或 Redis 没启动，你也仍然能先看 episode 写入和抽取效果。
 */
function printToolInvocationTrace(result: {
  steps: Array<{
    finishReason: string;
    toolCalls: unknown[];
    toolResults: unknown[];
  }>;
}): void {
  if (result.steps.length === 0) {
    console.log("  steps: 无");
    return;
  }

  for (const [index, step] of result.steps.entries()) {
    console.log(`  step ${index + 1}:`);
    console.log(`    finishReason: ${step.finishReason}`);

    if (step.toolCalls.length > 0) {
      console.log("    toolCalls:");
      console.log(JSON.stringify(step.toolCalls, null, 2));
    }

    if (step.toolResults.length > 0) {
      console.log("    toolResults:");
      console.log(JSON.stringify(step.toolResults, null, 2));
    }

    if (step.toolCalls.length === 0 && step.toolResults.length === 0) {
      console.log("    无 tool 调用");
    }
  }
}

async function runAndPrintQueries(queries: DemoQueryCase[]): Promise<void> {
  console.log("\n=== 3. 查询验证 ===");

  for (const queryCase of queries) {
    console.log(`- ${queryCase.title}`);
    console.log(`  question: ${queryCase.question}`);
    console.log(`  expectedMemoryType: ${queryCase.expectedMemoryType}`);
    console.log(`  expectedTimeConstraint: ${queryCase.expectedTimeConstraint}`);
    console.log(`  expectedHints: ${queryCase.expectedSummaryHints.join("、")}`);
    console.log(`  note: ${queryCase.evaluationNote}`);

    try {
      const result = await generateText({
        model: minimax_model,
        system: getCharacterCardPrompt({
          userName: "翊小久",
        }),
        prompt: queryCase.question,
        tools: {
          memorySearch: memorySearchTool,
        },
        stopWhen: stepCountIs(5),
      });

      printToolInvocationTrace(result);
      console.log(`  assistant: ${result.text || "无文本输出"}`);
    } catch (error) {
      console.log(`  error: ${toErrorMessage(error)}`);
    }
  }
}

/**
 * 打印推荐的人工评测问题。
 *
 * 说明：
 * - 这些问题更贴近真实使用方式；
 * - 即便当前 episode 检索还是关键词匹配，你后续做 rerank / semantic search 时也能复用。
 */
function printManualEvaluationPrompts(): void {
  const prompts = [
    "悠酱稳定喜欢吃什么、喝什么？",
    "悠酱和阿澄现在是什么关系？",
    "悠酱当前最重要的计划是什么？",
    "哪些只是一次性发生的事情，不应该进入长期记忆？",
    "哪些计划变化只是执行层细节，不值得沉淀为长期事实？",
  ];

  console.log("\n=== 4. 建议你后续继续追踪的人工评测问题 ===");
  for (const prompt of prompts) {
    console.log(`- ${prompt}`);
  }
}

/**
 * 主入口：写入 demo、执行抽取、验证查询。
 */
async function demoMemoryTest() {
  const demoCases = buildDemoEpisodeCases();

  try {
    await connectDB();

    const savedEpisodes = await saveDemoEpisodes(demoCases);
    printSeedSummary(savedEpisodes);

    const extractionResults: DemoExtractionResult[] = [];
    for (const savedEpisode of savedEpisodes) {
      const result = await extractAndPersistFacts(savedEpisode);
      extractionResults.push(result);
    }
    printExtractionSummary(extractionResults);

    await savePlanStateData(buildDemoPlanState());
    await runAndPrintQueries(buildDemoQueries());
    printManualEvaluationPrompts();
  } finally {
    await closeRedis().catch(() => undefined);
    await mongoose.disconnect().catch(() => undefined);
  }
}

export async function main() {
  // await clearDevData();
  await demoMemoryTest();
}

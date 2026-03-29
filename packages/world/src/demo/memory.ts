import {
  DEFAULT_MEMORY_SUBJECT_ID,
  type MemoryEpisode,
  MemoryServiceClient,
  memorySearchTool,
  strongModel,
} from "@yuiju/utils";
import { generateText, stepCountIs } from "ai";
import dayjs from "dayjs";

const DEMO_IS_DEV = true;
const DEMO_TAG = "memory-tool-demo-v3";
const MEMORY_SERVICE_BASE_URL = "http://localhost:9196";
const memoryClient = new MemoryServiceClient(MEMORY_SERVICE_BASE_URL);

interface ConversationMessageItem {
  speaker_name: string;
  content: string;
  timestamp: string;
}

interface DemoSeedCase {
  title: string;
  episode: MemoryEpisode<Record<string, unknown>>;
}

interface ToolQueryCase {
  title: string;
  question: string;
}

/**
 * 构建对话类 Episode。
 *
 * 说明：
 * - payload 与正式对话归档结构保持一致，方便直接复用当前准入判断与 Graphiti 写入链路；
 * - summaryText 只保留本轮测试必需的最近片段，降低人工排查成本。
 */
function createConversationEpisode(input: {
  caseId: string;
  counterpartyName: string;
  happenedAt: Date;
  messages: ConversationMessageItem[];
}): MemoryEpisode<Record<string, unknown>> {
  const previewText = input.messages
    .slice(-3)
    .map((message) => `${message.speaker_name}：${message.content}`)
    .join(" | ");

  return {
    source: "chat",
    type: "conversation",
    subject: DEFAULT_MEMORY_SUBJECT_ID,
    counterparty: input.counterpartyName,
    happenedAt: input.happenedAt,
    summaryText: [
      `【${DEMO_TAG} / ${input.caseId}】悠酱与 ${input.counterpartyName} 完成了一段对话归档`,
      previewText ? `最近内容：${previewText}` : undefined,
    ]
      .filter(Boolean)
      .join("；"),
    extractionStatus: "pending",
    isDev: DEMO_IS_DEV,
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
 * 构建行为类 Episode。
 *
 * 说明：
 * - 用一条“一次性购买饮料”的边界样本验证系统不会把单次行为误沉淀为长期偏好；
 * - payload 只保留长期记忆准入和 Python 写入真正会消费的字段。
 */
function createBehaviorEpisode(input: {
  caseId: string;
  happenedAt: Date;
  action: string;
  reason: string;
  executionResult: string;
  durationMinutes: number;
  location: string;
}): MemoryEpisode<Record<string, unknown>> {
  return {
    source: "world_tick",
    type: "behavior",
    subject: DEFAULT_MEMORY_SUBJECT_ID,
    happenedAt: input.happenedAt,
    summaryText: [
      `【${DEMO_TAG} / ${input.caseId}】悠酱执行了行为「${input.action}」`,
      `原因：${input.reason}`,
      `结果：${input.executionResult}`,
    ].join("；"),
    extractionStatus: "pending",
    isDev: DEMO_IS_DEV,
    payload: {
      demoTag: DEMO_TAG,
      demoCaseId: input.caseId,
      action: input.action,
      reason: input.reason,
      executionResult: input.executionResult,
      durationMinutes: input.durationMinutes,
      location: input.location,
    },
  };
}

/**
 * 构建本轮最小可复现样本。
 *
 * 说明：
 * - 只保留当前长期记忆系统最关键的 3 类样本：稳定偏好、稳定关系、单次行为反例；
 * - 样本数量保持最小，便于观察“Graphiti 写入 + function tool 检索”的真实效果。
 */
function buildDemoSeedCases(): DemoSeedCase[] {
  return [
    {
      title: "稳定偏好：霜莓千层蛋糕与柚香热红茶",
      episode: createConversationEpisode({
        caseId: "stable-preference",
        counterpartyName: "小满",
        happenedAt: new Date("2026-03-19T09:15:00+08:00"),
        messages: [
          {
            speaker_name: "小满",
            content: "如果让你长期固定选甜品和饮料，你通常会选什么？",
            timestamp: "2026-03-19 09:10:00",
          },
          {
            speaker_name: "ゆいじゅ",
            content: "甜品的话，我长期最偏爱霜莓千层蛋糕，基本不会改。",
            timestamp: "2026-03-19 09:12:00",
          },
          {
            speaker_name: "ゆいじゅ",
            content: "饮料我也总会先选柚香热红茶，这个口味最让我安心。",
            timestamp: "2026-03-19 09:15:00",
          },
        ],
      }),
    },
    {
      title: "关系变化：对澄风的信任增强",
      episode: createConversationEpisode({
        caseId: "relation-trust",
        counterpartyName: "澄风",
        happenedAt: new Date("2026-03-19T17:45:00+08:00"),
        messages: [
          {
            speaker_name: "澄风",
            content: "如果你今晚还想复盘，我可以继续陪你一起整理笔记。",
            timestamp: "2026-03-19 17:39:00",
          },
          {
            speaker_name: "ゆいじゅ",
            content: "谢谢你，这几次一起复盘后，我越来越信任你了。",
            timestamp: "2026-03-19 17:42:00",
          },
          {
            speaker_name: "ゆいじゅ",
            content: "以后我如果又卡住，大概会先来找你商量。",
            timestamp: "2026-03-19 17:45:00",
          },
        ],
      }),
    },
    {
      title: "反例：一次性买了海盐青柠汽水",
      episode: createBehaviorEpisode({
        caseId: "once-drink-boundary",
        happenedAt: new Date("2026-03-19T14:20:00+08:00"),
        action: "购买海盐青柠汽水",
        reason: "路过自动贩卖机时一时兴起，想喝点冰的。",
        executionResult: "喝完觉得还行，但没有继续讨论，也没有复购打算。",
        durationMinutes: 8,
        location: "学校走廊",
      }),
    },
  ];
}

/**
 * 构建 function tool 测试问题。
 *
 * 说明：
 * - 全部使用自然语言提问，由 LLM 自己决定 memorySearchTool 的调用参数；
 * - 当前 demo 只验证 Graphiti 长期事实，因此问题全部聚焦 fact 查询。
 */
function buildToolQueryCases(): ToolQueryCase[] {
  return [
    {
      title: "问题 1：长期偏好",
      question: "悠酱长期更偏爱什么甜品和饮料？请先用记忆查询工具确认，再给我简短回答。",
    },
    {
      title: "问题 2：人物关系",
      question: "悠酱最近对澄风是什么态度？请先查询长期记忆，再回答。",
    },
    {
      title: "问题 3：一次性饮料边界",
      question: "悠酱是不是长期喜欢海盐青柠汽水？请先查记忆工具，不要凭感觉回答。",
    },
  ];
}

/**
 * 清理本轮 demo 使用的 dev 数据。
 *
 * 说明：
 * - 当前 demo 只依赖 Graphiti，因此只清空 Graphiti 的 dev 图；
 * - 这样可以避免 Mongo / Diary 等其他存储对测试结果造成干扰。
 */
async function clearDevData(): Promise<void> {
  console.log("=== 1. 清理 dev 测试数据 ===");

  try {
    const response = await fetch(new URL("/v1/admin/clear-dev", MEMORY_SERVICE_BASE_URL), {
      method: "DELETE",
    });
    const text = await response.text();
    console.log(`graphiti_dev_clear: ${response.status} ${text}`);
  } catch (error) {
    console.log(
      `graphiti_dev_clear: skipped (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

/**
 * 将 demo 样本直接写入 Graphiti。
 *
 * 说明：
 * - 当前 demo 不再经过 Mongo episode 真相源，只验证 Python memory service + Graphiti；
 * - 返回的 memoryIds 对应 Graphiti 中新生成的关系产物，可粗看每条样本是否真正沉淀成功。
 */
async function seedDemoEpisodes(): Promise<void> {
  const cases = buildDemoSeedCases();

  console.log("\n=== 2. 写入 demo episodes ===");
  for (const demoCase of cases) {
    const memoryIds = await memoryClient.writeEpisode({
      is_dev: DEMO_IS_DEV,
      episode: demoCase.episode,
    });

    console.log(`- ${demoCase.title}`);
    console.log(
      `  happenedAt: ${dayjs(demoCase.episode.happenedAt).format("YYYY-MM-DD HH:mm:ss")}`,
    );
    console.log(`  summary: ${demoCase.episode.summaryText}`);
    console.log(`  graphitiIds: ${memoryIds.join("、") || "无"}`);
  }
}

/**
 * 使用 LLM + function tool 测试当前记忆查询。
 *
 * 说明：
 * - prompt 会显式要求先用 memorySearchTool，再基于工具结果作答；
 * - 同时打印 toolCalls / toolResults / 最终回答，方便排查“模型没调工具”还是“工具结果本身不对”。
 */
async function runToolQueryDemo(): Promise<void> {
  const cases = buildToolQueryCases();

  console.log("\n=== 3. LLM + function tool 查询结果 ===");

  for (const queryCase of cases) {
    const prompt = [
      "你是记忆查询测试助手。",
      "你必须先调用 memorySearch 工具查询fact，再回答问题。",
      "如果工具结果不足以支持结论，要明确说明“当前记忆中没有足够证据”。",
      "",
      "问题：",
      queryCase.question,
    ].join("\n");

    const result = await generateText({
      model: strongModel,
      tools: {
        memorySearch: memorySearchTool,
      },
      prompt,
      stopWhen: stepCountIs(8),
    });

    console.log(`\n--- ${queryCase.title} ---`);
    console.log(`QUESTION: ${queryCase.question}`);
    console.log("TOOL CALLS:");
    console.log(JSON.stringify(result.toolCalls, null, 2));
    console.log("TOOL RESULTS:");
    console.log(JSON.stringify(result.toolResults, null, 2));
    console.log("ANSWER:");
    console.log(result.text);
  }
}

/**
 * 主入口：清理 Graphiti、写入样本，并通过 function tool 发起事实查询。
 */
async function demoMemorySystem(): Promise<void> {
  // await clearDevData();
  // await seedDemoEpisodes();
  await runToolQueryDemo();
}

export async function main() {
  await demoMemorySystem();
}

import "@yuiju/utils/env";
import { ActionId, getTimeWithWeekday, isDev } from "@yuiju/utils";
import dayjs from "dayjs";

// 扩展 MemoryServiceClient，添加清理 dev 数据的方法
class ExtendedMemoryServiceClient {
  constructor(private baseUrl: string = "http://localhost:9196") {}

  /** 写入 episode（复用原有逻辑） */
  async writeEpisode(input: {
    is_dev?: boolean;
    type: string;
    counterparty_name?: string;
    content: unknown;
    reference_time: Date | string;
  }): Promise<void> {
    const res = await fetch(new URL("/v1/episodes", this.baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        is_dev: input.is_dev,
        type: input.type,
        counterparty_name: input.counterparty_name,
        content: input.content,
        reference_time:
          input.reference_time instanceof Date
            ? input.reference_time.toISOString()
            : input.reference_time,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`MemoryService writeEpisode failed: ${res.status} ${text}`);
    }
  }

  /** 搜索记忆（复用原有逻辑） */
  async searchMemory(input: {
    query: string;
    is_dev?: boolean;
    top_k?: number;
    counterparty_name?: string;
    filters?: Record<string, unknown>;
  }): Promise<
    Array<{ memory: string; time?: string | null; source?: string | null; score?: number | null }>
  > {
    const res = await fetch(new URL("/v1/search", this.baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: input.query,
        is_dev: input.is_dev,
        top_k: input.top_k ?? 5,
        counterparty_name: input.counterparty_name,
        filters: input.filters,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`MemoryService searchMemory failed: ${res.status} ${text}`);
    }

    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) {
      throw new Error("MemoryService searchMemory: invalid response");
    }

    return json as Array<{
      memory: string;
      time?: string | null;
      source?: string | null;
      score?: number | null;
    }>;
  }

  /** 清理 dev 环境的所有数据 */
  async clearDevData(): Promise<{ deleted_count: number }> {
    const res = await fetch(new URL("/v1/admin/clear-dev", this.baseUrl), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`MemoryService clearDevData failed: ${res.status} ${text}`);
    }

    const json = (await res.json()) as unknown;
    return json as { deleted_count: number };
  }
}

function getExtendedMemoryClient(): ExtendedMemoryServiceClient {
  return new ExtendedMemoryServiceClient("http://localhost:9196");
}

interface MockBehavior {
  action: ActionId;
  reason: string;
  durationMin: number;
  daysAgo: number;
  hour: number;
  executionResult?: string;
}

// 模拟行为数据 - 使用真实的 ActionId 并设定具体的时间分布
const mockBehaviors: MockBehavior[] = [
  // 最近 24 小时内
  {
    action: ActionId.Wake_Up,
    reason: "新的一天开始了，精神饱满地起床准备迎接挑战",
    durationMin: 5,
    daysAgo: 0,
    hour: 7,
  },
  {
    action: ActionId.Eat_Breakfast,
    reason: "早餐吃了营养丰富的燕麦粥和鸡蛋，补充能量",
    durationMin: 15,
    daysAgo: 0,
    hour: 7,
    executionResult: "饱腹感 +20",
  },
  {
    action: ActionId.Go_To_School_From_Home,
    reason: "吃完早餐，该去学校上课了",
    durationMin: 20,
    daysAgo: 0,
    hour: 8,
  },
  // 2-3 天前
  {
    action: ActionId.Study_At_School,
    reason: "今天有数学和英语课程，需要认真听讲",
    durationMin: 120,
    daysAgo: 2,
    hour: 10,
  },
  {
    action: ActionId.Work_At_Cafe,
    reason: "在咖啡店打工赚取零花钱，练习社交技能",
    durationMin: 180,
    daysAgo: 2,
    hour: 14,
    executionResult: "赚了 300 元",
  },
  {
    action: ActionId.Drink_Coffee,
    reason: "下午茶时间，一杯拿铁帮助放松身心",
    durationMin: 30,
    daysAgo: 3,
    hour: 16,
  },
  // 一周前
  {
    action: ActionId.Eat_Dinner,
    reason: "晚餐吃了最喜欢的咖喱饭",
    durationMin: 40,
    daysAgo: 7,
    hour: 19,
    executionResult: "饱腹感 +30",
  },
  {
    action: ActionId.Sleep,
    reason: "忙碌的一天结束了，好好休息恢复精力",
    durationMin: 480,
    daysAgo: 7,
    hour: 22,
  },
];

/**
 * 清理 dev 环境的所有数据
 * 可以按需调用此函数来清空测试数据
 */
export async function clearDevData(): Promise<void> {
  console.log("🧹 开始清理 dev 环境数据...");
  const memoryClient = getExtendedMemoryClient();
  try {
    const result = await memoryClient.clearDevData();
    console.log(`✅ 清理完成，删除了 ${result.deleted_count} 条记录\n`);
  } catch (e) {
    console.error("❌ 清理失败:", (e as Error).message);
    console.log("   请确保 Python 服务已更新并包含 /v1/admin/clear-dev 端点\n");
    throw e;
  }
}

async function writeMemory() {
  console.log("=== ゆいじゅ记忆服务测试脚本 ===\n");

  // 初始化记忆服务客户端
  const memoryClient = getExtendedMemoryClient();
  const useDevMode = isDev();

  console.log("✅ 记忆服务客户端初始化成功");
  console.log(`   服务地址: http://localhost:9196`);
  console.log(`   环境标识: ${useDevMode ? "开发环境 (dev)" : "生产环境 (prod)"}`);
  console.log(`   Group ID: ${useDevMode ? "dev" : "prod"}\n`);

  try {
    console.log("开始写入 mock 记忆数据...\n");

    // 写入不同时间点的记忆记录
    for (let i = 0; i < mockBehaviors.length; i++) {
      const behavior = mockBehaviors[i];

      // 构建具体的时间点
      const referenceTime = dayjs()
        .subtract(behavior.daysAgo, "day")
        .hour(behavior.hour)
        .minute(Math.floor(Math.random() * 30))
        .second(0);

      // 构建描述（包含执行结果）
      let description = behavior.reason;
      if (behavior.executionResult) {
        description += ` ${behavior.executionResult}`;
      }

      await memoryClient.writeEpisode({
        is_dev: useDevMode,
        type: "ゆいじゅ的 Behavior",
        reference_time: referenceTime.toDate(),
        content: {
          time: getTimeWithWeekday(referenceTime),
          action: behavior.action,
          reason: description,
          duration_minutes: `持续了${behavior.durationMin}分钟`,
        },
      });

      const timeLabel = behavior.daysAgo === 0 ? "今天" : `${behavior.daysAgo}天前`;
      console.log(
        `[${i + 1}/${mockBehaviors.length}] ✅ ${behavior.action} - ${timeLabel} ${referenceTime.format("HH:mm")}`,
      );
    }

    console.log("\n🎉 所有 mock 记忆数据写入成功！");
    console.log("\n📊 数据概览：");
    console.log(`   - 共写入 ${mockBehaviors.length} 条记忆记录`);
    console.log(`   - 时间范围：过去 7 天内`);
    console.log(`   - 行为类型：${[...new Set(mockBehaviors.map((b) => b.action))].join(", ")}`);

    // 简单测试搜索功能
    console.log("\n🔍 测试记忆搜索功能...");
    const testQueries = ["学习", "咖啡", "睡觉"];
    for (const query of testQueries) {
      try {
        const results = await memoryClient.searchMemory({
          query,
          is_dev: useDevMode,
          top_k: 3,
        });
        console.log(`   搜索"${query}": 找到 ${results.length} 条相关记忆`);
      } catch (e) {
        console.log(`   搜索"${query}": 搜索功能暂不可用 (${(e as Error).message})`);
      }
    }

    console.log("\n📝 下一步：");
    console.log("   1. 访问 Graphiti 前端界面查看存储的记忆");
    console.log("   2. 尝试不同的搜索关键词验证检索效果");
    console.log("   3. 检查记忆的时间排序和内容完整性");
    console.log("   4. 如需重新测试，可调用 clearDevData() 函数清理数据");
  } catch (error) {
    console.error("\n❌ 写入记忆数据失败:", error);
    console.log("\n💡 请检查：");
    console.log("   1. Python 记忆服务是否正在运行（端口 9196）");
    console.log("   2. 服务地址配置是否正确");
    console.log("   3. 网络连接是否正常");
  }
}

/**
 * 测试记忆搜索功能
 * 参考 @packages/utils/src/llm/tools/memory-search.ts 的实现
 * 在函数内部测试多个关键词的搜索效果，验证记忆查询功能
 */
export async function searchMemory(): Promise<void> {
  console.log("🔍 开始测试记忆搜索功能...\n");
  const memoryClient = getExtendedMemoryClient();
  const useDevMode = isDev();

  // 测试搜索关键词，覆盖各种行为场景
  const testQueries = [
    "ゆいじゅ 今天早上做了什么？",
    // "ゆいじゅ 吃早餐",
    // "ゆいじゅ 学习",
    // "ゆいじゅ 打工",
    // "ゆいじゅ 咖啡",
    // "ゆいじゅ 睡觉",
    // "学习",
    // "咖啡",
    // "睡觉",
  ];

  try {
    for (const query of testQueries) {
      console.log(`📝 搜索关键词："${query}"`);
      const results = await memoryClient.searchMemory({
        query,
        is_dev: false,
        top_k: 5,
      });

      if (results.length > 0) {
        console.log(`✅ 找到 ${results.length} 条相关记忆`);
        results.forEach((result, index) => {
          console.log(`   [${index + 1}] ${result.memory}`);
          if (result.time) {
            console.log(`      时间：${result.time}`);
          }
          if (result.score) {
            console.log(`      分数：${result.score.toFixed(3)}`);
          }
        });
      } else {
        console.log(`⚠️  未找到相关记忆`);
      }
      console.log(); // 换行分隔不同查询的结果
    }

    console.log("🎉 记忆搜索功能测试完成！");
    console.log("\n📊 测试总结：");
    console.log(`   - 共测试 ${testQueries.length} 个搜索关键词`);
    console.log(`   - 使用环境：${useDevMode ? "开发环境 (dev)" : "生产环境 (prod)"}`);
    console.log(`   - 服务地址：http://localhost:9196`);
  } catch (e) {
    console.error("❌ 搜索测试失败:", (e as Error).message);
    throw e;
  }
}

export async function main() {
  // await clearDevData();
  await searchMemory();
}

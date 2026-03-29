import { generateText, Output } from "ai";
import { z } from "zod";
import { smallModel } from "../llm/models";
import type { MemoryEpisode } from "./episode";

const memoryAdmissionSchema = z.object({
  shouldWrite: z.boolean().describe("当前 episode 是否值得进入 Graphiti 长期记忆图谱。"),
  reason: z.string().optional().describe("简要说明判断原因，便于排查边界 case；不需要很长。"),
});

export interface MemoryAdmissionDecision {
  shouldWrite: boolean;
  reason?: string;
}

export interface MemoryAdmissionClassifier {
  classify(episode: MemoryEpisode): Promise<MemoryAdmissionDecision>;
}

/**
 * 收敛送给准入判断器的上下文，避免把完整 payload 噪声直接暴露给模型。
 *
 * 说明：
 * - behavior 保留动作、原因、结果和地点，足够判断是否可能形成稳定偏好；
 * - conversation 仅保留最近几条消息与对象，重点观察是否出现稳定偏好/关系信号；
 * - 其他类型只保留少量原始字段，避免未来新增类型时完全失去上下文。
 */
function buildEpisodePayloadContext(episode: MemoryEpisode): unknown {
  const payload = episode.payload as Record<string, unknown>;

  if (episode.type === "behavior") {
    return {
      action: payload.action,
      reason: payload.reason,
      executionResult: payload.executionResult,
      durationMinutes: payload.durationMinutes,
      location: payload.location,
      relatedPlanId: payload.relatedPlanId,
    };
  }

  if (episode.type === "conversation") {
    const rawMessages = Array.isArray(payload.messages) ? payload.messages : [];

    return {
      counterpartyName: payload.counterpartyName,
      messageCount: payload.messageCount,
      windowStart: payload.windowStart,
      windowEnd: payload.windowEnd,
      recentMessages: rawMessages.slice(-6),
    };
  }

  return payload;
}

/**
 * 当前阶段的长期记忆准入规则。
 *
 * 说明：
 * - Graphiti 只承担“受控抽取 preference / relation”的职责；
 * - 业务侧仍保留一层保守准入，避免明显不该进入长期图谱的事件送入 Graphiti；
 * - 对于边界 case，优先选择丢弃，减少日常流水写入。
 */
function shouldSkipByRule(episode: MemoryEpisode): boolean {
  return (
    episode.type.startsWith("plan_") ||
    episode.type === "weather_changed" ||
    episode.type === "system"
  );
}

function buildAdmissionPrompt(episode: MemoryEpisode): string {
  return [
    "你是长期记忆图谱的准入判断器，只负责回答当前 episode 是否应该进入 Graphiti。",
    "输出只能是结构化结果中的 shouldWrite=true/false，不要尝试提炼事实，不要生成实体或关系。",
    "只有当 episode 很可能包含“稳定偏好”或“稳定人物关系”时，shouldWrite 才能为 true。",
    "以下内容必须判定为 false：",
    "- 单次行为、一次性消费、随手做了什么的流水记录。",
    "- 普通寒暄、礼貌回复、无后续影响的短对话。",
    "- 天气、计划、金币变动、系统事件、执行细节。",
    "- 只有短时情绪、含糊猜测、证据不足的信息。",
    "以下内容才可以判定为 true：",
    "- 明确表达且带有长期稳定含义的偏好、喜恶、长期倾向。",
    "- 明确表达且可持续的人物关系变化，例如信任、依赖、回避、稳定态度。",
    "判断原则：宁可少写，也不要把日常活动误写进长期图谱；拿不准时一律返回 false。",
    `episode_type=${episode.type}`,
    `subject=${episode.subject}`,
    `counterparty=${episode.counterparty ?? ""}`,
    `happened_at=${episode.happenedAt.toISOString()}`,
    `summary_text=${episode.summaryText}`,
    `payload=${JSON.stringify(buildEpisodePayloadContext(episode), null, 2)}`,
  ].join("\n");
}

/**
 * 基于小模型的长期记忆准入判断器。
 *
 * 说明：
 * - 只做 shouldWrite 的二值判断，不再在 TS 侧承担完整 fact 抽取职责；
 * - 先走确定性规则过滤明显噪声，再让小模型处理 behavior / conversation 的边界样本；
 * - 如果未来引入更强的业务规则，可以优先补这里，而不是继续扩大 Graphiti 的自由度。
 */
export const llmMemoryAdmissionClassifier: MemoryAdmissionClassifier = {
  async classify(episode) {
    if (shouldSkipByRule(episode)) {
      return {
        shouldWrite: false,
        reason: `episode.type=${episode.type} 不进入长期图谱`,
      };
    }

    const { output } = await generateText({
      model: smallModel,
      output: Output.object({
        schema: memoryAdmissionSchema,
      }),
      prompt: buildAdmissionPrompt(episode),
    });

    return output;
  },
};

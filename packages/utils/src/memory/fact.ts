import type { MemoryEpisode } from "./episode";

/**
 * 当前支持进入 Graphiti 的事实类型。
 */
export type FactCandidateType = "preference" | "relation" | "plan";

/**
 * 进入 Graphiti 前的业务候选事实。
 *
 * 说明：
 * - id 由 extractor 生成，用于 TS 与 Python 之间回传、回写 extractedFactIds；
 * - evidenceEpisodeId 让图事实始终可追溯到真相层事件。
 */
export interface FactCandidate {
  id: string;
  type: FactCandidateType;
  subject: string;
  predicate: string;
  object: string;
  summary: string;
  confidence: number;
  evidenceEpisodeId: string;
  validAt: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryExtractor {
  extract(episode: MemoryEpisode): FactCandidate[];
}

function createFactId(parts: string[]): string {
  const raw = parts.join("|");
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }
  return `fact_${hash.toString(16)}`;
}

function isConversationMessageList(value: unknown): value is Array<{
  speaker_name: string;
  content: string;
  timestamp: string;
}> {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.speaker_name === "string" &&
        typeof item.content === "string",
    )
  );
}

/**
 * 同步规则型 extractor。
 *
 * 说明：
 * - 只提炼当前阶段已明确需要进入 Graphiti 的事实；
 * - 规则偏保守，宁可少提，也避免把噪声事件直接写进图谱。
 */
export const ruleBasedMemoryExtractor: MemoryExtractor = {
  extract(episode) {
    const episodeId = episode.id;
    if (!episodeId) {
      return [];
    }

    if (episode.type === "plan_update") {
      const payload = episode.payload as {
        planId?: string;
        changeType?: string;
        after?: { title?: string } | string | string[];
        planScope?: string;
      };
      const title =
        typeof payload.after === "string"
          ? payload.after
          : Array.isArray(payload.after)
            ? payload.after.join("、")
            : payload.after?.title;

      if (!title) {
        return [];
      }

      return [
        {
          id: createFactId([episodeId, "plan", payload.planId ?? "unknown", title]),
          type: "plan",
          subject: episode.subjectId,
          predicate: payload.planScope === "main" ? "current_main_plan" : "current_active_plan",
          object: title,
          summary: `当前计划：${title}`,
          confidence: 0.92,
          evidenceEpisodeId: episodeId,
          validAt: episode.happenedAt.toISOString(),
          metadata: {
            planId: payload.planId,
            changeType: payload.changeType,
            planScope: payload.planScope,
          },
        },
      ];
    }

    if (episode.type === "conversation") {
      const payload = episode.payload as {
        counterpartyName?: string;
        counterpartyId?: string;
        messages?: unknown;
      };
      const messages = isConversationMessageList(payload.messages) ? payload.messages : [];
      const facts: FactCandidate[] = [];
      const conversationText = messages.map((message) => message.content).join("\n");
      const counterpartyName = payload.counterpartyName ?? payload.counterpartyId ?? episode.counterpartyId;

      const preferenceMatch = conversationText.match(
        /(我|悠酱|ゆいじゅ).{0,4}(喜欢|想吃|爱吃|讨厌|不喜欢)([^，。！？\n]{1,24})/,
      );
      if (preferenceMatch) {
        const preferenceVerb = preferenceMatch[2];
        const preferenceTarget = preferenceMatch[3]?.trim();
        if (preferenceTarget) {
          facts.push({
            id: createFactId([episodeId, "preference", preferenceVerb, preferenceTarget]),
            type: "preference",
            subject: episode.subjectId,
            predicate: preferenceVerb.includes("不") || preferenceVerb.includes("讨厌") ? "dislikes" : "likes",
            object: preferenceTarget,
            summary: `${episode.subjectId}${preferenceVerb}${preferenceTarget}`,
            confidence: 0.88,
            evidenceEpisodeId: episodeId,
            validAt: episode.happenedAt.toISOString(),
            metadata: {
              counterpartyName,
            },
          });
        }
      }

      if (counterpartyName && messages.length >= 2) {
        const positiveRelation = /(谢谢|喜欢和你聊|开心|下次再聊|一起加油)/.test(conversationText);
        const negativeRelation = /(讨厌你|别烦我|不想理你|生气)/.test(conversationText);

        if (positiveRelation || negativeRelation) {
          facts.push({
            id: createFactId([
              episodeId,
              "relation",
              counterpartyName,
              positiveRelation ? "positive" : "negative",
            ]),
            type: "relation",
            subject: episode.subjectId,
            predicate: positiveRelation ? "attitude_towards" : "negative_attitude_towards",
            object: counterpartyName,
            summary: positiveRelation
              ? `${episode.subjectId}对${counterpartyName}表现出积极互动倾向`
              : `${episode.subjectId}对${counterpartyName}表现出负向互动倾向`,
            confidence: positiveRelation ? 0.78 : 0.72,
            evidenceEpisodeId: episodeId,
            validAt: episode.happenedAt.toISOString(),
            metadata: {
              messageCount: messages.length,
            },
          });
        }
      }

      return facts;
    }

    if (episode.type === "behavior") {
      const payload = episode.payload as {
        relatedPlanId?: string;
        action?: string;
        reason?: string;
      };
      const actionText = payload.action ?? "";
      const reasonText = payload.reason ?? "";

      if (
        payload.relatedPlanId &&
        /(学习|作业|复习|准备考试|打工|兼职)/.test(`${actionText} ${reasonText}`)
      ) {
        return [
          {
            id: createFactId([episodeId, "plan_progress", payload.relatedPlanId, actionText]),
            type: "plan",
            subject: episode.subjectId,
            predicate: "progressing_plan",
            object: payload.relatedPlanId,
            summary: `${episode.subjectId}正在推进计划 ${payload.relatedPlanId}`,
            confidence: 0.7,
            evidenceEpisodeId: episodeId,
            validAt: episode.happenedAt.toISOString(),
            metadata: {
              action: payload.action,
              reason: payload.reason,
            },
          },
        ];
      }
    }

    return [];
  },
};


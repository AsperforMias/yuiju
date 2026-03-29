import type { MemoryEpisode } from "./episode";

export interface WriteEpisodeInput {
  is_dev?: boolean;
  episode: MemoryEpisode;
}

export interface SearchMemoryInput {
  query: string;
  is_dev?: boolean;
  top_k?: number;
  counterparty_name?: string;
  filters?: Record<string, unknown>;
}

export interface MemorySearchItem {
  memory: string;
  time?: string | null;
  source?: string | null;
  score?: number | null;
  validFrom?: string | null;
  validTo?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export class MemoryServiceClient {
  constructor(private baseUrl: string) {}

  /**
   * 写入通过准入判断的 Episode，由 Python 服务负责进一步做 Graphiti 受控抽取。
   */
  async writeEpisode(input: WriteEpisodeInput): Promise<string[]> {
    const res = await fetch(new URL("/v1/episodes", this.baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        is_dev: input.is_dev,
        episode: input.episode,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`MemoryService writeEpisode failed: ${res.status} ${text}`);
    }

    const json = (await res.json()) as { memory_ids?: unknown };
    return Array.isArray(json.memory_ids)
      ? json.memory_ids.filter((item): item is string => typeof item === "string")
      : [];
  }

  /**
   * 检索相关记忆。
   *
   * 说明：
   * - 当前同时兼容旧版 Python 服务的简单结果结构；
   * - 当服务端补充 evidence / metadata 后，调用方可直接消费这些字段。
   */
  async searchMemory(input: SearchMemoryInput): Promise<MemorySearchItem[]> {
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

    return json as MemorySearchItem[];
  }
}

/**
 *
 * 说明：
 * - 该函数返回 null，用于让调用方（world/message）在未配置时选择跳过写入/检索。
 */
export function getMemoryServiceClientFromEnv(): MemoryServiceClient | null {
  return new MemoryServiceClient("http://localhost:9196");
}

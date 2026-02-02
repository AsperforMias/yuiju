export interface WriteEpisodeInput {
  is_dev?: boolean;
  type: string;
  counterparty_name?: string;
  content: unknown;
  reference_time: Date | string;
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
}

export class MemoryServiceClient {
  constructor(private baseUrl: string) {}

  /**
   * 写入一条 episode。
   *
   * - content 允许传对象；服务端会统一序列化处理
   * - reference_time 统一以 ISO 字符串传输，避免时区歧义
   */
  async writeEpisode(input: WriteEpisodeInput): Promise<void> {
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

  /**
   * 检索相关记忆（默认返回服务端给出的结构列表）。
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
 * 从环境变量创建 MemoryServiceClient。
 *
 * 约定：
 * - MEMORY_SERVICE_URL: e.g. http://127.0.0.1:8001
 *
 * 说明：
 * - 该函数返回 null，用于让调用方（world/message）在未配置时选择跳过写入/检索。
 */
export function getMemoryServiceClientFromEnv(): MemoryServiceClient | null {
  return new MemoryServiceClient("http://localhost:9196");
}

import dayjs from "dayjs";
import { Hono } from "hono";
import { rejectPublicRequest } from "./public-guard";

type LogService = "all" | "world" | "message";
type LogLevel = "debug" | "info" | "warn" | "error";

type LokiStream = {
  stream: Record<string, string>;
  values: [string, string][];
};

type LokiQueryRangeResponse = {
  status: string;
  data?: {
    resultType: string;
    result: LokiStream[];
  };
  error?: string;
};

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

const ALLOWED_LEVELS = new Set<LogLevel>(["debug", "info", "warn", "error"]);

const normalizeService = (value: string | undefined): LogService => {
  if (value === "world" || value === "message") {
    return value;
  }
  return "all";
};

const normalizeLimit = (value: string | undefined) => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
};

const normalizeLevel = (value: string | undefined): LogLevel | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;

  if (ALLOWED_LEVELS.has(normalized as LogLevel)) {
    return normalized as LogLevel;
  }

  return undefined;
};

const parseDateStartNs = (value: string | undefined) => {
  if (!value) return undefined;
  const parsed = dayjs(value, "YYYY-MM-DD", true);
  if (!parsed.isValid()) return undefined;
  return `${parsed.startOf("day").valueOf()}000000`;
};

const parseDateEndNs = (value: string | undefined) => {
  if (!value) return undefined;
  const parsed = dayjs(value, "YYYY-MM-DD", true);
  if (!parsed.isValid()) return undefined;
  return `${parsed.add(1, "day").startOf("day").valueOf()}000000`;
};

const getSelector = (service: LogService, level?: LogLevel) => {
  const labels: string[] = [];

  if (service === "world") {
    labels.push('service="world"');
  } else if (service === "message") {
    labels.push('service="message"');
  } else {
    labels.push('service=~"world|message"');
  }

  if (level) {
    labels.push(`level="${level}"`);
  }

  return `{${labels.join(",")}}`;
};

const buildLogql = (service: LogService, keyword?: string, level?: LogLevel) => {
  let query = getSelector(service, level);

  const normalizedKeyword = keyword?.trim();
  if (normalizedKeyword) {
    query += ` |= ${JSON.stringify(normalizedKeyword)}`;
  }

  return query;
};

const parseLogLine = (line: string) => {
  const regex = /^\[([^\]]+)\]\s+\[([^\]]+)\]\s*(.*)$/;
  const match = regex.exec(line);
  if (!match) {
    return {
      timestamp: "",
      level: "unknown",
      message: line,
    };
  }

  return {
    timestamp: match[1] || "",
    level: (match[2] || "unknown").toLowerCase(),
    message: match[3] || "",
  };
};

export const logsRoute = new Hono();

logsRoute.use("*", async (context, next) => {
  const blocked = rejectPublicRequest(context);
  if (blocked) {
    return blocked;
  }
  await next();
});

logsRoute.get("/search", async (context) => {
  const service = normalizeService(context.req.query("service"));
  const keyword = context.req.query("keyword")?.trim();
  const level = normalizeLevel(context.req.query("level"));
  const startNs = parseDateStartNs(context.req.query("startDate"));
  const endNs = parseDateEndNs(context.req.query("endDate"));
  const limit = normalizeLimit(context.req.query("limit"));

  const query = buildLogql(service, keyword, level);
  const lokiBaseUrl = process.env.LOKI_BASE_URL || "http://127.0.0.1:3100";

  const params = new URLSearchParams({
    query,
    limit: String(limit),
    direction: "BACKWARD",
  });

  if (startNs) params.set("start", startNs);
  if (endNs) params.set("end", endNs);

  const response = await fetch(`${lokiBaseUrl}/loki/api/v1/query_range?${params.toString()}`, {
    cache: "no-store",
  });

  const payload = (await response.json()) as LokiQueryRangeResponse;

  if (!response.ok || payload.status !== "success") {
    return context.json(
      {
        code: 502,
        data: null,
        message: payload.error || "Loki 查询失败",
      },
      502,
    );
  }

  const items = (payload.data?.result || [])
    .flatMap((stream) => {
      return stream.values.map(([tsNs, line]) => {
        const parsed = parseLogLine(line);
        const timestampMs = Number.parseInt(tsNs.slice(0, 13), 10);
        return {
          tsNs,
          service: stream.stream.service || "unknown",
          level: parsed.level || stream.stream.level || "unknown",
          time: Number.isFinite(timestampMs)
            ? dayjs(timestampMs).format("YYYY-MM-DD HH:mm:ss")
            : parsed.timestamp,
          line,
          message: parsed.message,
        };
      });
    })
    .sort((a, b) => b.tsNs.localeCompare(a.tsNs));

  return context.json({
    code: 0,
    data: {
      items,
      query: {
        service,
        keyword: keyword || "",
        level: level || "",
        startDate: context.req.query("startDate") || "",
        endDate: context.req.query("endDate") || "",
        limit,
      },
      total: items.length,
    },
    message: "ok",
  });
});

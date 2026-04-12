import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getYuijuConfig, getYuijuProjectRoot, type YuijuStickerConfig } from "@yuiju/utils";
import { logger } from "@/utils/logger";

export interface ResolvedSticker {
  key: string;
  description: string;
  originalUri: string;
  absoluteUri: string;
  fileBuffer: Buffer;
}

const stickerRegistry = new Map<string, ResolvedSticker>();
let hasInitializedStickerRegistry = false;

/**
 * 启动时预处理表情包配置，产出可复用的只读注册表。
 *
 * 说明：
 * - 只在消息服务启动阶段初始化一次，避免每次发送消息都重复解析路径；
 * - 无效项只记录日志并跳过，不阻塞服务启动；
 * - 成功加载的表情包会缓存到内存，供提示词与发送链路复用；
 * - 图片文件会在启动时直接读入内存，避免发送时再依赖本地路径格式。
 */
export async function initializeStickerRegistry() {
  if (hasInitializedStickerRegistry) {
    return;
  }

  hasInitializedStickerRegistry = true;

  const projectRoot = getYuijuProjectRoot();
  const stickers = getYuijuConfig().message.stickers;
  const loadedKeys: string[] = [];

  for (const [key, value] of Object.entries(stickers)) {
    const resolvedSticker = await resolveStickerConfig({
      key,
      value,
      projectRoot,
    });

    if (!resolvedSticker) {
      continue;
    }

    stickerRegistry.set(key, resolvedSticker);
    loadedKeys.push(key);
  }

  if (!loadedKeys.length) {
    logger.warn("[message.sticker] 当前无可用表情包，LLM 不应输出 [[sticker:*]] 标记");
    return;
  }

  logger.info("[message.sticker] 已加载表情包", {
    count: loadedKeys.length,
    stickers: loadedKeys,
  });
}

/**
 * 获取指定 key 对应的已加载表情包。
 */
export function getResolvedSticker(key: string): ResolvedSticker | null {
  return stickerRegistry.get(key) || null;
}

/**
 * 获取当前可用表情包列表，供提示词构造使用。
 */
export function listResolvedStickers(): ResolvedSticker[] {
  return [...stickerRegistry.values()];
}

/**
 * 生成给 LLM 使用的表情包提示词片段。
 *
 * 说明：
 * - 没有可用表情包时，会明确禁止模型输出 sticker 标记；
 * - 有可用表情包时，会列出 key 与说明，并强调一般放在回复末尾。
 */
export function buildStickerPromptSection(): string {
  const stickers = listResolvedStickers();
  if (!stickers.length) {
    return ["## 表情包使用规则", "当前没有可用表情包，不要输出任何 `[[sticker:key]]` 标记。"].join(
      "\n",
    );
  }

  const stickerList = stickers
    .map((sticker) => `- ${sticker.key}: ${sticker.description}`)
    .join("\n");

  return [
    "## 表情包使用规则",
    "你可以在回复中使用表情包，格式必须是 `[[sticker:key]]`。",
    "只能使用下面这些 key，不能输出文件路径，也不能创造不存在的 key。",
    "表情包一般放在整条回复最后；如果没有必要，就不要使用表情包。",
    "可用表情包列表：",
    stickerList,
  ].join("\n");
}

async function resolveStickerConfig(input: {
  key: string;
  value: YuijuStickerConfig;
  projectRoot: string;
}): Promise<ResolvedSticker | null> {
  const key = input.key.trim();
  const uri = input.value?.uri?.trim();
  const description = input.value?.description?.trim();

  if (!key || !uri || !description) {
    logger.warn("[message.sticker] 跳过无效表情包配置", {
      key: input.key,
      uri: input.value?.uri,
      description: input.value?.description,
      reason: "key、uri 或 description 为空",
    });
    return null;
  }

  const absoluteUri = resolve(input.projectRoot, uri);

  try {
    const fileBuffer = await readFile(absoluteUri);

    return {
      key,
      description,
      originalUri: uri,
      absoluteUri,
      fileBuffer,
    };
  } catch (error) {
    logger.warn("[message.sticker] 跳过不可读取的表情包文件", {
      key,
      uri,
      absoluteUri,
      error,
    });
    return null;
  }
}

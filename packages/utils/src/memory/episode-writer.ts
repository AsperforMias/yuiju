import type { MemoryEpisodeWriteInput } from "./episode";
import { saveMemoryEpisode } from "../db";

/**
 * 统一 Episode 发射入口。
 *
 * 当前阶段说明：
 * - world/message 已切换为先构造统一 Episode 再调用该函数；
 * - Python 服务尚未升级到统一契约，因此这里先保持无副作用；
 * - 下一阶段只需在这里补上协议映射与真实写入，无需回头改业务主流程。
 */
export async function emitMemoryEpisode(episode: MemoryEpisodeWriteInput): Promise<void> {
  await saveMemoryEpisode(episode);
}

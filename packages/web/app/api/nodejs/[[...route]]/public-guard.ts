import type { Context } from "hono";
import { isPublicDeployment } from "@/lib/public-deployment";

// 关键函数：对外展示环境直接返回 404，避免暴露内部接口。
export const rejectPublicRequest = (context: Context) => {
  if (!isPublicDeployment()) {
    return null;
  }
  return context.notFound();
};

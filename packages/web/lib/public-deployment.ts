import "server-only";

import "@yuiju/utils/env";

const parseBoolean = (value: string | undefined): boolean => {
  if (!value) return false;
  return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
};

// 核心逻辑：PUBLIC_DEPLOYMENT=true 时视为对外展示。
export const isPublicDeployment = (): boolean => {
  return parseBoolean(process.env.PUBLIC_DEPLOYMENT);
};

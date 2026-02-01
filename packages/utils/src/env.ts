import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const findDotEnvPath = (startDir: string) => {
  let currentDir = startDir;
  for (let i = 0; i < 10; i += 1) {
    const candidate = path.join(currentDir, ".env");
    if (fs.existsSync(candidate)) return candidate;

    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }
  return null;
};

const dotEnvPath = findDotEnvPath(process.cwd());
if (dotEnvPath) dotenv.config({ path: dotEnvPath });

export const isDev = process.env.NODE_ENV === "development";
export const isProd = process.env.NODE_ENV === "production";

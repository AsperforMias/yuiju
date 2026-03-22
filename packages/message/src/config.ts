import type { NCWebsocketOptions } from "node-napcat-ts";

interface AppConfig {
  // Napcat 配置
  napcat: NCWebsocketOptions;
  // QQ 聊天白名单
  whiteList: number[];
  // MongoDB connection URI
  mongoUri: string;
}

export const config: AppConfig = {
  napcat: {
    protocol: "ws",
    host: "192.168.31.10",
    port: 3001,
    reconnection: {
      enable: true,
      attempts: 10,
      delay: 5000,
    },
  },
  whiteList: [1918418506],
  mongoUri: process.env.MONGO_URI || "",
};

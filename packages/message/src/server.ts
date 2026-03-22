import "@yuiju/utils/env";
import { connectDB } from "@yuiju/utils";
import { NCWebsocket } from "node-napcat-ts";
import { config } from "@/config";
import { groupMessageHandler } from "./handler/group-message";
import { privateMessageHandler } from "./handler/private-message";

const napcat = new NCWebsocket(
  {
    ...config.napcat,
    accessToken: process.env.NAPCAT_TOKEN || "",
    throwPromise: true,
  },
  false,
);

napcat.on("message.private", (context) => privateMessageHandler(context, napcat));

napcat.on("message.group", (context) => groupMessageHandler(context, napcat));

async function main() {
  await connectDB();
  await napcat.connect();
}

main();

import { connectDB, getYuijuConfig } from "@yuiju/utils";
import { NCWebsocket, Structs } from "node-napcat-ts";
import { groupMessageHandler } from "./handler/group-message";
import { noticePokeHandler } from "./handler/notice-poke";
import { privateMessageHandler } from "./handler/private-message";

const config = getYuijuConfig();

const napcat = new NCWebsocket(config.message.napcat);

napcat.on("message.private", (context) => privateMessageHandler(context, napcat));

// napcat.on("message.group", (context) => groupMessageHandler(context, napcat));
napcat.on("message.group", async (context) => {
  console.log(context.message);
  const msg = await napcat.get_msg({
    message_id: 535626068,
  });
  console.log(1, msg);
  // napcat.send_group_msg({
  //   group_id: context.group_id,
  //   message: [
  //     Structs.image(
  //       "https://multimedia.nt.qq.com.cn/download?appid=1407&fileid=EhSPsKt-0fpzZTusg9WnnWlMdHmLRRji0hYg_woo3YSW0dXlkwMyBHByb2RQgL2jAVoQ54gA-WeiLI1-_vmXxmgvKXoC0raCAQJneg&rkey=CAESMJ73MiGVRI2QUivaEXYwmx_F72GOmBTNt8vGNlPWBNMlRsc2Hza5hzy0SohJEPf2pg",
  //       "动画表情",
  //     ),
  //   ],
  // });
});

napcat.on("notice.notify.poke", (context) => noticePokeHandler(context, napcat));

async function main() {
  await connectDB();
  await napcat.connect();
}

main();

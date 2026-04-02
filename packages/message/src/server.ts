import { connectDB, getYuijuConfig } from "@yuiju/utils";
import { NCWebsocket, Structs } from "node-napcat-ts";
import { groupMessageHandler } from "./handler/group-message";
import { privateMessageHandler } from "./handler/private-message";

const config = getYuijuConfig();

const napcat = new NCWebsocket(config.message.napcat);

napcat.on("message.private", (context) => privateMessageHandler(context, napcat));

// napcat.on("message.group", (context) => groupMessageHandler(context, napcat));
napcat.on("message.group", (context) => {
  // console.log(context.message);
  napcat.send_group_msg({
    group_id: context.group_id,
    // user_id: context.sender.user_id,
    message: [
      Structs.image(
        "https://multimedia.nt.qq.com.cn/download?appid=1407&fileid=EhT7w3hcR9IZRi2ta1gTNkZNhgXoDBj8glMg_wootp-H29rPkwMyBHByb2RQgL2jAVoQtEdkW0jyfuM-kZA4tq1E8XoCl-GCAQJneg&rkey=CAMSMN8QDFtI_3a277Tu1aAQElBh4kHOnKbYV6dKq7Zjiz7V66xXeaGLsj31wazWmHqUUg",
        "动画表情",
      ),
    ],
  });
});

napcat.fetch_custom_face();

async function main() {
  await connectDB();
  await napcat.connect();
}

main();

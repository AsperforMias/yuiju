// Review: profile 相关的设置都存在浏览器中（localStorage），不需要这个接口了。
import { Hono } from "hono";

export const profileRoute = new Hono();

profileRoute.get("/profile", (context) => {
  const userName = process.env.WEB_PROFILE_USER_NAME ?? "yixiaojiu";
  const theme = process.env.WEB_PROFILE_THEME ?? "日系简约";

  return context.json({
    code: 0,
    data: {
      userName,
      theme,
    },
    message: "ok",
  });
});

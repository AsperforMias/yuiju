import { Hono } from "hono";

export const profileRoute = new Hono();

profileRoute.get("/index", (context) => {
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

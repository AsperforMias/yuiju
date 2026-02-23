import { Hono } from "hono";

export const profileRoute = new Hono();

profileRoute.get("/", (context) => {
  return context.json({
    code: 0,
    data: {
      userName: "yixiaojiu",
      theme: "日系简约",
    },
    message: "ok",
  });
});

export type ActivityEvent = {
  time: string;
  behavior: string;
  desc: string;
  trigger: "agent" | "user" | "system";
  duration: number;
};

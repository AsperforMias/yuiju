export type ActivityEvent = {
  time: string;
  behavior: string;
  desc: string;
  trigger: "agent" | "user" | "system";
  duration: number;
};

// Review: 去掉默认值
export const defaultActivityEvents: ActivityEvent[] = [
  {
    time: "09:12",
    behavior: "吃东西",
    desc: "吃了一个苹果，恢复体力。",
    trigger: "agent",
    duration: 12,
  },
  {
    time: "10:12",
    behavior: "喝水",
    desc: "补充水分，保持清醒。",
    trigger: "system",
    duration: 1,
  },
  {
    time: "11:50",
    behavior: "学习",
    desc: "完成数学练习，获得一些进展。",
    trigger: "agent",
    duration: 45,
  },
  {
    time: "14:20",
    behavior: "发呆",
    desc: "短暂停留发呆，节奏放慢。",
    trigger: "system",
    duration: 6,
  },
  {
    time: "16:40",
    behavior: "购物",
    desc: "去商店购买了面包和水。",
    trigger: "agent",
    duration: 18,
  },
  {
    time: "18:05",
    behavior: "用户互动",
    desc: "收到零花钱，心情变好了一点。",
    trigger: "user",
    duration: 2,
  },
  {
    time: "19:32",
    behavior: "休息",
    desc: "在家休息，恢复一点体力。",
    trigger: "agent",
    duration: 20,
  },
];

export const defaultActivityEventsCount = defaultActivityEvents.length;

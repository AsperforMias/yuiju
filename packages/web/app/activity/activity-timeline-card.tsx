import styles from "./activity.module.css";

export type ActivityEvent = {
  time: string;
  behavior: string;
  desc: string;
  trigger: "agent" | "user" | "system";
  duration: number;
};

type ActivityTimelineCardProps = {
  events?: ActivityEvent[];
};

const defaultEvents: ActivityEvent[] = [
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

export const defaultActivityEventsCount = defaultEvents.length;

export function ActivityTimelineCard({ events }: ActivityTimelineCardProps) {
  const displayEvents = events && events.length > 0 ? events : defaultEvents;

  return (
    <section className="border border-[#d9e6f5] rounded-2xl bg-[rgba(255,255,255,0.88)] shadow-[0_10px_25px_rgba(21,33,54,0.06)] overflow-hidden">
      <div className="p-[14px] grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="m-0 text-[14px] font-black">行为时间线</h3>
          <span className="inline-flex items-center gap-[6px] px-[10px] py-2 rounded-full text-[12px] border border-[rgba(217,230,245,0.85)] bg-[rgba(255,255,255,0.85)] text-[#2b2f36] bg-[rgba(175,122,197,0.12)] border-[rgba(175,122,197,0.25)]">
            仅展示库字段
          </span>
        </div>

        <div className="grid grid-cols-3 gap-[10px] max-[520px]:grid-cols-1">
          <div className="grid gap-[6px]">
            <label className="text-[12px] text-[#6b7480]" htmlFor="timeRange">
              时间范围
            </label>
            <select
              id="timeRange"
              className="w-full rounded-xl border border-[rgba(217,230,245,0.95)] bg-[rgba(255,255,255,0.85)] px-3 py-[10px] outline-none transition-[border-color,box-shadow] duration-[160ms] ease focus:border-[rgba(145,196,238,0.55)] focus:shadow-[0_0_0_4px_rgba(145,196,238,0.18)] text-[#2b2f36]"
              disabled
            >
              <option>今天</option>
              <option>近 7 天</option>
              <option>自定义</option>
            </select>
          </div>

          <div className="grid gap-[6px]">
            <label className="text-[12px] text-[#6b7480]" htmlFor="trigger">
              trigger
            </label>
            <select
              id="trigger"
              className="w-full rounded-xl border border-[rgba(217,230,245,0.95)] bg-[rgba(255,255,255,0.85)] px-3 py-[10px] outline-none transition-[border-color,box-shadow] duration-[160ms] ease focus:border-[rgba(145,196,238,0.55)] focus:shadow-[0_0_0_4px_rgba(145,196,238,0.18)] text-[#2b2f36]"
              disabled
            >
              <option>全部</option>
              <option>agent</option>
              <option>user</option>
              <option>system</option>
            </select>
          </div>

          <div className="grid gap-[6px]">
            <label className="text-[12px] text-[#6b7480]" htmlFor="keyword">
              behavior 搜索
            </label>
            <input
              id="keyword"
              className="w-full rounded-xl border border-[rgba(217,230,245,0.95)] bg-[rgba(255,255,255,0.85)] px-3 py-[10px] outline-none transition-[border-color,box-shadow] duration-[160ms] ease focus:border-[rgba(145,196,238,0.55)] focus:shadow-[0_0_0_4px_rgba(145,196,238,0.18)] text-[#2b2f36]"
              placeholder="例如：吃东西 / 购物 / 发呆"
              disabled
            />
          </div>
        </div>

        <div className="relative pl-[18px] grid gap-3 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[rgba(145,196,238,0.6)] before:rounded-full">
          {displayEvents.map((item) => {
            const tone =
              item.trigger === "agent"
                ? "bg-[rgba(145,196,238,0.18)] border-[rgba(145,196,238,0.3)]"
                : item.trigger === "user"
                  ? "bg-[rgba(250,227,190,0.75)] border-[rgba(250,227,190,0.85)]"
                  : "bg-[rgba(175,122,197,0.14)] border-[rgba(175,122,197,0.25)]";

            return (
              <article
                key={`${item.time}-${item.behavior}`}
                className="relative rounded-2xl border border-[rgba(217,230,245,0.9)] bg-[rgba(255,255,255,0.84)] shadow-[0_10px_25px_rgba(21,33,54,0.06)] p-3 grid gap-2 before:content-[''] before:absolute before:-left-3.5 before:top-[18px] before:w-2.5 before:h-2.5 before:rounded-full before:bg-[rgba(145,196,238,0.9)] before:border-2 before:border-[rgba(247,251,255,1)]"
              >
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2">
                    <h3 className="m-0 text-[14px] font-black">{item.behavior}</h3>
                    <span
                      className={`text-[12px] px-[10px] py-[7px] rounded-full border border-[rgba(217,230,245,0.85)] bg-[rgba(247,251,255,0.9)] text-[#6b7480] ${tone}`}
                    >
                      {item.trigger}
                    </span>
                  </div>
                  <span className="text-[12px] text-[#6b7480]">
                    {item.time} · {item.duration}min
                  </span>
                </div>
                <p className="m-0 text-[13px] text-[#6b7480]">{item.desc}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

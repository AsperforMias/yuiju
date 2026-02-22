import styles from "./activity.module.css";

export function ActivityTimelineCard() {
  const events = [
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

  return (
    <section className={styles["activity-card"]}>
      <div className={`${styles["activity-card-body"]} ${styles["activity-timeline"]}`}>
        <div className={styles["activity-card-head"]}>
          <h3 className={styles["activity-card-title"]}>行为时间线</h3>
          <span className={`${styles["activity-badge"]} ${styles["activity-badge-secondary"]}`}>
            仅展示库字段
          </span>
        </div>

        <div className={styles["activity-filters"]}>
          <div className={styles["activity-field"]}>
            <label htmlFor="timeRange">时间范围</label>
            <select id="timeRange" className={styles["activity-input"]} disabled>
              <option>今天</option>
              <option>近 7 天</option>
              <option>自定义</option>
            </select>
          </div>

          <div className={styles["activity-field"]}>
            <label htmlFor="trigger">trigger</label>
            <select id="trigger" className={styles["activity-input"]} disabled>
              <option>全部</option>
              <option>agent</option>
              <option>user</option>
              <option>system</option>
            </select>
          </div>

          <div className={styles["activity-field"]}>
            <label htmlFor="keyword">behavior 搜索</label>
            <input
              id="keyword"
              className={styles["activity-input"]}
              placeholder="例如：吃东西 / 购物 / 发呆"
              disabled
            />
          </div>
        </div>

        <div className={styles["activity-events"]}>
          {events.map((item) => {
            const tone =
              item.trigger === "agent"
                ? styles["activity-tag-agent"]
                : item.trigger === "user"
                  ? styles["activity-tag-user"]
                  : styles["activity-tag-system"];

            return (
              <article key={`${item.time}-${item.behavior}`} className={styles["activity-event"]}>
                <div className={styles["activity-event-top"]}>
                  <div className={styles["activity-mini"]}>
                    <h3 className={styles["activity-event-title"]}>{item.behavior}</h3>
                    <span className={`${styles["activity-tag"]} ${tone}`}>{item.trigger}</span>
                  </div>
                  <span className={styles["activity-event-time"]}>
                    {item.time} · {item.duration}min
                  </span>
                </div>
                <p className={styles["activity-event-desc"]}>{item.desc}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

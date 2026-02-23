import styles from "../home.module.css";

type HomeStatus = {
  behavior: string;
  location: string;
  stamina: { current: number; max: number };
  money: number;
};

type InventoryItem = {
  name: string;
  count: number;
};

type HomePlans = {
  longTerm: string;
  shortTerm: string[];
};

type HomeStatusCardProps = {
  status?: HomeStatus;
  todayActions?: string[];
  inventory?: InventoryItem[];
  plans?: HomePlans;
};

const formatItem = (item: InventoryItem) => `${item.name} ×${item.count}`;

export function HomeStatusCard({
  status,
  todayActions,
  inventory,
  plans,
}: HomeStatusCardProps) {
  const displayStatus: HomeStatus = status ?? {
    behavior: "发呆",
    location: "家",
    stamina: { current: 68, max: 100 },
    money: 128,
  };
  const displayActions = todayActions ?? ["起床", "上学", "吃饭", "发呆"];
  const displayInventory =
    inventory ??
    [
      { name: "苹果", count: 2 },
      { name: "面包", count: 1 },
      { name: "水", count: 1 },
    ];
  const displayPlans: HomePlans =
    plans ?? {
      longTerm: "认真上学，变得更厉害",
      shortTerm: ["复习", "逛商店", "做饭"],
    };
  const inventorySummary = displayInventory.map(formatItem).join(" · ");

  return (
    <section className="border border-[#d9e6f5] rounded-2xl bg-white/90 shadow-[0_10px_25px_rgba(21,33,54,0.06)] overflow-hidden">
      <div className="p-[14px] grid gap-[14px]">
        <div className="flex items-center justify-between gap-[10px]">
          <h3 className="m-0 text-[14px] font-black tracking-[0.2px]">角色状态</h3>
          <button className={styles["home-btn"]} type="button">
            刷新
          </button>
        </div>

        <div className="grid grid-cols-2 gap-[10px] mt-[10px]">
          <div className={styles["home-kv"]}>
            <div className={styles["home-k"]}>当前行为</div>
            <div className={styles["home-v"]}>{displayStatus.behavior}</div>
          </div>
          <div className={styles["home-kv"]}>
            <div className={styles["home-k"]}>当前位置</div>
            <div className={styles["home-v"]}>{displayStatus.location}</div>
          </div>
          <div className={styles["home-kv"]}>
            <div className={styles["home-k"]}>体力</div>
            <div className={styles["home-v"]}>
              {displayStatus.stamina.current}
              <span className={styles["home-muted"]}> / {displayStatus.stamina.max}</span>
            </div>
          </div>
          <div className={styles["home-kv"]}>
            <div className={styles["home-k"]}>金钱</div>
            <div className={styles["home-v"]}>¥ {displayStatus.money}</div>
          </div>
        </div>

        <div className={styles["home-info-card"]}>
          <div className={styles["home-info-card-head"]}>
            <div className={styles["home-info-card-title"]}>今日已执行的行为</div>
          </div>
          <div className={styles["home-chips"]}>
            {displayActions.map((item) => (
              <span key={item} className={styles["home-chip"]}>
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className={styles["home-info-card"]}>
          <div className={styles["home-info-card-head"]}>
            <div className={styles["home-info-card-title"]}>背包</div>
            <div className={styles["home-details-note"]}>{inventorySummary}</div>
          </div>
          <details className={styles["home-details"]}>
            <summary>展开全部</summary>
            <div className={`${styles["home-chips"]} ${styles["home-chips-gap"]}`}>
              {displayInventory.map((item) => (
                <span key={item.name} className={styles["home-chip"]}>
                  {formatItem(item)}
                </span>
              ))}
            </div>
          </details>
        </div>

        <div className={styles["home-plan-block"]}>
          <div className={`${styles["home-kv"]} ${styles["home-kv-stack"]}`}>
            <div className={styles["home-k"]}>长期计划</div>
            <p className={styles["home-note"]}>{displayPlans.longTerm}</p>
          </div>
          <div className={`${styles["home-kv"]} ${styles["home-kv-stack"]}`}>
            <div className={styles["home-k"]}>短期计划</div>
            <ul className={styles["home-plan-list"]}>
              {displayPlans.shortTerm.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

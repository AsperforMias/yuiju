import styles from "../home.module.css";

export function HomeStatusCard() {
  return (
    <section className={styles["home-card"]}>
      <div className={styles["home-card-body"]}>
        <div className={styles["home-card-head"]}>
          <h3 className={styles["home-card-title"]}>角色状态</h3>
          <button className={styles["home-btn"]} type="button">
            刷新
          </button>
        </div>

        <div className={styles["home-kvs"]}>
          <div className={styles["home-kv"]}>
            <div className={styles["home-k"]}>当前行为</div>
            <div className={styles["home-v"]}>发呆</div>
          </div>
          <div className={styles["home-kv"]}>
            <div className={styles["home-k"]}>当前位置</div>
            <div className={styles["home-v"]}>家</div>
          </div>
          <div className={styles["home-kv"]}>
            <div className={styles["home-k"]}>体力</div>
            <div className={styles["home-v"]}>
              68<span className={styles["home-muted"]}> / 100</span>
            </div>
          </div>
          <div className={styles["home-kv"]}>
            <div className={styles["home-k"]}>金钱</div>
            <div className={styles["home-v"]}>¥ 128</div>
          </div>
        </div>

        <div className={styles["home-info-card"]}>
          <div className={styles["home-info-card-head"]}>
            <div className={styles["home-info-card-title"]}>今日已执行的行为</div>
          </div>
          <div className={styles["home-chips"]}>
            <span className={styles["home-chip"]}>起床</span>
            <span className={styles["home-chip"]}>上学</span>
            <span className={styles["home-chip"]}>吃饭</span>
            <span className={styles["home-chip"]}>发呆</span>
          </div>
        </div>

        <div className={styles["home-info-card"]}>
          <div className={styles["home-info-card-head"]}>
            <div className={styles["home-info-card-title"]}>背包</div>
            <div className={styles["home-details-note"]}>苹果 ×2 · 面包 ×1 · 水 ×1</div>
          </div>
          <details className={styles["home-details"]}>
            <summary>展开全部</summary>
            <div className={`${styles["home-chips"]} ${styles["home-chips-gap"]}`}>
              <span className={styles["home-chip"]}>苹果 ×2</span>
              <span className={styles["home-chip"]}>面包 ×1</span>
              <span className={styles["home-chip"]}>水 ×1</span>
            </div>
          </details>
        </div>

        <div className={styles["home-plan-block"]}>
          <div className={`${styles["home-kv"]} ${styles["home-kv-stack"]}`}>
            <div className={styles["home-k"]}>长期计划</div>
            <p className={styles["home-note"]}>认真上学，变得更厉害</p>
          </div>
          <div className={`${styles["home-kv"]} ${styles["home-kv-stack"]}`}>
            <div className={styles["home-k"]}>短期计划</div>
            <ul className={styles["home-plan-list"]}>
              <li>复习</li>
              <li>逛商店</li>
              <li>做饭</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

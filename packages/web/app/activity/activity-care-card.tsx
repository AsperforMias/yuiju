import styles from "./activity.module.css";

export function ActivityCareCard() {
  return (
    <section className={styles["activity-card"]}>
      <div className={`${styles["activity-card-body"]} ${styles["activity-care"]}`}>
        <div className={styles["activity-card-head"]}>
          <h3 className={styles["activity-card-title"]}>轻管理 · 零花钱</h3>
          <span className={`${styles["activity-badge"]} ${styles["activity-badge-accent"]}`}>
            Care
          </span>
        </div>

        <p className={styles["activity-hint"]}>
          面向 C 端用户的“照顾悠酱”入口，风格上避免后台感。此处仅展示 UI，不执行真实操作。
        </p>

        <div className={styles["activity-form-row"]}>
          <div className={styles["activity-field"]}>
            <label htmlFor="money">金额</label>
            <input id="money" className={styles["activity-input"]} defaultValue="20" disabled />
          </div>

          <div className={styles["activity-field"]}>
            <label htmlFor="reason">原因（可选）</label>
            <input
              id="reason"
              className={styles["activity-input"]}
              defaultValue="奖励今天努力学习"
              disabled
            />
          </div>
        </div>

        <div className={styles["activity-btn-row"]}>
          <button
            className={`${styles["activity-btn"]} ${styles["activity-btn-primary"]}`}
            type="button"
            disabled
          >
            发放（+）
          </button>
          <button className={styles["activity-btn"]} type="button" disabled>
            设置为该值
          </button>
        </div>

        <div className={styles["activity-pill"]}>
          <span className={styles["activity-muted"]}>提示</span>&nbsp;<strong>发放</strong>&nbsp;
          <span className={styles["activity-muted"]}>更像“给零花钱”</span>
        </div>
      </div>
    </section>
  );
}

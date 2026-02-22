import styles from "./activity.module.css";

export function ActivityPageHeader() {
  return (
    <div className={styles["activity-page-head"]}>
      <div>
        <h1 className={styles["activity-page-title"]}>动态</h1>
        <p className={styles["activity-page-subtitle"]}>行为时间线 + 轻管理（零花钱）</p>
      </div>

      <div className={styles["activity-pill"]}>
        <span className={styles["activity-muted"]}>今日记录</span>&nbsp;<strong>8 条</strong>
      </div>
    </div>
  );
}

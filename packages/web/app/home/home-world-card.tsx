import styles from "../home.module.css";

export function HomeWorldCard() {
  return (
    <section className={styles["home-card"]}>
      <div className={styles["home-card-body"]}>
        <div className={styles["home-card-head"]}>
          <h3 className={styles["home-card-title"]}>世界状态</h3>
          <span className={styles["home-pill"]}>
            <span className={styles["home-muted"]}>世界时间</span>&nbsp;
            <strong>2026-02-07 19:32</strong>
          </span>
        </div>
      </div>
    </section>
  );
}

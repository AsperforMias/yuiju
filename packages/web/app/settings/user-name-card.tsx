import styles from "./settings.module.css";

export function UserNameCard() {
  return (
    <section className={styles["settings-card"]}>
      <div className={styles["settings-card-body"]}>
        <div className={styles["settings-card-head"]}>
          <h3 className={styles["settings-card-title"]}>对话标识（user_name）</h3>
          <span className={`${styles["settings-badge"]} ${styles["settings-badge-secondary"]}`}>
            Chat
          </span>
        </div>

        <p className={styles["settings-note"]}>
          user_name 将用于对话时的用户标识。此处仅为 UI 稿，不保存到 localStorage。
        </p>

        <div className={styles["settings-field"]}>
          <label className={styles["settings-label"]} htmlFor="userNameInput">
            user_name
          </label>
          <input id="userNameInput" className={styles["settings-input"]} defaultValue="yixiaojiu" />
        </div>

        <div className={styles["settings-btn-row"]}>
          <button
            className={`${styles["settings-btn"]} ${styles["settings-btn-primary"]}`}
            type="button"
            disabled
          >
            保存
          </button>
          <span className={styles["settings-btn-hint"]}>（仅展示按钮状态）</span>
        </div>
      </div>
    </section>
  );
}

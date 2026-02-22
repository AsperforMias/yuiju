import styles from "./settings.module.css";

export function SettingsHeader() {
  return (
    <div className={styles["settings-page-head"]}>
      <div>
        <h1 className={styles["settings-page-title"]}>设置</h1>
        <p className={styles["settings-page-subtitle"]}>只展示 UI，不写入浏览器存储</p>
      </div>

      <div className={styles["settings-theme-pill"]}>
        <span className={styles["settings-theme-label"]}>主题</span>
        <strong>日系简约</strong>
      </div>
    </div>
  );
}

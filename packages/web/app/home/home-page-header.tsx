import styles from "../home.module.css";

export function HomePageHeader() {
  return (
    <div className={styles["home-page-head"]}>
      <div>
        <h1 className={styles["home-page-title"]}>首页</h1>
      </div>

      <div className={styles["home-page-actions"]}>
        <div className={styles["home-pill"]}>
          <span className={styles["home-muted"]}>一句话：</span>
          <strong>悠酱现在在【家】，正在【发呆】</strong>
        </div>
        <button className={`${styles["home-btn"]} ${styles["home-btn-secondary"]}`} type="button">
          <svg className={styles["home-icon"]} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M7 18.5h7.2c3.7 0 6.3-2.4 6.3-5.8S17.9 7 14.2 7H9.8C6.1 7 3.5 9.4 3.5 12.7c0 1.8.8 3.4 2.2 4.5L5 21l4-2.5Z"
              stroke="rgba(43,47,54,0.9)"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          手机聊天
        </button>
      </div>
    </div>
  );
}

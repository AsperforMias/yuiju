import styles from "../home.module.css";

type HomeMapCardProps = {
  location?: string;
};

const mapNodes = [
  { name: "家", left: "22%", top: "62%", tag: "当前" },
  { name: "学校", left: "55%", top: "48%", tag: "可前往" },
  { name: "商店", left: "78%", top: "68%", tag: "可前往" },
];

export function HomeMapCard({ location }: HomeMapCardProps) {
  const currentLocation = location ?? "家";
  return (
    <section className={styles["home-card"]}>
      <div className={styles["home-map-shell"]}>
        <div className={styles["home-map-head"]}>
          <h3 className={styles["home-card-title"]}>世界地图（RPG 示意）</h3>
          <div className={styles["home-map-tools"]}>
            <span className={styles["home-pill"]}>
              <span className={styles["home-muted"]}>当前位置</span>&nbsp;
              <strong>{currentLocation}</strong>
            </span>
            <button
              className={`${styles["home-btn"]} ${styles["home-btn-icon"]}`}
              type="button"
              aria-label="放大地图"
            >
              <svg
                className={styles["home-icon"]}
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M9 5H6a1 1 0 0 0-1 1v3M15 5h3a1 1 0 0 1 1 1v3M9 19H6a1 1 0 0 1-1-1v-3M15 19h3a1 1 0 0 0 1-1v-3"
                  stroke="rgba(43,47,54,0.9)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className={styles["home-map"]}>
          <section className={styles["home-rpg-map"]} aria-label="二维地图">
            <svg
              className={styles["home-map-edges"]}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line x1="22" y1="62" x2="55" y2="48" />
              <line x1="55" y1="48" x2="78" y2="68" />
              <line x1="22" y1="62" x2="78" y2="68" />
            </svg>

            {mapNodes.map((node) => {
              const isActive = node.name === currentLocation;
              return (
                <div
                  key={node.name}
                  className={`${styles["home-map-node"]} ${
                    isActive ? styles["home-map-node-active"] : ""
                  }`}
                  style={{ left: node.left, top: node.top }}
                >
                  <div className={styles["home-node-card"]}>
                    <div className={styles["home-node-name"]}>{node.name}</div>
                    <div className={styles["home-node-tag"]}>
                      {isActive ? "当前" : node.tag}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </section>
  );
}

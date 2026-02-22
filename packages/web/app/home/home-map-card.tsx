export function HomeMapCard() {
  return (
    <section className="home-card">
      <div className="home-map-shell">
        <div className="home-map-head">
          <h3 className="home-card-title">世界地图（RPG 示意）</h3>
          <div className="home-map-tools">
            <span className="home-pill">
              <span className="home-muted">当前位置</span>&nbsp;<strong>家</strong>
            </span>
            <button className="home-btn home-btn-icon" type="button" aria-label="放大地图">
              <svg className="home-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

        <div className="home-map">
          <div className="home-rpg-map" aria-label="二维地图">
            <svg className="home-map-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <line x1="22" y1="62" x2="55" y2="48" />
              <line x1="55" y1="48" x2="78" y2="68" />
              <line x1="22" y1="62" x2="78" y2="68" />
            </svg>

            <div className="home-map-node home-map-node-active" style={{ left: '22%', top: '62%' }}>
              <div className="home-node-card">
                <div className="home-node-name">家</div>
                <div className="home-node-tag">当前</div>
              </div>
            </div>
            <div className="home-map-node" style={{ left: '55%', top: '48%' }}>
              <div className="home-node-card">
                <div className="home-node-name">学校</div>
                <div className="home-node-tag">可前往</div>
              </div>
            </div>
            <div className="home-map-node" style={{ left: '78%', top: '68%' }}>
              <div className="home-node-card">
                <div className="home-node-name">商店</div>
                <div className="home-node-tag">可前往</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

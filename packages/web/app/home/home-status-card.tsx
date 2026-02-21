export function HomeStatusCard() {
  return (
    <section className="home-card">
      <div className="home-card-body">
        <div className="home-card-head">
          <h3 className="home-card-title">角色状态</h3>
          <button className="home-btn" type="button">
            刷新
          </button>
        </div>

        <div className="home-kvs">
          <div className="home-kv">
            <div className="home-k">当前行为</div>
            <div className="home-v">发呆</div>
          </div>
          <div className="home-kv">
            <div className="home-k">当前位置</div>
            <div className="home-v">家</div>
          </div>
          <div className="home-kv">
            <div className="home-k">体力</div>
            <div className="home-v">
              68<span className="home-muted"> / 100</span>
            </div>
          </div>
          <div className="home-kv">
            <div className="home-k">金钱</div>
            <div className="home-v">¥ 128</div>
          </div>
        </div>

        <div className="home-info-card">
          <div className="home-info-card-head">
            <div className="home-info-card-title">今日已执行的行为</div>
          </div>
          <div className="home-chips">
            <span className="home-chip">起床</span>
            <span className="home-chip">上学</span>
            <span className="home-chip">吃饭</span>
            <span className="home-chip">发呆</span>
          </div>
        </div>

        <div className="home-info-card">
          <div className="home-info-card-head">
            <div className="home-info-card-title">背包</div>
            <div className="home-details-note">苹果 ×2 · 面包 ×1 · 水 ×1</div>
          </div>
          <details className="home-details">
            <summary>展开全部</summary>
            <div className="home-chips home-chips-gap">
              <span className="home-chip">苹果 ×2</span>
              <span className="home-chip">面包 ×1</span>
              <span className="home-chip">水 ×1</span>
            </div>
          </details>
        </div>

        <div className="home-plan-block">
          <div className="home-kv home-kv-stack">
            <div className="home-k">长期计划</div>
            <p className="home-note">认真上学，变得更厉害</p>
          </div>
          <div className="home-kv home-kv-stack">
            <div className="home-k">短期计划</div>
            <ul className="home-plan-list">
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

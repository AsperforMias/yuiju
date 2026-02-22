export function ActivityCareCard() {
  return (
    <section className="activity-card">
      <div className="activity-card-body activity-care">
        <div className="activity-card-head">
          <h3 className="activity-card-title">轻管理 · 零花钱</h3>
          <span className="activity-badge activity-badge-accent">Care</span>
        </div>

        <p className="activity-hint">
          面向 C 端用户的“照顾悠酱”入口，风格上避免后台感。此处仅展示 UI，不执行真实操作。
        </p>

        <div className="activity-form-row">
          <div className="activity-field">
            <label htmlFor="money">金额</label>
            <input id="money" className="activity-input" defaultValue="20" disabled />
          </div>

          <div className="activity-field">
            <label htmlFor="reason">原因（可选）</label>
            <input id="reason" className="activity-input" defaultValue="奖励今天努力学习" disabled />
          </div>
        </div>

        <div className="activity-btn-row">
          <button className="activity-btn activity-btn-primary" type="button" disabled>
            发放（+）
          </button>
          <button className="activity-btn" type="button" disabled>
            设置为该值
          </button>
        </div>

        <div className="activity-pill">
          <span className="activity-muted">提示</span>&nbsp;<strong>发放</strong>&nbsp;
          <span className="activity-muted">更像“给零花钱”</span>
        </div>

      </div>
    </section>
  );
}

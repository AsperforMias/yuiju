export function ActivityCareCard() {
  return (
    <section className="activity-card">
      <div className="activity-card-body">
        <h3 className="activity-card-title">轻管理（零花钱）</h3>

        <div className="activity-field">
          <label htmlFor="money">调整金额</label>
          <input id="money" className="activity-input" defaultValue="20" />
        </div>

        <button className="activity-btn" type="button" disabled>
          设置为该值
        </button>

        <p className="activity-note">
          选中某条行为后，这里可以展示 behavior / description / timestamp / trigger 等字段。
        </p>
      </div>
    </section>
  );
}

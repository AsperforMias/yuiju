export function ActivityPageHeader() {
  return (
    <div className="activity-page-head">
      <div>
        <h1 className="activity-page-title">动态</h1>
        <p className="activity-page-subtitle">行为时间线 + 轻管理（零花钱）</p>
      </div>

      <div className="activity-pill">
        <span className="activity-muted">今日记录</span>&nbsp;<strong>8 条</strong>
      </div>
    </div>
  );
}

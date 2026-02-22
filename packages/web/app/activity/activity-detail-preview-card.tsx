const detailPreview = `{
  "behavior": "吃东西",
  "description": "吃了一个苹果，恢复体力",
  "timestamp": "2026-02-07T11:12:00.000Z",
  "trigger": "agent",
  "duration_minutes": 12,
  "parameters": [
    { "value": "苹果", "quantity": 1, "reason": "补充体力", "extra": { "stamina": 15 } }
  ]
}`;

export function ActivityDetailPreviewCard() {
  return (
    <section className="activity-card">
      <div className="activity-card-body">
        <div className="activity-card-head">
          <h3 className="activity-card-title">详情预览</h3>
          <span className="activity-badge activity-badge-secondary">Mock</span>
        </div>

        <p className="activity-note">
          选中某条行为后，这里可以打开抽屉/弹窗展示字段：behavior / description / timestamp / trigger /
          duration_minutes / parameters（JSON）。
        </p>

        <pre className="activity-pre">{detailPreview}</pre>
      </div>
    </section>
  );
}

export function AboutCard() {
  return (
    <section className="settings-card">
      <div className="settings-card-body">
        <div className="settings-card-head">
          <h3 className="settings-card-title">关于</h3>
          <span className="settings-badge settings-badge-accent">Info</span>
        </div>

        <p className="settings-note">
          本页面是 UI 稿（mock），用于快速对齐 PRD 的信息架构、布局与视觉风格。后续可迁移到
          Next.js 页面并替换为真实数据与交互。
        </p>

        <div className="settings-badge-row">
          <span className="settings-badge settings-badge-secondary">主色 #91c4ee</span>
          <span className="settings-badge settings-badge-secondary">辅色 #af7ac5</span>
          <span className="settings-badge settings-badge-accent">浅杏 #fae3be</span>
        </div>

        <ul className="settings-list">
          <li>
            <span>首页</span>
            <span className="settings-list-muted">状态 + 地图，聊天抽屉</span>
          </li>
          <li>
            <span>动态</span>
            <span className="settings-list-muted">时间线 + 轻管理</span>
          </li>
          <li>
            <span>设置</span>
            <span className="settings-list-muted">user_name（UI）</span>
          </li>
        </ul>
      </div>
    </section>
  );
}

export function SettingsHeader() {
  return (
    <div className="settings-page-head">
      <div>
        <h1 className="settings-page-title">设置</h1>
        <p className="settings-page-subtitle">只展示 UI，不写入浏览器存储</p>
      </div>

      <div className="settings-theme-pill">
        <span className="settings-theme-label">主题</span>
        <strong>日系简约</strong>
      </div>
    </div>
  );
}

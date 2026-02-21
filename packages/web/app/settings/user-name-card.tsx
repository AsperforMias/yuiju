export function UserNameCard() {
  return (
    <section className="settings-card">
      <div className="settings-card-body">
        <div className="settings-card-head">
          <h3 className="settings-card-title">对话标识（user_name）</h3>
          <span className="settings-badge settings-badge-secondary">Chat</span>
        </div>

        <p className="settings-note">
          user_name 将用于对话时的用户标识。此处仅为 UI 稿，不保存到 localStorage。
        </p>

        <div className="settings-field">
          <label className="settings-label" htmlFor="userNameInput">
            user_name
          </label>
          <input
            id="userNameInput"
            className="settings-input"
            defaultValue="yixiaojiu"
          />
        </div>

        <div className="settings-btn-row">
          <button className="settings-btn settings-btn-primary" type="button" disabled>
            保存
          </button>
          <span className="settings-btn-hint">（仅展示按钮状态）</span>
        </div>
      </div>
    </section>
  );
}

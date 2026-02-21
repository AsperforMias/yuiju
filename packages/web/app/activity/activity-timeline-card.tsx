export function ActivityTimelineCard() {
  return (
    <section className="activity-card">
      <div className="activity-card-body">
        <div className="activity-filters">
          <div className="activity-field">
            <label htmlFor="behavior">行为</label>
            <select id="behavior" className="activity-input">
              <option>全部</option>
              <option>学习</option>
              <option>购物</option>
              <option>吃饭</option>
            </select>
          </div>

          <div className="activity-field">
            <label htmlFor="trigger">触发源</label>
            <select id="trigger" className="activity-input">
              <option>全部</option>
              <option>agent</option>
              <option>user</option>
              <option>system</option>
            </select>
          </div>

          <div className="activity-field">
            <label htmlFor="keyword">关键词</label>
            <input id="keyword" className="activity-input" placeholder="例如：苹果" />
          </div>
        </div>

        <div className="activity-events">
          <article className="activity-event">
            <div className="activity-event-top">
              <span className="activity-event-time">19:32</span>
              <span className="activity-tag activity-tag-agent">agent</span>
            </div>
            <h3 className="activity-event-title">发呆</h3>
            <p className="activity-event-desc">在家休息，恢复一点体力。</p>
          </article>

          <article className="activity-event">
            <div className="activity-event-top">
              <span className="activity-event-time">18:50</span>
              <span className="activity-tag activity-tag-user">user</span>
            </div>
            <h3 className="activity-event-title">买面包</h3>
            <p className="activity-event-desc">去商店购买面包，金钱减少。</p>
          </article>
        </div>
      </div>
    </section>
  );
}

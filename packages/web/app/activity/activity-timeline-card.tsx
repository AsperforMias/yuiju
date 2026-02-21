export function ActivityTimelineCard() {
  const events = [
    { time: '09:12', behavior: '吃东西', desc: '吃了一个苹果，恢复体力。', trigger: 'agent', duration: 12 },
    { time: '10:12', behavior: '喝水', desc: '补充水分，保持清醒。', trigger: 'system', duration: 1 },
    { time: '11:50', behavior: '学习', desc: '完成数学练习，获得一些进展。', trigger: 'agent', duration: 45 },
    { time: '14:20', behavior: '发呆', desc: '短暂停留发呆，节奏放慢。', trigger: 'system', duration: 6 },
    { time: '16:40', behavior: '购物', desc: '去商店购买了面包和水。', trigger: 'agent', duration: 18 },
    { time: '18:05', behavior: '用户互动', desc: '收到零花钱，心情变好了一点。', trigger: 'user', duration: 2 },
    { time: '19:32', behavior: '休息', desc: '在家休息，恢复一点体力。', trigger: 'agent', duration: 20 },
  ];

  return (
    <section className="activity-card">
      <div className="activity-card-body activity-timeline">
        <div className="activity-card-head">
          <h3 className="activity-card-title">行为时间线</h3>
          <span className="activity-badge activity-badge-secondary">仅展示库字段</span>
        </div>

        <div className="activity-filters">
          <div className="activity-field">
            <label htmlFor="timeRange">时间范围</label>
            <select id="timeRange" className="activity-input" disabled>
              <option>今天</option>
              <option>近 7 天</option>
              <option>自定义</option>
            </select>
          </div>

          <div className="activity-field">
            <label htmlFor="trigger">trigger</label>
            <select id="trigger" className="activity-input" disabled>
              <option>全部</option>
              <option>agent</option>
              <option>user</option>
              <option>system</option>
            </select>
          </div>

          <div className="activity-field">
            <label htmlFor="keyword">behavior 搜索</label>
            <input
              id="keyword"
              className="activity-input"
              placeholder="例如：吃东西 / 购物 / 发呆"
              disabled
            />
          </div>
        </div>

        <div className="activity-events">
          {events.map(item => {
            const tone =
              item.trigger === 'agent'
                ? 'activity-tag-agent'
                : item.trigger === 'user'
                  ? 'activity-tag-user'
                  : 'activity-tag-system';

            return (
              <article key={`${item.time}-${item.behavior}`} className="activity-event">
                <div className="activity-event-top">
                  <div className="activity-mini">
                    <h3 className="activity-event-title">{item.behavior}</h3>
                    <span className={`activity-tag ${tone}`}>{item.trigger}</span>
                  </div>
                  <span className="activity-event-time">
                    {item.time} · {item.duration}min
                  </span>
                </div>
                <p className="activity-event-desc">{item.desc}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

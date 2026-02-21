import { ActivityPageHeader } from './activity-page-header';
import { ActivityTimelineCard } from './activity-timeline-card';
import { ActivityCareCard } from './activity-care-card';

export default function ActivityPage() {
  return (
    <main className="activity-page">
      <ActivityPageHeader />

      <div className="activity-grid">
        <ActivityTimelineCard />
        <ActivityCareCard />
      </div>
    </main>
  );
}

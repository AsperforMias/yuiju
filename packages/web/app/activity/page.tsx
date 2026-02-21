import { ActivityPageHeader } from './activity-page-header';
import { ActivityTimelineCard } from './activity-timeline-card';
import { ActivityCareCard } from './activity-care-card';
import { ActivityDetailPreviewCard } from './activity-detail-preview-card';

export default function ActivityPage() {
  return (
    <main className="activity-page">
      <ActivityPageHeader />

      <div className="activity-grid">
        <ActivityTimelineCard />
        <div className="activity-right-stack">
          <ActivityCareCard />
          <ActivityDetailPreviewCard />
        </div>
      </div>
    </main>
  );
}

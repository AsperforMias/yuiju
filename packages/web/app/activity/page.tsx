import { ActivityCareCard } from './activity-care-card';
import type { ActivityEvent } from './activity-data';
import { ActivityDetailPreviewCard } from './activity-detail-preview-card';
import { ActivityPageHeader } from './activity-page-header';
import { ActivityTimelineCard } from './activity-timeline-card';

export default async function ActivityPage() {
  let events: ActivityEvent[] | undefined;
  let count: number | undefined;

  try {
    const response = await fetch('/api/nodejs/activity/index', { cache: 'no-store' });
    if (response.ok) {
      const payload = (await response.json()) as {
        data?: { events?: ActivityEvent[]; count?: number };
      };
      events = payload.data?.events;
      count = payload.data?.count ?? payload.data?.events?.length;
    }
  } catch {
    events = undefined;
    count = undefined;
  }

  return (
    <main className="max-w-[1200px] mx-auto px-[18px] pt-[18px] pb-[36px]">
      <ActivityPageHeader count={count} />

      <div className="grid grid-cols-[1fr_360px] max-[1020px]:grid-cols-1 gap-[14px] items-start">
        <ActivityTimelineCard events={events} />
        <div className="grid gap-[14px]">
          <ActivityCareCard />
          <ActivityDetailPreviewCard />
        </div>
      </div>
    </main>
  );
}

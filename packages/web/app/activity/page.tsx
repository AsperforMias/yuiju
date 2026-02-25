import { ActivityCareCard } from './activity-care-card';
import type { ActivityEvent } from './activity-data';
import { ActivityDetailPreviewCard } from './activity-detail-preview-card';
import { ActivityPageHeader } from './activity-page-header';
import { ActivityTimelineCard } from './activity-timeline-card';

// Mock 详情预览数据，后续由真实数据替换
const mockDetailPreview = `{
  "behavior": "吃东西",
  "description": "吃了一个苹果，恢复体力",
  "timestamp": "2026-02-07T11:12:00.000Z",
  "trigger": "agent",
  "duration_minutes": 12,
  "parameters": [
    { "value": "苹果", "quantity": 1, "reason": "补充体力", "extra": { "stamina": 15 } }
  ]
}`;

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

  if (!count) {
    count = 0;
  }

  return (
    <main className="max-w-[1200px] mx-auto px-[18px] pt-[18px] pb-[36px]">
      <ActivityPageHeader count={count} />

      <div className="grid grid-cols-[1fr_360px] max-[1020px]:grid-cols-1 gap-[14px] items-start">
        <ActivityTimelineCard events={events} />
        <div className="grid gap-[14px]">
          <ActivityCareCard />
          <ActivityDetailPreviewCard detailPreview={mockDetailPreview} />
        </div>
      </div>
    </main>
  );
}

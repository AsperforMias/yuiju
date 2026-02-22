import { ActivityTimelineCard } from "./activity-timeline-card";
import { ActivityCareCard } from "./activity-care-card";
import { ActivityDetailPreviewCard } from "./activity-detail-preview-card";
import { ActivityPageHeader } from "./activity-page-header";

export default function ActivityPage() {
  return (
    <main className="max-w-[1200px] mx-auto px-[18px] pt-[18px] pb-[36px]">
      <ActivityPageHeader />

      <div className="grid grid-cols-[1fr_360px] max-[1020px]:grid-cols-1 gap-[14px] items-start">
        <ActivityTimelineCard />
        <div className="grid gap-[14px]">
          <ActivityCareCard />
          <ActivityDetailPreviewCard />
        </div>
      </div>
    </main>
  );
}

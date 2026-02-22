import { ActivityPageHeader } from "./activity-page-header";
import { ActivityTimelineCard } from "./activity-timeline-card";
import { ActivityCareCard } from "./activity-care-card";
import { ActivityDetailPreviewCard } from "./activity-detail-preview-card";
import styles from "./activity.module.css";

export default function ActivityPage() {
  return (
    <main className={styles["activity-page"]}>
      <ActivityPageHeader />

      <div className={styles["activity-grid"]}>
        <ActivityTimelineCard />
        <div className={styles["activity-right-stack"]}>
          <ActivityCareCard />
          <ActivityDetailPreviewCard />
        </div>
      </div>
    </main>
  );
}

import { Badge } from '@/lib/components/ui/badge';
import { Card } from '@/lib/components/ui/card';

type ActivityDetailPreviewCardProps = {
  detailPreview: string;
};

// 详情预览以 props 传入，便于接入真实数据
export function ActivityDetailPreviewCard({ detailPreview }: ActivityDetailPreviewCardProps) {
  return (
    <Card>
      <div className="p-[14px] grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="m-0 text-[14px] font-black">详情预览</h3>
          <Badge
            variant="soft"
            size="sm"
            className="border-[rgba(175,122,197,0.25)] bg-[rgba(175,122,197,0.12)] text-[#2b2f36]"
          >
            Mock
          </Badge>
        </div>

        <p className="m-0 text-[13px] text-[#6b7480] leading-[1.55]">
          选中某条行为后，这里可以打开抽屉/弹窗展示字段：behavior / description / timestamp / trigger / duration_minutes
          / parameters（JSON）。
        </p>

        <pre className="m-3 p-3 rounded-xl border border-[rgba(217,230,245,0.85)] bg-[rgba(247,251,255,0.85)] overflow-auto text-[12px] text-[rgba(43,47,54,0.85)]">
          {detailPreview}
        </pre>
      </div>
    </Card>
  );
}

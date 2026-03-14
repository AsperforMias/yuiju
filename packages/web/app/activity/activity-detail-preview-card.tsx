import { Card } from '@/components/ui/card';

type ActivityDetailPreviewCardProps = {
  detailPreview?: string;
};

// 详情预览以 props 传入，便于接入真实数据
export function ActivityDetailPreviewCard({ detailPreview }: ActivityDetailPreviewCardProps) {
  const hasPreview = Boolean(detailPreview && detailPreview.trim());

  return (
    <Card>
      <div className="p-[14px] grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="m-0 text-[14px] font-black">详情预览</h3>
        </div>

        <p className="m-0 text-[13px] text-[#6b7480] leading-[1.55]">
          选中某条行为后，这里可以打开抽屉/弹窗展示字段：behavior / description / timestamp / trigger / duration_minutes
          / parameters（JSON）。
        </p>

        {hasPreview ? (
          <pre className="m-3 p-3 rounded-xl border border-[rgba(217,230,245,0.85)] bg-[rgba(247,251,255,0.85)] overflow-auto text-[12px] text-[rgba(43,47,54,0.85)]">
            {detailPreview}
          </pre>
        ) : (
          <div className="m-3 p-3 rounded-xl border border-dashed border-[rgba(217,230,245,0.85)] bg-[rgba(247,251,255,0.6)] text-[12px] text-[#6b7480]">
            暂无可预览的详情。
          </div>
        )}
      </div>
    </Card>
  );
}

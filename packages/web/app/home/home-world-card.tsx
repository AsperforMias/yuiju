import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type HomeWorldCardProps = {
  time?: string;
};

export function HomeWorldCard({ time }: HomeWorldCardProps) {
  const displayTime = time ?? "—";
  return (
    <Card>
      <div className="p-[14px] grid gap-[14px]">
        <div className="flex items-center justify-between gap-[12px]">
          <h3 className="m-0 text-[14px] font-black tracking-[0.2px]">世界状态</h3>
          <Badge variant="pill" size="default" className="whitespace-nowrap">
            <span className="text-[#6b7480]">世界时间</span>&nbsp;
            <strong className="text-[#2b2f36]">{displayTime}</strong>
          </Badge>
        </div>
      </div>
    </Card>
  );
}

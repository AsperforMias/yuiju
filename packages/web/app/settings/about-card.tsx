import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function AboutCard() {
  return (
    <Card className="h-full min-h-[520px]">
      <div className="p-[14px] grid gap-[14px]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="m-0 text-[24px] font-black tracking-[0.2px]">关于</h3>
          <Badge
            variant="soft"
            size="sm"
            className="border-[rgba(250,227,190,0.75)] bg-[rgba(250,227,190,0.55)] text-[#2b2f36]"
          >
            Info
          </Badge>
        </div>

        <p className="m-0 text-[15px] text-[#6b7480] leading-[1.55]">
          本页面用于展示信息架构、布局与视觉风格。后续可根据实际数据补充内容与交互。
        </p>

        <div className="flex flex-wrap gap-2">
          <Badge
            variant="soft"
            size="sm"
            className="border-[rgba(175,122,197,0.25)] bg-[rgba(175,122,197,0.12)] text-[#2b2f36]"
          >
            主色 #91c4ee
          </Badge>
          <Badge
            variant="soft"
            size="sm"
            className="border-[rgba(175,122,197,0.25)] bg-[rgba(175,122,197,0.12)] text-[#2b2f36]"
          >
            辅色 #af7ac5
          </Badge>
          <Badge
            variant="soft"
            size="sm"
            className="border-[rgba(250,227,190,0.75)] bg-[rgba(250,227,190,0.55)] text-[#2b2f36]"
          >
            浅杏 #fae3be
          </Badge>
        </div>

        <ul className="list-none m-0 p-0 grid gap-2">
          <li className="flex items-center justify-between gap-[10px] p-[10px] rounded-xl border border-[#d9e6f5] bg-[rgba(247,251,255,0.75)] text-[13px]">
            <span>首页</span>
            <span className="text-[#6b7480]">状态 + 地图，聊天抽屉</span>
          </li>
          <li className="flex items-center justify-between gap-[10px] p-[10px] rounded-xl border border-[#d9e6f5] bg-[rgba(247,251,255,0.75)] text-[13px]">
            <span>动态</span>
            <span className="text-[#6b7480]">时间线 + 轻管理</span>
          </li>
          <li className="flex items-center justify-between gap-[10px] p-[10px] rounded-xl border border-[#d9e6f5] bg-[rgba(247,251,255,0.75)] text-[13px]">
            <span>设置</span>
            <span className="text-[#6b7480]">user_name（UI）</span>
          </li>
        </ul>
      </div>
    </Card>
  );
}

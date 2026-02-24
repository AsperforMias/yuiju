"use client";

import { useMemo, useState } from "react";
import { type ActivityEvent, defaultActivityEvents } from "./activity-data";

import { Badge } from "@/lib/components/ui/badge";
import { Card } from "@/lib/components/ui/card";
import { Input } from "@/lib/components/ui/input";
import { Select } from "@/lib/components/ui/select";
import { cn } from "@/lib/utils";

type ActivityTimelineCardProps = {
  events?: ActivityEvent[];
};

type TimeRangeOption = "today" | "last7" | "custom";
type TriggerFilter = "all" | ActivityEvent["trigger"];

export function ActivityTimelineCard({ events }: ActivityTimelineCardProps) {
  const [timeRange, setTimeRange] = useState<TimeRangeOption>("today");
  const [trigger, setTrigger] = useState<TriggerFilter>("all");
  const [keyword, setKeyword] = useState("");

  const displayEvents = useMemo(
    () => (events && events.length > 0 ? events : defaultActivityEvents),
    [events],
  );

  const filteredEvents = useMemo(() => {
    let next = displayEvents;

    if (trigger !== "all") {
      next = next.filter((item) => item.trigger === trigger);
    }

    const normalizedKeyword = keyword.trim().toLowerCase();
    if (normalizedKeyword) {
      next = next.filter((item) => {
        const behaviorMatch = item.behavior.toLowerCase().includes(normalizedKeyword);
        const descMatch = item.desc.toLowerCase().includes(normalizedKeyword);
        return behaviorMatch || descMatch;
      });
    }

    return next;
  }, [displayEvents, keyword, trigger]);

  return (
    <Card>
      <div className="p-[14px] grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="m-0 text-[14px] font-black">行为时间线</h3>
          <Badge
            variant="soft"
            size="sm"
            className="border-[rgba(175,122,197,0.25)] bg-[rgba(175,122,197,0.12)] text-[#2b2f36]"
          >
            仅展示库字段
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-[10px] max-[520px]:grid-cols-1">
          <div className="grid gap-[6px]">
            <label className="text-[12px] text-[#6b7480]" htmlFor="timeRange">
              时间范围
            </label>
            <Select
              id="timeRange"
              value={timeRange}
              onChange={(event) => setTimeRange(event.target.value as TimeRangeOption)}
            >
              <option value="today">今天</option>
              <option value="last7">近 7 天</option>
              <option value="custom">自定义</option>
            </Select>
          </div>

          <div className="grid gap-[6px]">
            <label className="text-[12px] text-[#6b7480]" htmlFor="trigger">
              trigger
            </label>
            <Select
              id="trigger"
              value={trigger}
              onChange={(event) => setTrigger(event.target.value as TriggerFilter)}
            >
              <option value="all">全部</option>
              <option value="agent">agent</option>
              <option value="user">user</option>
              <option value="system">system</option>
            </Select>
          </div>

          <div className="grid gap-[6px]">
            <label className="text-[12px] text-[#6b7480]" htmlFor="keyword">
              behavior 搜索
            </label>
            <Input
              id="keyword"
              placeholder="例如：吃东西 / 购物 / 发呆"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>
        </div>

        <div className="relative pl-[18px] grid gap-3 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[rgba(145,196,238,0.6)] before:rounded-full">
          {filteredEvents.length === 0 ? (
            <div className="rounded-2xl border border-[rgba(217,230,245,0.9)] bg-[rgba(255,255,255,0.84)] shadow-[0_10px_25px_rgba(21,33,54,0.06)] p-3 text-[13px] text-[#6b7480]">
              没有匹配的记录，试试调整筛选条件。
            </div>
          ) : (
            filteredEvents.map((item) => {
              const tone =
                item.trigger === "agent"
                  ? "bg-[rgba(145,196,238,0.18)] border-[rgba(145,196,238,0.3)] text-[#2b2f36]"
                  : item.trigger === "user"
                    ? "bg-[rgba(250,227,190,0.75)] border-[rgba(250,227,190,0.85)] text-[#2b2f36]"
                    : "bg-[rgba(175,122,197,0.14)] border-[rgba(175,122,197,0.25)] text-[#2b2f36]";

              return (
                <article
                  key={`${item.time}-${item.behavior}`}
                  className="relative rounded-2xl border border-[rgba(217,230,245,0.9)] bg-[rgba(255,255,255,0.84)] shadow-[0_10px_25px_rgba(21,33,54,0.06)] p-3 grid gap-2 before:content-[''] before:absolute before:-left-3.5 before:top-[18px] before:w-2.5 before:h-2.5 before:rounded-full before:bg-[rgba(145,196,238,0.9)] before:border-2 before:border-[rgba(247,251,255,1)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2">
                      <h3 className="m-0 text-[14px] font-black">{item.behavior}</h3>
                      <Badge variant="soft" size="sm" className={cn("px-[10px] py-[7px]", tone)}>
                        {item.trigger}
                      </Badge>
                    </div>
                    <span className="text-[12px] text-[#6b7480]">
                      {item.time} · {item.duration}min
                    </span>
                  </div>
                  <p className="m-0 text-[13px] text-[#6b7480]">{item.desc}</p>
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

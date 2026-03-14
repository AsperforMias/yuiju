'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ActivityEvent } from './activity-data';

interface ActivityTimelineCardProps {
  events?: ActivityEvent[];
}

type TimeRangeOption = 'today' | 'last7' | 'custom';
type TriggerFilter = 'all' | ActivityEvent['trigger'];

export function ActivityTimelineCard({ events }: ActivityTimelineCardProps) {
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('today');
  const [trigger, setTrigger] = useState<TriggerFilter>('all');
  const [keyword, setKeyword] = useState('');

  const displayEvents = useMemo(() => (events && events.length > 0 ? events : []), [events]);

  const filteredEvents = useMemo(() => {
    let next = displayEvents;

    if (trigger !== 'all') {
      next = next.filter(item => item.trigger === trigger);
    }

    const normalizedKeyword = keyword.trim().toLowerCase();
    if (normalizedKeyword) {
      next = next.filter(item => {
        const behaviorMatch = item.behavior.toLowerCase().includes(normalizedKeyword);
        const descMatch = item.desc.toLowerCase().includes(normalizedKeyword);
        return behaviorMatch || descMatch;
      });
    }

    return next;
  }, [displayEvents, keyword, trigger]);

  return (
    <Card>
      <div className="p-3.5 grid gap-3">
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

        <div className="grid grid-cols-3 gap-2.5 max-[520px]:grid-cols-1">
          <div className="grid gap-1.5">
            <label className="text-[12px] text-[#6b7480]" htmlFor="timeRange">
              时间范围
            </label>
            <Select value={timeRange} onValueChange={value => setTimeRange(value as TimeRangeOption)}>
              <SelectTrigger id="timeRange" aria-label="选择时间范围">
                <SelectValue placeholder="选择时间范围" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">今天</SelectItem>
                <SelectItem value="last7">近 7 天</SelectItem>
                <SelectItem value="custom">自定义</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-[6px]">
            <label className="text-[12px] text-[#6b7480]" htmlFor="trigger">
              trigger
            </label>
            <Select value={trigger} onValueChange={value => setTrigger(value as TriggerFilter)}>
              <SelectTrigger id="trigger" aria-label="选择触发类型">
                <SelectValue placeholder="选择 trigger" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="agent">agent</SelectItem>
                <SelectItem value="user">user</SelectItem>
                <SelectItem value="system">system</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-[6px]">
            <label className="text-[12px] text-[#6b7480]" htmlFor="keyword">
              behavior 搜索
            </label>
            <Input
              id="keyword"
              placeholder="输入关键词"
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
            />
          </div>
        </div>

        <div className="relative pl-[18px] grid gap-3 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[rgba(145,196,238,0.6)] before:rounded-full">
          {filteredEvents.length === 0 ? (
            <div className="rounded-2xl border border-[rgba(217,230,245,0.9)] bg-[rgba(255,255,255,0.84)] shadow-[0_10px_25px_rgba(21,33,54,0.06)] p-3 text-[13px] text-[#6b7480]">
              没有匹配的记录，试试调整筛选条件。
            </div>
          ) : (
            filteredEvents.map(item => {
              const tone =
                item.trigger === 'agent'
                  ? 'bg-[rgba(145,196,238,0.18)] border-[rgba(145,196,238,0.3)] text-[#2b2f36]'
                  : item.trigger === 'user'
                    ? 'bg-[rgba(250,227,190,0.75)] border-[rgba(250,227,190,0.85)] text-[#2b2f36]'
                    : 'bg-[rgba(175,122,197,0.14)] border-[rgba(175,122,197,0.25)] text-[#2b2f36]';

              return (
                <article
                  key={`${item.time}-${item.behavior}`}
                  className="relative rounded-2xl border border-[rgba(217,230,245,0.9)] bg-[rgba(255,255,255,0.84)] shadow-[0_10px_25px_rgba(21,33,54,0.06)] p-3 grid gap-2 before:content-[''] before:absolute before:-left-3.5 before:top-[18px] before:w-2.5 before:h-2.5 before:rounded-full before:bg-[rgba(145,196,238,0.9)] before:border-2 before:border-[rgba(247,251,255,1)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2">
                      <h3 className="m-0 text-[14px] font-black">{item.behavior}</h3>
                      <Badge variant="soft" size="sm" className={cn('px-[10px] py-[7px]', tone)}>
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
    </Card>
  );
}

'use client';

import { useMemo } from 'react';

import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card } from '@/lib/components/ui/card';

type HomeStatus = {
  behavior: string;
  location: string;
  stamina: { current: number; max: number };
  money: number;
};

type InventoryItem = {
  name: string;
  count: number;
};

type HomePlans = {
  longTerm: string;
  shortTerm: string[];
};

type HomeStatusCardProps = {
  status?: HomeStatus;
  todayActions?: string[];
  inventory?: InventoryItem[];
  plans?: HomePlans;
};

const formatItem = (item: InventoryItem) => `${item.name} ×${item.count}`;

export function HomeStatusCard({ status, todayActions, inventory, plans }: HomeStatusCardProps) {
  // 统一在 useMemo 中处理默认值，避免每次渲染创建新对象
  const displayStatus = useMemo<HomeStatus>(() => {
    return (
      status ?? {
        behavior: '发呆',
        location: '家',
        stamina: { current: 68, max: 100 },
        money: 128,
      }
    );
  }, [status]);

  const displayActions = useMemo(() => {
    return todayActions ?? ['起床', '上学', '吃饭', '发呆'];
  }, [todayActions]);

  const displayInventory = useMemo(() => {
    return (
      inventory ?? [
        { name: '苹果', count: 2 },
        { name: '面包', count: 1 },
        { name: '水', count: 1 },
      ]
    );
  }, [inventory]);

  const displayPlans = useMemo<HomePlans>(() => {
    return (
      plans ?? {
        longTerm: '认真上学，变得更厉害',
        shortTerm: ['复习', '逛商店', '做饭'],
      }
    );
  }, [plans]);

  const inventorySummary = useMemo(() => {
    return displayInventory.map(formatItem).join(' · ');
  }, [displayInventory]);

  return (
    <Card>
      <div className="p-[14px] grid gap-[14px]">
        <div className="flex items-center justify-between gap-[10px]">
          <h3 className="m-0 text-[14px] font-black tracking-[0.2px]">角色状态</h3>
          <Button type="button">刷新</Button>
        </div>

        <div className="grid grid-cols-2 gap-[10px] mt-[10px] max-[520px]:grid-cols-1">
          <div className="rounded-xl bg-[rgba(247,251,255,0.8)] border border-[rgba(217,230,245,0.8)] p-[10px]">
            <div className="text-xs text-[#6b7480]">当前行为</div>
            <div className="mt-1.5 text-sm font-extrabold">{displayStatus.behavior}</div>
          </div>
          <div className="rounded-xl bg-[rgba(247,251,255,0.8)] border border-[rgba(217,230,245,0.8)] p-[10px]">
            <div className="text-xs text-[#6b7480]">当前位置</div>
            <div className="mt-1.5 text-sm font-extrabold">{displayStatus.location}</div>
          </div>
          <div className="rounded-xl bg-[rgba(247,251,255,0.8)] border border-[rgba(217,230,245,0.8)] p-[10px]">
            <div className="text-xs text-[#6b7480]">体力</div>
            <div className="mt-1.5 text-sm font-extrabold">
              {displayStatus.stamina.current}
              <span className="text-[#6b7480]"> / {displayStatus.stamina.max}</span>
            </div>
          </div>
          <div className="rounded-xl bg-[rgba(247,251,255,0.8)] border border-[rgba(217,230,245,0.8)] p-[10px]">
            <div className="text-xs text-[#6b7480]">金钱</div>
            <div className="mt-1.5 text-sm font-extrabold">¥ {displayStatus.money}</div>
          </div>
        </div>

        <div className="mt-[10px] p-3 rounded-2xl border border-[rgba(217,230,245,0.85)] bg-[rgba(247,251,255,0.85)] grid gap-2.5">
          <div className="flex items-center justify-between gap-[10px]">
            <div className="text-xs font-black tracking-[0.2px] text-[#6b7480]">今日已执行的行为</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {displayActions.map(item => (
              <Badge key={item} variant="chip" size="sm">
                {item}
              </Badge>
            ))}
          </div>
        </div>

        <div className="mt-[10px] p-3 rounded-2xl border border-[rgba(217,230,245,0.85)] bg-[rgba(247,251,255,0.85)] grid gap-2.5">
          <div className="flex items-center justify-between gap-[10px]">
            <div className="text-xs font-black tracking-[0.2px] text-[#6b7480]">背包</div>
            <div className="text-[#6b7480] text-xs leading-[1.5]">{inventorySummary}</div>
          </div>
          <details className="border-t border-dashed border-[rgba(175,122,197,0.24)] pt-[10px]">
            <summary className="cursor-pointer select-none text-[#6b7480] text-xs list-none [&::-webkit-details-marker]:hidden">
              展开全部
            </summary>
            <div className="flex flex-wrap gap-2 mt-[10px]">
              {displayInventory.map(item => (
                <Badge key={item.name} variant="chip" size="sm">
                  {formatItem(item)}
                </Badge>
              ))}
            </div>
          </details>
        </div>

        <div className="mt-[12px] grid gap-3">
          <div className="grid gap-2 rounded-xl bg-[rgba(247,251,255,0.8)] border border-[rgba(217,230,245,0.8)] p-[10px]">
            <div className="text-xs text-[#6b7480]">长期计划</div>
            <p className="m-0 text-[#6b7480] text-[13px] leading-[1.55]">{displayPlans.longTerm}</p>
          </div>
          <div className="grid gap-2 rounded-xl bg-[rgba(247,251,255,0.8)] border border-[rgba(217,230,245,0.8)] p-[10px]">
            <div className="text-xs text-[#6b7480]">短期计划</div>
            <ul className="m-0 pl-[18px] text-[#6b7480] text-[13px] leading-[1.6]">
              {displayPlans.shortTerm.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}

"use client";

import { useMemo } from "react";
import useSWR from "swr";
import type { IHomeResponse } from "./api/nodejs/[[...route]]/home";
import { HomeMapCard } from "./home/home-map-card";
import { HomePageHeader } from "./home/home-page-header";
import { HomeStatusCard } from "./home/home-status-card";
import { HomeWorldCard } from "./home/home-world-card";

export default function HomePage() {
  const { data: homeData, isLoading } = useSWR("/api/nodejs/home/summary", async () => {
    try {
      const response = await fetch("/api/nodejs/home/summary", { cache: "no-store" });
      if (response.ok) {
        const payload = (await response.json()) as IHomeResponse;
        return payload.data ?? undefined;
      }
    } catch {
      return;
    }
  });

  const summary = useMemo(() => {
    return homeData?.status?.location && homeData?.status?.behavior
      ? `悠酱现在在【${homeData.status.location}】，正在【${homeData.status.behavior}】`
      : undefined;
  }, [homeData]);

  return (
    <main className="max-w-[1200px] mx-auto px-[18px] pt-[18px] pb-[36px]">
      <HomePageHeader summary={summary} />

      <div className="grid grid-cols-[360px_1fr] max-[1020px]:grid-cols-1 gap-[14px] items-start">
        <div className="grid gap-[14px]">
          <HomeStatusCard
            status={
              // Review: 放到 useMemo 里面
              homeData?.status
                ? {
                    behavior: homeData.status.behavior ?? "发呆",
                    location: homeData.status.location ?? "家",
                    stamina: {
                      current: homeData.status.stamina?.current ?? 68,
                      max: homeData.status.stamina?.max ?? 100,
                    },
                    money: homeData.status.money ?? 128,
                  }
                : undefined
            }
            todayActions={homeData?.todayActions}
            inventory={homeData?.inventory}
            plans={
              homeData?.plans
                ? {
                    longTerm: homeData.plans.longTerm ?? "认真上学，变得更厉害",
                    shortTerm: homeData.plans.shortTerm ?? ["复习", "逛商店", "做饭"],
                  }
                : undefined
            }
          />
          <HomeWorldCard time={homeData?.world?.time} />
        </div>

        <HomeMapCard location={homeData?.status?.location} />
      </div>
    </main>
  );
}

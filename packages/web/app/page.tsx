import { HomeMapCard } from "./home/home-map-card";
import { HomePageHeader } from "./home/home-page-header";
import { HomeStatusCard } from "./home/home-status-card";
import { HomeWorldCard } from "./home/home-world-card";

export default async function HomePage() {
  let homeData: {
    status?: {
      behavior?: string;
      location?: string;
      stamina?: { current?: number; max?: number };
      money?: number;
    };
    todayActions?: string[];
    inventory?: { name: string; count: number }[];
    plans?: { longTerm?: string; shortTerm?: string[] };
    world?: { time?: string };
  } | null = null;

  try {
    const response = await fetch("/api/nodejs/home/index", { cache: "no-store" });
    if (response.ok) {
      const payload = (await response.json()) as { data?: typeof homeData };
      homeData = payload.data ?? null;
    }
  } catch {
    homeData = null;
  }

  const summary =
    homeData?.status?.location && homeData?.status?.behavior
      ? `悠酱现在在【${homeData.status.location}】，正在【${homeData.status.behavior}】`
      : undefined;

  return (
    <main className="max-w-[1200px] mx-auto px-[18px] pt-[18px] pb-[36px]">
      <HomePageHeader summary={summary} />

      <div className="grid grid-cols-[360px_1fr] max-[1020px]:grid-cols-1 gap-[14px] items-start">
        <div className="grid gap-[14px]">
          <HomeStatusCard
            status={
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

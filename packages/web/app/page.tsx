import { HomeMapCard } from "./home/home-map-card";
import { HomePageHeader } from "./home/home-page-header";
import { HomeStatusCard } from "./home/home-status-card";
import { HomeWorldCard } from "./home/home-world-card";
export default function HomePage() {
  return (
    <main className="max-w-[1200px] mx-auto px-[18px] pt-[18px] pb-[36px]">
      <HomePageHeader />

      <div className="grid grid-cols-[360px_1fr] max-[1020px]:grid-cols-1 gap-[14px] items-start">
        <div className="grid gap-[14px]">
          <HomeStatusCard />
          <HomeWorldCard />
        </div>

        <HomeMapCard />
      </div>
    </main>
  );
}

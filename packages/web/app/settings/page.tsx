import { SettingsHeader } from "./settings-header";
import { UserNameCard } from "./user-name-card";
import { AboutCard } from "./about-card";

export default async function SettingsPage() {
  return (
    <main className="max-w-[1200px] mx-auto px-[18px] pt-[24px] pb-[36px]">
      <SettingsHeader />
      <div className="grid grid-cols-2 max-[1020px]:grid-cols-1 gap-[14px] items-stretch">
        <UserNameCard />
        <AboutCard />
      </div>
    </main>
  );
}

import { headers } from "next/headers";
import { SettingsHeader } from "./settings-header";
import { UserNameCard } from "./user-name-card";
import { AboutCard } from "./about-card";

const getBaseUrl = () => {
  const headerList = headers();
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");

  if (!host) {
    return "http://localhost:3010";
  }

  return `${protocol}://${host}`;
};

export default async function SettingsPage() {
  let profileData: { userName?: string; theme?: string } | null = null;

  try {
    const response = await fetch(`${getBaseUrl()}/api/nodejs/profile`, { cache: "no-store" });
    if (response.ok) {
      const payload = (await response.json()) as { data?: typeof profileData };
      profileData = payload.data ?? null;
    }
  } catch {
    profileData = null;
  }

  return (
    <main className="max-w-[1200px] mx-auto px-[18px] pt-[24px] pb-[36px]">
      <SettingsHeader theme={profileData?.theme} />
      <div className="grid grid-cols-2 max-[1020px]:grid-cols-1 gap-[14px] items-stretch">
        <UserNameCard userName={profileData?.userName} />
        <AboutCard />
      </div>
    </main>
  );
}

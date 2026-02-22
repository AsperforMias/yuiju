import { AboutCard } from "./about-card";
import { SettingsHeader } from "./settings-header";
import { UserNameCard } from "./user-name-card";
import styles from "./settings.module.css";

export default function SettingsPage() {
  return (
    <main className={styles["settings-page"]}>
      <SettingsHeader />
      <div className={styles["settings-grid"]}>
        <UserNameCard />
        <AboutCard />
      </div>
    </main>
  );
}

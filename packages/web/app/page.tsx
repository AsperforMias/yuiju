import { HomeMapCard } from "./home/home-map-card";
import { HomePageHeader } from "./home/home-page-header";
import { HomeStatusCard } from "./home/home-status-card";
import { HomeWorldCard } from "./home/home-world-card";
import styles from "./home.module.css";

export default function HomePage() {
  return (
    <main className={styles["home-page"]}>
      <HomePageHeader />

      <div className={styles["home-grid"]}>
        <div className={styles["home-left-stack"]}>
          <HomeStatusCard />
          <HomeWorldCard />
        </div>

        <HomeMapCard />
      </div>
    </main>
  );
}

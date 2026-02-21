import { HomeMapCard } from './home/home-map-card';
import { HomePageHeader } from './home/home-page-header';
import { HomeStatusCard } from './home/home-status-card';
import { HomeWorldCard } from './home/home-world-card';

export default function HomePage() {
  return (
    <main className="home-page">
      <HomePageHeader />

      <div className="home-grid">
        <div className="home-left-stack">
          <HomeStatusCard />
          <HomeWorldCard />
        </div>

        <HomeMapCard />
      </div>
    </main>
  );
}

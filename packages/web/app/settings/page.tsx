import { AboutCard } from './about-card';
import { SettingsHeader } from './settings-header';
import { UserNameCard } from './user-name-card';

export default function SettingsPage() {
  return (
    <main>
      <SettingsHeader />
      <div>
        <UserNameCard />
        <AboutCard />
      </div>
    </main>
  );
}

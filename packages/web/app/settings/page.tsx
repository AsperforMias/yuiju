import { AboutCard } from './about-card';
import { SettingsHeader } from './settings-header';
import { UserNameCard } from './user-name-card';

export default function SettingsPage() {
  return (
    <main className='settings-page'>
      <SettingsHeader />
      <div className='settings-grid'>
        <UserNameCard />
        <AboutCard />
      </div>
    </main>
  );
}

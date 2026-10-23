import { useEffect, useState, type ComponentType } from 'react';
import { CalendarIcon, SettingsIcon, StatsIcon } from './components/Icons';
import { UpdateBanner } from './components/UpdateBanner';
import { CalendarScreen } from './screens/CalendarScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StatsScreen } from './screens/StatsScreen';

type Tab = 'calendar' | 'stats' | 'settings';

const TABS: ReadonlyArray<{ id: Tab; label: string; Icon: ComponentType; Screen: ComponentType }> = [
  { id: 'calendar', label: 'Календарь', Icon: CalendarIcon, Screen: CalendarScreen },
  { id: 'stats', label: 'Статистика', Icon: StatsIcon, Screen: StatsScreen },
  { id: 'settings', label: 'Настройки', Icon: SettingsIcon, Screen: SettingsScreen },
];

// Главный экран — «Календарь» (FR-001, design.md). Неизвестная или удалённая вкладка
// (например, сохранённая в адресе старая «#today») открывает «Календарь».
const DEFAULT_TAB: Tab = 'calendar';

function tabFromHash(): Tab {
  const id = location.hash.replace('#', '');
  if (TABS.some((t) => t.id === id)) return id as Tab;
  if (id) history.replaceState(null, '', `#${DEFAULT_TAB}`);
  return DEFAULT_TAB;
}

export function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const select = (id: Tab) => {
    history.replaceState(null, '', `#${id}`);
    setTab(id);
  };

  const { Screen } = TABS.find((t) => t.id === tab)!;

  return (
    <div className="app">
      <UpdateBanner />
      <main className="app__screen">
        <Screen />
      </main>
      <nav className="tabbar" aria-label="Разделы">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className="tabbar__tab"
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => select(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

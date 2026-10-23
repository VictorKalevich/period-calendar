import { useEffect, useState, type ComponentType } from 'react';
import { CalendarIcon, SettingsIcon, StatsIcon, TodayIcon } from './components/Icons';
import { CalendarScreen } from './screens/CalendarScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StatsScreen } from './screens/StatsScreen';
import { TodayScreen } from './screens/TodayScreen';

type Tab = 'today' | 'calendar' | 'stats' | 'settings';

const TABS: ReadonlyArray<{ id: Tab; label: string; Icon: ComponentType; Screen: ComponentType }> = [
  { id: 'today', label: 'Сегодня', Icon: TodayIcon, Screen: TodayScreen },
  { id: 'calendar', label: 'Календарь', Icon: CalendarIcon, Screen: CalendarScreen },
  { id: 'stats', label: 'Статистика', Icon: StatsIcon, Screen: StatsScreen },
  { id: 'settings', label: 'Настройки', Icon: SettingsIcon, Screen: SettingsScreen },
];

// Главный экран — «Календарь» (FR-001, design.md).
const DEFAULT_TAB: Tab = 'calendar';

function tabFromHash(): Tab {
  const id = location.hash.replace('#', '');
  return TABS.some((t) => t.id === id) ? (id as Tab) : DEFAULT_TAB;
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

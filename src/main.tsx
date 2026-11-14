import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { toLocalDate } from './domain/dates';
import { registerUpdates } from './pwa/registerUpdates';
import { normalizeStoredPeriods } from './storage/repository';
import { startReminderSync } from './push/sync';
import { App } from './ui/App';
import { EmergencyPage } from './ui/components/EmergencyScreen';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import './ui/theme.css';
import './ui/app.css';

registerUpdates();
// Старые данные приводятся к инварианту «нет соседних и пересекающихся месячных» (003 FR-016).
void normalizeStoredPeriods(toLocalDate(new Date())).catch((e: unknown) => console.error('normalize failed', e));
startReminderSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Сбой вне экрана вкладки — аварийный экран на всю страницу, а не пустая (014). */}
    <ErrorBoundary fallback={<EmergencyPage />}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

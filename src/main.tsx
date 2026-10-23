import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerUpdates } from './pwa/registerUpdates';
import { startReminderSync } from './push/sync';
import { App } from './ui/App';
import './ui/theme.css';
import './ui/app.css';

registerUpdates();
startReminderSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

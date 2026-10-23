import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { startReminderSync } from './push/sync';
import { App } from './ui/App';
import './ui/theme.css';
import './ui/app.css';

registerSW({ immediate: true });
startReminderSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

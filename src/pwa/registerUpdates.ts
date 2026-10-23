import { registerSW } from 'virtual:pwa-register';
import { createUpdateController } from './updateController';

// Надёжное обновление PWA (research.md R4): новый service worker активируется сразу
// (skipWaiting + clientsClaim в sw.ts), приложение перезагружается один раз. iOS не проверяет
// обновления при возврате из фона, поэтому проверяем сами — при возвращении и раз в час.
// IndexedDB не затрагивается: при обновлении чистится только Cache Storage старой сборки.

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

type Listener = (visible: boolean) => void;
const listeners = new Set<Listener>();
let bannerVisible = false;

export function onUpdateBanner(listener: Listener): () => void {
  listeners.add(listener);
  listener(bannerVisible);
  return () => listeners.delete(listener);
}

const isBusy = () =>
  document.querySelector('dialog[open]') !== null ||
  document.activeElement instanceof HTMLTextAreaElement ||
  document.activeElement instanceof HTMLInputElement;

const controller = createUpdateController({
  isBusy,
  reload: () => window.location.reload(),
  showBanner: () => {
    bannerVisible = true;
    listeners.forEach((l) => l(true));
  },
});

export const applyUpdate = () => controller.applyUpdate();

export function registerUpdates(): void {
  registerSW({
    immediate: true,
    onNeedReload: () => controller.onNewVersionActivated(),
    onRegisteredSW: (_url, registration) => {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) void registration.update().catch(() => undefined);
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      setInterval(check, CHECK_INTERVAL_MS);
    },
  });
}

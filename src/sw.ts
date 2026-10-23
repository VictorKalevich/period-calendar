/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Новая сборка активируется сразу и берёт открытые окна под контроль; приложение само
// перезагружается (src/pwa/registerUpdates.ts). Иначе на iPhone новый service worker
// ждёт закрытия всех окон PWA, которого может не случиться. IndexedDB здесь не трогаем.
self.addEventListener('install', () => {
  void self.skipWaiting();
});
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Push-напоминания от воркера: payload { title, body, id } (contracts/push-worker-api.md).
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; id?: string } = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Календарь цикла', {
      body: data.body ?? '',
      tag: data.id,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      lang: 'ru',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL('#today', self.registration.scope).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows[0];
      if (existing) {
        await existing.navigate(url).catch(() => undefined);
        await existing.focus();
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});

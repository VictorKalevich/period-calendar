/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { notificationFromPush } from './pwa/pushNotification';

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

// Push-напоминания от воркера: payload { title, body, id } (contracts/push-worker-api.md); разбор —
// src/pwa/pushNotification.ts.
self.addEventListener('push', (event) => {
  const n = notificationFromPush(event.data);
  event.waitUntil(
    self.registration.showNotification(n.title, {
      body: n.body,
      tag: n.tag,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      lang: 'ru',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL('#calendar', self.registration.scope).href;
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

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Публичный VAPID-ключ (base64url). Пусто — напоминания не настроены. */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  /** Адрес push-воркера, например https://cycle-push.<account>.workers.dev */
  readonly VITE_PUSH_API_URL?: string;
}

/** Версия приложения из package.json (vite.config.ts → define). */
declare const __APP_VERSION__: string;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Navigator {
  /** iOS Safari: true, если приложение запущено с экрана «Домой». */
  readonly standalone?: boolean;
}

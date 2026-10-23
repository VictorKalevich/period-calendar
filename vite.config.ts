import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/period-calendar/',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
      },
      manifest: {
        name: 'Календарь цикла',
        short_name: 'Цикл',
        description: 'Офлайн-календарь цикла. Данные хранятся только на устройстве.',
        lang: 'ru',
        display: 'standalone',
        start_url: '/period-calendar/',
        scope: '/period-calendar/',
        theme_color: '#FBF7F5',
        background_color: '#FBF7F5',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});

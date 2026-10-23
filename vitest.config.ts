import { defineConfig } from 'vitest/config';
import { version } from './package.json';

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version), __APP_BUILD__: JSON.stringify('test') },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
});

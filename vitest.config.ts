import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

const { version } = pkg;

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version), __APP_BUILD__: JSON.stringify('test') },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
});

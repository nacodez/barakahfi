import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    // No grace window, so the replay-detection e2e test is deterministic.
    env: { REFRESH_REUSE_LEEWAY_SECONDS: '0', PRICE_TICKER_ENABLED: 'false' },
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    testTimeout: 30_000,
  },
});

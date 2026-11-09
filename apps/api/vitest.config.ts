import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// esbuild (Vitest's default transformer) does not emit decorator metadata,
// which Nest's DI relies on. SWC does.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: { provider: 'v8', include: ['src/**/*.service.ts', 'src/**/*.util.ts'] },
  },
});

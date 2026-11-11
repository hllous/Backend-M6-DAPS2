import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ jsc: { transform: { useDefineForClassFields: false } } })],
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    // Las suites comparten una base y la truncan: un archivo a la vez.
    fileParallelism: false,
    testTimeout: 30_000,
    // Jest aplicaba el testTimeout también a los hooks (beforeAll levanta la app).
    hookTimeout: 30_000,
    globalSetup: ['test/global-setup.ts'],
  },
});

import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const umbral = { statements: 85, branches: 85, functions: 85, lines: 85 };

// SWC en vez del transform por defecto de Vite: NestJS resuelve la inyección
// por `emitDecoratorMetadata`, y oxc/esbuild no emiten esa metadata. Los campos
// de clase sin inicializar no se definen, igual que tsc con target ES2021: SWC por
// defecto los crea como `undefined` y los tests verían otro código que el build.
export default defineConfig({
  plugins: [swc.vite({ jsc: { transform: { useDefineForClassFields: false } } })],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts', 'prisma/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,js}', 'scripts/migrate-crew-user-ids.ts'],
      exclude: [
        '**/*.spec.ts',
        '**/*.module.ts',
        '**/dto/**',
        '**/index.ts',
        'src/main.ts',
        'src/configure-app.ts',
        'src/config/**',
        'src/events/update-ticket-status-schema.testing.ts',
        'src/prisma/**',
      ],
      thresholds: {
        ...umbral,
        '**/indicators/indicators.service.ts': umbral,
        '**/indicators/indicators.intervals.ts': umbral,
        '**/containers/containers.service.ts': umbral,
        '**/services/services.service.ts': umbral,
        '**/citizen-portal/citizen-portal.service.ts': umbral,
        '**/environmental-reports/environmental-reports.service.ts': umbral,
        '**/consumers/tickets.consumer.ts': umbral,
      },
    },
  },
});

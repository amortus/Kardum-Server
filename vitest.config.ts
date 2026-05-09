import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
    setupFiles: ['tests/helpers/setup.ts'],
    testTimeout: 10_000,
    hookTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        'admin/**',
        'deploy/**',
        '**/*.config.ts',
        '**/*.d.ts',
      ],
    },
    reporters: ['default'],
  },
});

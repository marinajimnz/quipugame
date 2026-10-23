import { defineConfig } from 'vitest/config';

// Tests de integración contra el proyecto Supabase enlazado (no hay base local).
export default defineConfig({
  test: {
    include: ['tests/db/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Los tests comparten un único proyecto: nada en paralelo.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Tests unitarios del cliente. Los de integración con la base de datos usan vitest.db.config.ts.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});

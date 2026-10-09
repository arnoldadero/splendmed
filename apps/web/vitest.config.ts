import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    /*
     * Note: tsconfig sets jsx: "preserve" for Next.js, which stops Vite parsing a
     * .tsx file under test. Keep pure, testable logic in .ts modules beside the
     * component (see lib/product-visual.ts) rather than inside the .tsx.
     */
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/.next/**'],
  },
});

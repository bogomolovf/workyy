import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@workyy/dag-executor': path.resolve(
        __dirname,
        '../../packages/dag-executor/src/index.ts',
      ),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});


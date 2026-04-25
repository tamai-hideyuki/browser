import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'build', 'dist', 'legacy'],
    // Repository / Electron 依存のテストはここで除外（要件に応じて切替）
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/main/**/*.ts', 'src/shell/**/*.ts', 'src/shared/**/*.ts'],
      exclude: ['src/preload/**', 'src/main/index.ts', 'src/main/window/**'],
    },
  },
});

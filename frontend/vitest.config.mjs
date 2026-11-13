import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname),
  esbuild: {
    loader: 'jsx',
    include: /[\\/]src[\\/].*\.[jt]sx?$|[\\/]tests[\\/].*\.[jt]sx?$/,
    exclude: [],
    jsx: 'automatic',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setupVitest.js'],
    include: ['tests/**/*.unit.test.{js,jsx,mjs}'],
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

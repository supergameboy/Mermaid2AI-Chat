import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const root = resolve(__dirname);

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      '@': resolve(root, 'src'),
    },
  },
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});

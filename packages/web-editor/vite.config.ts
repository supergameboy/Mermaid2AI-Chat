import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // 开发模式使用 editor 源码，避免调试压缩产物
      {
        find: /^@mermaid2aichat\/editor\/styles\.css$/,
        replacement: path.resolve(__dirname, '../editor/src/styles.css'),
      },
      {
        find: /^@mermaid2aichat\/editor$/,
        replacement: path.resolve(__dirname, '../editor/src/index.ts'),
      },
    ],
  },
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://localhost:14514',
        ws: true,
      },
    },
  },
});

import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 测试配置
 *
 * 测试核心场景：
 * 1. 用户画图 → AI 读取（get_input）
 * 2. AI 展示 → 用户查看（create_view）
 * 3. 断线重连
 * 4. 多客户端同步
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // E2E 测试串行执行，避免端口冲突
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // 单 worker，避免多客户端测试冲突
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @mermaid-editor/server start',
      url: 'http://localhost:14514/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      name: 'server',
    },
    {
      command: 'pnpm --filter @mermaid-editor/web-editor dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      name: 'web-editor',
    },
  ],
});

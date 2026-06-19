/**
 * E2E 测试 — 核心场景
 *
 * 1. 用户画图 → AI 读取（get_input）
 * 2. AI 展示 → 用户查看（create_view）
 * 3. 断线重连
 * 4. 多客户端同步
 */
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { initMcpSession, createView, getInput } from './mcp-helpers.js';

/** 等待连接状态变为 connected */
async function waitForConnected(page: Page): Promise<void> {
  await expect(page.locator('.status-label')).toContainText('已连接', { timeout: 10_000 });
}

/** 等待画布出现指定数量的节点 */
async function waitForNodeCount(page: Page, count: number): Promise<void> {
  await expect(page.locator('.react-flow__node')).toHaveCount(count, { timeout: 5_000 });
}

/** 点击节点库项添加节点 */
async function addNode(page: Page, shapeLabel: string): Promise<void> {
  await page.locator('.node-item', { hasText: shapeLabel }).click();
}

/** 通过 HTTP /reset 端点重置服务端 Store，确保测试隔离 */
async function resetServerStore(request: APIRequestContext): Promise<void> {
  await request.post('http://localhost:14514/reset');
}

// 每个测试前重置服务端 Store，确保测试隔离
test.beforeEach(async ({ request }) => {
  await resetServerStore(request);
});

// ============================================================

test.describe('场景1：用户画图 → AI 读取（get_input）', () => {
  test('用户添加节点后，AI 调用 get_input 应返回画布数据', async ({ page, request }) => {
    await page.goto('/');
    await waitForConnected(page);

    // 用户添加 2 个节点
    await addNode(page, '矩形');
    await addNode(page, '菱形');
    await waitForNodeCount(page, 2);

    // 等待 canvas_edit 发送到服务端
    await page.waitForTimeout(500);

    // AI 调用 get_input 读取画布
    const sessionId = await initMcpSession(request);
    const result = await getInput(request, sessionId);

    // 验证返回的画布数据包含用户添加的节点
    expect(result).toHaveProperty('status');
    const status = (result as { status: string }).status;
    expect(status).toBe('success');
    const data = result as { mermaid: string; nodeCount: number; edgeCount: number };
    expect(data.nodeCount).toBeGreaterThanOrEqual(2);
    expect(data.mermaid).toContain('flowchart');
  });
});

// ============================================================

test.describe('场景2：AI 展示 → 用户查看（create_view）', () => {
  test('AI 调用 create_view 后，用户画布应显示 AI 生成的节点', async ({ page, request }) => {
    await page.goto('/');
    await waitForConnected(page);

    // AI 调用 create_view 生成流程图
    const sessionId = await initMcpSession(request);
    const mermaidCode = 'flowchart TD\n  A[开始] --> B[处理] --> C[结束]';
    const result = await createView(request, sessionId, mermaidCode, 'AI 生成流程');

    // 验证 create_view 返回成功
    expect(result).toHaveProperty('success', true);

    // 用户画布应显示 3 个节点（A, B, C）
    await waitForNodeCount(page, 3);

    // 验证节点文本
    const nodeTexts = await page.locator('.react-flow__node').allTextContents();
    const allText = nodeTexts.join(' ');
    expect(allText).toContain('开始');
    expect(allText).toContain('处理');
    expect(allText).toContain('结束');
  });

  test('create_view 后 consumed 应为 true（AI 内容已展示）[TC-3.9c]', async ({ page, request }) => {
    await page.goto('/');
    await waitForConnected(page);

    const sessionId = await initMcpSession(request);
    await createView(request, sessionId, 'flowchart TD\n  X[测试节点]', '测试');

    // consumed 徽章应显示"已消费"状态
    await expect(page.locator('.consumed-badge')).toBeVisible({ timeout: 5_000 });
  });
});

// ============================================================

test.describe('场景3：断线重连', () => {
  test('断线后重连，画布状态应通过 reconnect_sync 恢复 [TC-3.12]', async ({ page, request }) => {
    await page.goto('/');
    await waitForConnected(page);

    // AI 先生成画布
    const sessionId = await initMcpSession(request);
    await createView(request, sessionId, 'flowchart TD\n  R[重连测试] --> S[恢复]');
    await waitForNodeCount(page, 2);

    // 模拟断线：通过浏览器上下文关闭 WebSocket
    await page.evaluate(() => {
      // 找到 WebSocket 实例并关闭
      // React Flow 的 WebSocket 在 useWebSocket hook 内部管理
      // 通过重载页面模拟断线重连
      window.close();
    });

    // 重新打开页面（模拟重连）
    await page.goto('/');
    await waitForConnected(page);

    // 重连后画布应通过 reconnect_sync 恢复 2 个节点
    await waitForNodeCount(page, 2);
  });
});

// ============================================================

test.describe('场景4：多客户端同步', () => {
  test('客户端A 编辑画布，客户端B 应同步看到变化', async ({ browser, request }) => {
    // 客户端 A
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await pageA.goto('/');
    await waitForConnected(pageA);

    // 客户端 B
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto('/');
    await waitForConnected(pageB);

    // AI 先生成初始画布
    const sessionId = await initMcpSession(request);
    await createView(request, sessionId, 'flowchart TD\n  M[多客户端] --> N[同步]');
    await waitForNodeCount(pageA, 2);
    await waitForNodeCount(pageB, 2);

    // 客户端 A 添加节点
    await addNode(pageA, '圆形');
    // 客户端 A 现在有 3 个节点
    await waitForNodeCount(pageA, 3);

    // 客户端 B 应同步看到第 3 个节点（通过 canvas_update 广播）
    await waitForNodeCount(pageB, 3);

    await contextA.close();
    await contextB.close();
  });
});

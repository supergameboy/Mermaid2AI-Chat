/**
 * create_view 工具 — AI → 用户方向
 * 将 mermaid 代码渲染为可视化画布并展示给用户
 *
 * 多标签页架构：每次调用创建新标签页，不覆盖已有视图
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { parseMermaid } from '@mermaid2aichat/serializer';
import type { WsServer } from '../ws-server.js';
import type { WorkspaceRegistry } from '../workspace-registry.js';

/** 获取或创建 sessionId 的函数类型 */
type GetSessionIdFn = (server: McpServer) => string;

export function registerCreateViewTool(
  server: McpServer,
  wsServer: WsServer,
  registry: WorkspaceRegistry,
  getSessionId: GetSessionIdFn
): void {
  server.tool(
    'create_view',
    '将mermaid流程图代码渲染为可视化画布并展示给用户。每次调用创建新标签页，不覆盖已有视图。',
    {
      mermaid: z.string().describe('Mermaid flowchart代码，例如: flowchart TD\n  A[开始] --> B[结束]'),
      title: z.string().optional().describe('可选的图表标题'),
    },
    async ({ mermaid, title }, extra) => {
      try {
        // 严格校验 workspaceRoot（无 fallback）
        const workspaceRoot = extra.requestInfo?.headers?.['x-workspace-root'] as string | undefined;
        if (!workspaceRoot) {
          throw new Error('Missing x-workspace-root header');
        }

        const { store, persistence } = await registry.getOrCreate(workspaceRoot);

        console.log('[create_view] 收到请求, title:', title, 'mermaid长度:', mermaid.length);

        // 解析 mermaid 代码
        const parseResult = parseMermaid(mermaid);
        console.log('[create_view] 解析结果:', {
          success: parseResult.success,
          nodeCount: parseResult.canvas.nodes.length,
          edgeCount: parseResult.canvas.edges.length,
          errors: parseResult.errors.length,
        });

        if (!parseResult.success && parseResult.canvas.nodes.length === 0) {
          // 解析失败且无节点 → 返回错误
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: false,
                message: 'Mermaid代码解析失败',
                errors: parseResult.errors,
              }),
            }],
          };
        }

        // 获取 sessionId（按 MCP 连接）
        const sessionId = getSessionId(server);

        // 创建新视图前，先保存旧活动视图内容到磁盘（防止内容丢失）
        const storeState = store.getState();
        if (storeState.activeViewId) {
          await persistence.updateViewContent(storeState.activeViewId, {
            canvas: storeState.activeCanvas,
            consumed: storeState.activeConsumed,
            viewport: storeState.activeViewport,
          });
        }

        // 创建新视图（不覆盖已有视图）
        let viewId: string;
        try {
          viewId = storeState.createView({
            title: title ?? null,
            source: 'ai',
            sessionId,
            canvas: parseResult.canvas,
            consumed: {
              consumed: true,
              canvasSource: 'ai',
              lastConsumedAt: Date.now(),
            },
            viewport: { x: 0, y: 0, zoom: 1 },
          });
        } catch (err) {
          // createView 超限会抛异常
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: false,
                message: (err as Error).message,
              }),
            }],
          };
        }

        // 保存新视图内容到磁盘
        await persistence.updateViewContent(viewId, {
          canvas: parseResult.canvas,
          consumed: {
            consumed: true,
            canvasSource: 'ai',
            lastConsumedAt: Date.now(),
          },
          viewport: { x: 0, y: 0, zoom: 1 },
        });

        // 显式广播（views_update + active_view_update）
        wsServer.broadcastViewsUpdate(workspaceRoot);
        wsServer.broadcastActiveViewUpdate(workspaceRoot);

        console.log('[create_view] 完成, viewId:', viewId, '已广播到客户端');

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: '已创建新标签页并展示给用户',
              viewId,
              title: title ?? null,
              nodeCount: parseResult.canvas.nodes.length,
              edgeCount: parseResult.canvas.edges.length,
              sessionId,
              ...(parseResult.errors.length > 0 ? { warnings: parseResult.errors } : {}),
            }),
          }],
        };
      } catch (err) {
        console.error('[create_view] 工具执行错误:', err);
        throw err;
      }
    }
  );
}

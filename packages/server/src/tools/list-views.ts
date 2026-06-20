/**
 * list_views 工具 — 列出当前所有视图（标签页）
 *
 * 包括 AI 输出历史和用户手动创建的视图
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WorkspaceRegistry } from '../workspace-registry.js';

export function registerListViewsTool(
  server: McpServer,
  registry: WorkspaceRegistry
): void {
  server.tool(
    'list_views',
    '列出当前所有视图（标签页），包括AI输出历史和用户手动创建的视图。',
    {},
    async (_, extra) => {
      // 严格校验 workspaceRoot（无 fallback）
      const workspaceRoot = extra.requestInfo?.headers?.['x-workspace-root'] as string | undefined;
      if (!workspaceRoot) {
        throw new Error('Missing x-workspace-root header');
      }

      const { store } = await registry.getOrCreate(workspaceRoot);
      const storeState = store.getState();

      const views = storeState.getViews();
      const activeViewId = storeState.getActiveViewId();

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            views: views.map((v) => ({
              id: v.id,
              title: v.title,
              createdAt: v.createdAt,
              updatedAt: v.updatedAt,
              sessionId: v.sessionId,
              source: v.source,
              isActive: v.id === activeViewId,
            })),
            activeViewId,
            totalCount: views.length,
          }),
        }],
      };
    }
  );
}

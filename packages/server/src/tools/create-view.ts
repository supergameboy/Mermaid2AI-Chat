/**
 * create_view 工具 — AI → 用户方向
 * 将 mermaid 代码渲染为可视化画布并展示给用户
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { parseMermaid, serializeMermaid } from '@mermaid-editor/serializer';
import { useEditorStore } from '../store.js';
import { consumedReducer } from '../consumed-state-machine.js';
import type { WsServer } from '../ws-server.js';

export function registerCreateViewTool(server: McpServer, wsServer: WsServer): void {
  server.tool(
    'create_view',
    '将mermaid流程图代码渲染为可视化画布并展示给用户。用于AI向用户展示关键流程。',
    {
      mermaid: z.string().describe('Mermaid flowchart代码，例如: flowchart TD\n  A[开始] --> B[结束]'),
      title: z.string().optional().describe('可选的图表标题'),
    },
    async ({ mermaid, title }) => {
      try {
        const store = useEditorStore.getState();

        console.log('[create_view] 收到请求, title:', title, 'mermaid长度:', mermaid.length);

        // 解析 mermaid 代码
        const parseResult = parseMermaid(mermaid);
        console.log('[create_view] 解析结果:', { success: parseResult.success, nodeCount: parseResult.canvas.nodes.length, edgeCount: parseResult.canvas.edges.length, errors: parseResult.errors.length });

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

        // 解析成功 → 更新 Store
        store.setCanvas({
          nodes: parseResult.canvas.nodes,
          edges: parseResult.canvas.edges,
          direction: parseResult.canvas.direction,
        });

        // CREATE_VIEW 事件：consumed=true, canvasSource='ai'（修复后的逻辑）
        const currentState = store.getConsumedState();
        const newState = consumedReducer(currentState, { type: 'CREATE_VIEW' });
        store.setConsumed(newState.consumed);
        store.setCanvasSource(newState.canvasSource);
        store.setLastConsumedAt(newState.lastConsumedAt ?? Date.now());
        store.setTitle(title ?? null);

        // 广播 create_view 通知（包含 canvas_update + create_view 消息）
        wsServer.broadcastCreateView({ mermaid, title: title ?? null });

        // 广播消费状态更新
        wsServer.broadcastConsumedUpdate();

        console.log('[create_view] 完成, 已广播到客户端');

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: '已展示给用户',
              nodeCount: parseResult.canvas.nodes.length,
              edgeCount: parseResult.canvas.edges.length,
              title: title ?? null,
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

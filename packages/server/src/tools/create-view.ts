/**
 * create_view 工具 — AI → 用户方向
 * 将 mermaid 代码渲染为可视化画布并展示给用户
 *
 * 多标签页架构：每次调用创建新标签页，不覆盖已有视图
 * 多图表类型：支持 12 种 Mermaid 图表类型，可通过 diagramType 参数显式指定
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { parseMermaid, isGraphCanvasState, detectDiagramType } from '@mermaid2aichat/serializer';
import type { DiagramType } from '@mermaid2aichat/serializer';
import type { WsServer } from '../ws-server.js';
import type { WorkspaceRegistry } from '../workspace-registry.js';

/** 获取或创建 sessionId 的函数类型 */
type GetSessionIdFn = (server: McpServer) => string;

/** 所有支持的图表类型（用于 zod schema enum） */
const DIAGRAM_TYPES: DiagramType[] = [
  'flowchart', 'sequenceDiagram', 'classDiagram', 'erDiagram',
  'mindmap', 'stateDiagram', 'architecture',
  'gantt', 'pie', 'timeline', 'quadrantChart', 'xychart',
];

export function registerCreateViewTool(
  server: McpServer,
  wsServer: WsServer,
  registry: WorkspaceRegistry,
  getSessionId: GetSessionIdFn
): void {
  server.tool(
    'create_view',
    '将mermaid代码渲染为可视化画布并展示给用户。支持12种图表类型（flowchart/sequenceDiagram/classDiagram/erDiagram/mindmap/stateDiagram/architecture/gantt/pie/timeline/quadrantChart/xychart）。每次调用创建新标签页，不覆盖已有视图。',
    {
      mermaid: z.string().describe('Mermaid 代码，例如: flowchart TD\n  A[开始] --> B[结束]'),
      title: z.string().optional().describe('可选的图表标题'),
      diagramType: z.enum(DIAGRAM_TYPES as [DiagramType, ...DiagramType[]]).optional().describe(
        '图表类型。如不指定，将根据 mermaid 代码自动检测'
      ),
    },
    async ({ mermaid, title, diagramType }, extra) => {
      try {
        // 严格校验 workspaceRoot（无 fallback）
        const workspaceRoot = extra.requestInfo?.headers?.['x-workspace-root'] as string | undefined;
        if (!workspaceRoot) {
          throw new Error('Missing x-workspace-root header');
        }

        const { store, persistence } = await registry.getOrCreate(workspaceRoot);

        console.log('[create_view] 收到请求, title:', title, 'diagramType:', diagramType ?? 'auto', 'mermaid长度:', mermaid.length);

        // 确定 diagramType：优先使用参数，否则自动检测
        const detectedType = diagramType ?? detectDiagramType(mermaid) ?? 'flowchart';

        // 解析 mermaid 代码（传入 diagramType 避免重复检测）
        const parseResult = parseMermaid(mermaid, { diagramType: detectedType });
        // 图结构类型才有 nodes/edges 字段
        const graphCanvas = isGraphCanvasState(parseResult.canvas) ? parseResult.canvas : null;
        const nodeCount = graphCanvas?.nodes.length ?? 0;
        const edgeCount = graphCanvas?.edges.length ?? 0;
        console.log('[create_view] 解析结果:', {
          diagramType: parseResult.canvas.diagramType,
          success: parseResult.success,
          nodeCount,
          edgeCount,
          errors: parseResult.errors.length,
        });

        if (!parseResult.success && nodeCount === 0 && parseResult.canvas.diagramType === detectedType) {
          // 解析失败且无有效数据 → 返回错误
          // 注意：数据图表类型即使解析有 errors，canvas 仍可能含有效数据，不在此拦截
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

        console.log('[create_view] 完成, viewId:', viewId, 'diagramType:', parseResult.canvas.diagramType, '已广播到客户端');

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: '已创建新标签页并展示给用户',
              viewId,
              title: title ?? null,
              diagramType: parseResult.canvas.diagramType,
              nodeCount,
              edgeCount,
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

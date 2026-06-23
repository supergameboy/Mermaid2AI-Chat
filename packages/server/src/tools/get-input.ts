/**
 * get_input 工具 — 用户 → AI 方向（核心功能）
 * 获取用户在可视化编辑器中绘制的流程图，返回 mermaid 代码
 *
 * 多标签页架构：
 * - 不传 viewId → 读取活动视图（内存读取 + 标记已消费）
 * - 传 viewId → 读取指定视图（磁盘加载 + 不修改消费状态）
 *
 * 响应类型:
 * - status: 'success' → 成功读取，返回 mermaid 代码
 * - status: 'already_consumed' → 画布已消费
 * - status: 'empty' → 画布为空
 * - status: 'ai_content' → 画布内容为 AI 生成
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { serializeMermaid, isGraphCanvasState } from '@mermaid2aichat/serializer';
import { consumedReducer } from '../consumed-state-machine.js';
import type { WsServer } from '../ws-server.js';
import type { WorkspaceRegistry } from '../workspace-registry.js';

export function registerGetInputTool(
  server: McpServer,
  wsServer: WsServer,
  registry: WorkspaceRegistry
): void {
  server.tool(
    'get_input',
    '获取用户在可视化编辑器中绘制的流程图，返回mermaid代码。调用后画布标记为已消费。可选传入 viewId 读取历史视图（不标记已消费）。',
    {
      viewId: z.string().optional().describe('视图ID，不传则读取活动视图'),
    },
    async ({ viewId }, extra) => {
      try {
        // 严格校验 workspaceRoot（无 fallback）
        const workspaceRoot = extra.requestInfo?.headers?.['x-workspace-root'] as string | undefined;
        if (!workspaceRoot) {
          throw new Error('Missing x-workspace-root header');
        }

        const { store, persistence } = await registry.getOrCreate(workspaceRoot);
        const storeState = store.getState();

        // 1. 确定目标视图
        const targetViewId = viewId ?? storeState.getActiveViewId();
        if (!targetViewId) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                status: 'empty',
                message: '无活动视图',
              }),
            }],
          };
        }

        const viewSummary = storeState.getViewSummary(targetViewId);
        if (!viewSummary) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                status: 'error',
                message: `视图 ${viewId} 不存在`,
              }),
            }],
          };
        }

        // 2. 判断是否为活动视图
        const isActiveView = targetViewId === storeState.getActiveViewId();

        if (isActiveView) {
          // === 活动视图：走现有逻辑（内存读取 + 标记已消费） ===
          const activeCanvas = storeState.getActiveCanvas();
          // 第一批仅支持图结构类型（flowchart），非图结构类型不支持 get_input
          if (!isGraphCanvasState(activeCanvas)) {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  status: 'error',
                  message: `不支持的图表类型: ${activeCanvas.diagramType}`,
                  viewId: targetViewId,
                  title: viewSummary.title,
                }),
              }],
            };
          }
          const { nodes, edges, direction } = activeCanvas;
          const consumedState = storeState.getActiveConsumed();

          console.log('[get_input] 活动视图画布状态:', {
            viewId: targetViewId,
            nodeCount: nodes.length,
            edgeCount: edges.length,
            direction,
            consumed: consumedState.consumed,
            canvasSource: consumedState.canvasSource,
          });

          // 1. 空画布
          if (nodes.length === 0) {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  status: 'empty',
                  message: '画布为空，请先在编辑器中绘制流程图',
                  viewId: targetViewId,
                  title: viewSummary.title,
                }),
              }],
            };
          }

          // 2. 已消费
          if (consumedState.consumed) {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  status: 'already_consumed',
                  message: '画布已消费，用户需点击重新启用或编辑画布后再次询问',
                  lastConsumedAt: consumedState.lastConsumedAt,
                  canvasSource: consumedState.canvasSource,
                  viewId: targetViewId,
                  title: viewSummary.title,
                }),
              }],
            };
          }

          // 3. canvasSource === 'ai' 且 consumed === false（异常情况）
          if (consumedState.canvasSource === 'ai') {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  status: 'ai_content',
                  message: '画布当前内容为AI生成，如需分析请先编辑画布',
                  lastConsumedAt: consumedState.lastConsumedAt,
                  viewId: targetViewId,
                  title: viewSummary.title,
                }),
              }],
            };
          }

          // 4. 成功读取（consumed=false, canvasSource='user'）
          console.log('[get_input] 开始序列化...');
          const serializeResult = serializeMermaid({ diagramType: 'flowchart', nodes, edges, direction });
          console.log('[get_input] 序列化成功:', serializeResult.mermaid.substring(0, 100));

          // 触发 CONSUME 事件：标记为已消费
          const newState = consumedReducer(consumedState, { type: 'CONSUME' });
          store.getState().updateActiveConsumed(newState);

          // 显式广播消费状态更新
          wsServer.broadcastConsumedUpdate(workspaceRoot, store.getState().getActiveConsumed());

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                status: 'success',
                mermaid: serializeResult.mermaid,
                viewId: targetViewId,
                title: viewSummary.title,
                nodeCount: nodes.length,
                edgeCount: edges.length,
                direction,
                canvasSource: 'user',
              }),
            }],
          };
        } else {
          // === 非活动视图：从磁盘加载 + 不修改消费状态 ===
          console.log('[get_input] 读取非活动视图:', targetViewId);
          const content = await persistence.loadViewContent(targetViewId);
          if (!content) {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  status: 'error',
                  message: `视图 ${viewId} 内容加载失败`,
                  viewId: targetViewId,
                  title: viewSummary.title,
                }),
              }],
            };
          }

          // 检查消费状态（仅查询，不修改）
          if (content.consumed.consumed) {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  status: 'already_consumed',
                  message: `视图 ${viewSummary.title ?? viewId} 已消费`,
                  viewId: targetViewId,
                  title: viewSummary.title,
                  lastConsumedAt: content.consumed.lastConsumedAt,
                  canvasSource: content.consumed.canvasSource,
                }),
              }],
            };
          }

          if (content.consumed.canvasSource === 'ai') {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  status: 'ai_content',
                  message: `视图 ${viewSummary.title ?? viewId} 内容为AI生成`,
                  viewId: targetViewId,
                  title: viewSummary.title,
                  lastConsumedAt: content.consumed.lastConsumedAt,
                }),
              }],
            };
          }

          // 成功读取（不标记已消费，不广播）
          const serializeResult = serializeMermaid(content.canvas);
          // 图结构类型才有 nodes/edges/direction 字段
          const graphCanvas = isGraphCanvasState(content.canvas) ? content.canvas : null;
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                status: 'success',
                mermaid: serializeResult.mermaid,
                viewId: targetViewId,
                title: viewSummary.title,
                diagramType: content.canvas.diagramType,
                nodeCount: graphCanvas?.nodes.length ?? 0,
                edgeCount: graphCanvas?.edges.length ?? 0,
                direction: graphCanvas?.direction,
                canvasSource: 'user',
                note: '读取非活动视图，未标记已消费',
              }),
            }],
          };
        }
      } catch (err) {
        console.error('[get_input] 工具执行错误:', err);
        throw err;
      }
    }
  );
}

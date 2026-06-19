/**
 * get_input 工具 — 用户 → AI 方向（核心功能）
 * 获取用户在可视化编辑器中绘制的流程图，返回 mermaid 代码
 *
 * 响应类型（修复：status 字段替代 consumed，消除语义歧义）:
 * - status: 'success' → 成功读取，返回 mermaid 代码
 * - status: 'already_consumed' → 画布已消费，提示用户重新启用或编辑画布
 * - status: 'empty' → 画布为空
 * - status: 'ai_content' → 画布内容为 AI 生成，非用户绘制
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { serializeMermaid } from '@mermaid-editor/serializer';
import { useEditorStore } from '../store.js';
import { consumedReducer } from '../consumed-state-machine.js';
import type { WsServer } from '../ws-server.js';

export function registerGetInputTool(server: McpServer, wsServer: WsServer): void {
  server.tool(
    'get_input',
    '获取用户在可视化编辑器中绘制的流程图，返回mermaid代码。调用后画布标记为已消费，用户需点击重新启用或编辑画布后才能再次输入。',
    {},
    async () => {
      try {
        const store = useEditorStore.getState();
        const { nodes, edges, direction } = store.getCanvas();
        const consumedState = store.getConsumedState();

        console.log('[get_input] 画布状态:', { nodeCount: nodes.length, edgeCount: edges.length, direction, consumed: consumedState.consumed, canvasSource: consumedState.canvasSource });

        // 1. 空画布
        if (nodes.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                status: 'empty',
                message: '画布为空，请先在编辑器中绘制流程图',
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
              }),
            }],
          };
        }

        // 4. 成功读取（consumed=false, canvasSource='user'）
        console.log('[get_input] 节点数据样本:', JSON.stringify(nodes[0], null, 2));
        console.log('[get_input] 开始序列化...');
        const serializeResult = serializeMermaid({ nodes, edges, direction });
        console.log('[get_input] 序列化成功:', serializeResult.mermaid.substring(0, 100));

        // 触发 CONSUME 事件：标记为已消费
        const newState = consumedReducer(consumedState, { type: 'CONSUME' });
        store.setConsumed(newState.consumed);
        store.setLastConsumedAt(newState.lastConsumedAt ?? Date.now());

        // 广播消费状态更新
        wsServer.broadcastConsumedUpdate();

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              status: 'success',
              mermaid: serializeResult.mermaid,
              nodeCount: nodes.length,
              edgeCount: edges.length,
              direction,
              canvasSource: 'user',
            }),
          }],
        };
      } catch (err) {
        console.error('[get_input] 工具执行错误:', err);
        throw err;
      }
    }
  );
}

/**
 * 序列化器 — CanvasState → Mermaid 代码
 * 自定义序列化器，完全可控，输出格式精确
 */
import type { CanvasState, SerializeResult } from './types.js';
import { serializeNode } from './node-serializer.js';
import { serializeEdge } from './edge-serializer.js';

/**
 * 将画布状态序列化为 Mermaid 代码
 */
export function serializeMermaid(canvas: CanvasState): SerializeResult {
  const lines: string[] = [];

  // 流程图声明 + 方向
  lines.push(`flowchart ${canvas.direction}`);

  // 空画布
  if (canvas.nodes.length === 0 && canvas.edges.length === 0) {
    return {
      mermaid: lines.join('\n'),
      errors: [],
    };
  }

  // 序列化节点（先输出所有节点定义）
  const nodeLines: string[] = [];
  for (const node of canvas.nodes) {
    nodeLines.push(`  ${serializeNode(node)}`);
  }

  // 序列化边
  const edgeLines: string[] = [];
  for (const edge of canvas.edges) {
    edgeLines.push(`  ${serializeEdge(edge)}`);
  }

  // 合并：节点 + 边
  const allLines = [...nodeLines, ...edgeLines];
  lines.push(allLines.join('\n'));

  return {
    mermaid: lines.join('\n'),
    errors: [],
  };
}

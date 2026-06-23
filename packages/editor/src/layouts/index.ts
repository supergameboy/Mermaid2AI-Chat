/**
 * 布局注册 — 按 diagramType 分发布局算法
 *
 * 单一职责：注册各图表类型的布局算法，提供按类型查询接口
 *
 * sequenceDiagram 使用专用 SequenceCanvas（不经过 React Flow，不在此注册）
 */
import type {
  FlowchartDirection,
  GraphDiagramType,
  GraphMetadata,
  MermaidEdge,
  MermaidNode,
} from '@mermaid2aichat/serializer';
import { layoutWithDagre } from './dagre-layout.js';
import { layoutMindmap } from './tree-layout.js';

/** 布局结果（节点 + 边） */
export interface LayoutResult {
  nodes: MermaidNode[];
  edges: MermaidEdge[];
}

/** 布局函数类型 */
export type LayoutFn = (
  nodes: MermaidNode[],
  edges: MermaidEdge[],
  direction?: FlowchartDirection,
  metadata?: GraphMetadata,
) => LayoutResult;

/**
 * 根据 diagramType 获取布局函数
 * - flowchart/class/er/state/architecture: dagre 布局（compound + 动态尺寸 + minlen + 自环）
 * - sequence: 专用 SequenceCanvas，不经过此函数
 * - mindmap: 树布局（水平分层）
 */
export function getLayoutFn(diagramType: GraphDiagramType): LayoutFn {
  switch (diagramType) {
    case 'flowchart':
    case 'classDiagram':
    case 'erDiagram':
    case 'stateDiagram':
    case 'architecture':
      // 这些类型使用 dagre 布局
      return (nodes, edges, direction, metadata) =>
        layoutWithDagre(nodes, edges, direction ?? 'TD', metadata);
    case 'sequenceDiagram':
      // sequenceDiagram 使用专用 SequenceCanvas，不经过 React Flow
      // 若到达此处，说明 canvas.tsx 路由有误
      throw new Error('sequenceDiagram 应使用 SequenceCanvas，不应调用 getLayoutFn');
    case 'mindmap':
      // 树布局：根据 parentId 构建树（mindmap 无边参与布局，edges 原样返回）
      return (nodes, edges) => ({ nodes: layoutMindmap(nodes), edges });
    default: {
      // 穷尽检查
      const _exhaustive: never = diagramType;
      throw new Error(`未支持的图结构类型布局: ${_exhaustive}`);
    }
  }
}

// 导出布局函数
export { layoutWithDagre } from './dagre-layout.js';
export { layoutMindmap } from './tree-layout.js';

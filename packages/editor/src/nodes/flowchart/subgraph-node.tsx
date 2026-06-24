/**
 * subgraph 节点组件 — 渲染子图边框 + 标题栏，子节点由 React Flow Parent Node 机制管理
 *
 * 单一职责：渲染 subgraph 容器视觉（标题栏 + 边框），不负责子节点定位
 *
 * 数据流:
 *   MermaidNode (data.isSubgraph=true) → SubgraphNodeComponent
 *     → 标题栏 (data.label + data.dir) + 边框 + 子节点容器
 *
 * React Flow Parent Node 机制:
 *   - 子节点通过 parentId 指向 subgraph 节点
 *   - 子节点 extent: 'parent' 限制在父节点范围内
 *   - React Flow 自动管理子节点的相对定位
 */

import { memo } from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import type { MermaidNodeData } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

/** subgraph 节点数据（扩展 MermaidNodeData） */
export interface SubgraphNodeData extends MermaidNodeData {
  /** subgraph 标记 */
  isSubgraph: true;
  /** 子节点 ID 列表 */
  subgraphNodes: string[];
  /** subgraph 方向（可选） */
  dir?: string;
  /** 是否为用户显式声明的方向 */
  hasExplicitDir?: boolean;
}

/** React Flow 节点类型 */
export type SubgraphFlowNode = Node<SubgraphNodeData, 'subgraph'>;

// ============================================================
// 常量
// ============================================================

const DEFAULT_BORDER_COLOR = '#676767';
const DEFAULT_BG_COLOR = 'rgba(135, 131, 120, 0.1)';
const DEFAULT_TITLE_BG = 'rgba(135, 131, 120, 0.2)';
const SELECTED_BORDER_COLOR = '#1890ff';
const TITLE_HEIGHT = 28;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 100;

// ============================================================
// subgraph 节点组件
// ============================================================

/**
 * subgraph 节点组件
 *
 * 渲染标题栏 + 边框，子节点由 React Flow Parent Node 机制自动定位
 * 不渲染 Handle（subgraph 本身不可连接，边连接到子节点）
 */
export const SubgraphNodeComponent = memo(function SubgraphNodeComponent({
  data,
  selected,
  width,
  height,
}: NodeProps<SubgraphFlowNode>) {
  const borderColor = selected ? SELECTED_BORDER_COLOR : DEFAULT_BORDER_COLOR;
  const label = data.label || '';
  const dir = readField<string>(data, 'dir');

  // 方向标签
  const dirLabel = dir ? ` [${dir}]` : '';

  return (
    <div
      className="mermaid-subgraph"
      style={{
        width: '100%',
        height: '100%',
        minWidth: MIN_WIDTH,
        minHeight: MIN_HEIGHT,
        border: `1px solid ${borderColor}`,
        borderRadius: '4px',
        backgroundColor: DEFAULT_BG_COLOR,
        position: 'relative',
        boxSizing: 'border-box',
        overflow: 'visible',
      }}
    >
      {/* 标题栏 */}
      <div
        className="mermaid-subgraph-title"
        style={{
          height: TITLE_HEIGHT,
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          fontSize: '14px',
          fontWeight: 500,
          color: '#333',
          backgroundColor: DEFAULT_TITLE_BG,
          borderBottom: `1px solid ${borderColor}`,
          borderRadius: '4px 4px 0 0',
          userSelect: 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}{dirLabel}
      </div>

      {/* 子节点容器 — React Flow 自动渲染子节点到此区域 */}
      <div
        className="mermaid-subgraph-content"
        style={{
          position: 'relative',
          width: '100%',
          height: `calc(100% - ${TITLE_HEIGHT}px)`,
        }}
      />
    </div>
  );
});

SubgraphNodeComponent.displayName = 'SubgraphNode';

// ============================================================
// 辅助函数
// ============================================================

/** 安全读取 MermaidNodeData 的扩展字段 */
function readField<T>(data: MermaidNodeData, key: string): T | undefined {
  const value = (data as Record<string, unknown>)[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as T;
}

/**
 * Namespace 节点组件 — 渲染 classDiagram 命名空间容器
 *
 * 单一职责：渲染命名空间容器视觉（标题栏 + 边框），不负责子节点定位
 *
 * 数据流:
 *   MermaidNode (type='namespace') → NamespaceNodeComponent
 *     → 标题栏 (data.label) + 边框 + 子节点容器
 *
 * React Flow Parent Node 机制:
 *   - 子节点通过 parentId 指向 namespace 节点
 *   - 子节点 extent: 'parent' 限制在父节点范围内
 *   - React Flow 自动管理子节点的相对定位
 *
 * 参考: packages/editor/src/nodes/flowchart/subgraph-node.tsx
 */

import { memo } from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import type { MermaidNodeData } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

/** React Flow 节点类型，data 为 MermaidNodeData */
export type NamespaceFlowNode = Node<MermaidNodeData, 'namespace'>;

// ============================================================
// 常量
// ============================================================

const DEFAULT_BORDER_COLOR = '#676767';
const DEFAULT_BG_COLOR = 'rgba(135, 131, 120, 0.05)';
const DEFAULT_TITLE_BG = 'rgba(135, 131, 120, 0.15)';
const SELECTED_BORDER_COLOR = '#1890ff';
const TITLE_HEIGHT = 28;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 100;

// ============================================================
// 节点组件
// ============================================================

/**
 * Namespace 节点组件
 *
 * 渲染标题栏 + 边框，子节点由 React Flow Parent Node 机制自动定位
 * 不渲染 Handle（namespace 本身不可连接，边连接到子节点）
 */
export const NamespaceNodeComponent = memo(function NamespaceNodeComponent({
  data,
  selected,
}: NodeProps<NamespaceFlowNode>) {
  const borderColor = selected ? SELECTED_BORDER_COLOR : DEFAULT_BORDER_COLOR;
  const label = data.label || '';

  return (
    <div
      className="class-namespace"
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
      }}
    >
      {/* 标题栏 */}
      <div
        className="class-namespace-title"
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
        <span style={{ marginRight: 6 }}>namespace</span>
        {label}
      </div>

      {/* 子节点容器 — React Flow 自动渲染子节点到此区域 */}
      <div
        className="class-namespace-content"
        style={{
          position: 'relative',
          width: '100%',
          height: `calc(100% - ${TITLE_HEIGHT}px)`,
        }}
      />
    </div>
  );
});

NamespaceNodeComponent.displayName = 'NamespaceNode';

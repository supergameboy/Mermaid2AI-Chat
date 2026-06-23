/**
 * er-subgraph 节点组件 — 渲染 ER 子图边框 + 标题栏，子实体由 React Flow Parent Node 机制管理
 *
 * 单一职责：渲染 ER subgraph 容器视觉（标题栏 + 边框），不负责子节点定位
 *
 * 数据流:
 *   MermaidNode (type='er-subgraph') → ErSubgraphComponent
 *     → 标题栏 (data.label + data.direction) + 边框 + 子节点容器
 *
 * React Flow Parent Node 机制:
 *   - 子实体节点通过 parentId 指向 subgraph 节点
 *   - 子实体节点 extent: 'parent' 限制在父节点范围内
 *   - React Flow 自动管理子节点的相对定位
 */

import { memo } from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import type { MermaidNodeData } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

/** er-subgraph 节点数据（扩展 MermaidNodeData） */
export interface ErSubgraphNodeData extends MermaidNodeData {
  /** subgraph 方向（可选，对应 metadata.erSubgraphs[].dir） */
  direction?: string;
}

/** React Flow 节点类型 */
export type ErSubgraphFlowNode = Node<ErSubgraphNodeData, 'er-subgraph'>;

// ============================================================
// 常量
// ============================================================

const DEFAULT_BORDER_COLOR = '#5b5b5b';
const DEFAULT_BG_COLOR = 'rgba(135, 131, 120, 0.08)';
const DEFAULT_TITLE_BG = 'rgba(135, 131, 120, 0.18)';
const SELECTED_BORDER_COLOR = '#1890ff';
const TITLE_HEIGHT = 28;
const MIN_WIDTH = 240;
const MIN_HEIGHT = 120;

// ============================================================
// er-subgraph 节点组件
// ============================================================

/**
 * er-subgraph 节点组件
 *
 * 渲染标题栏 + 边框，子实体节点由 React Flow Parent Node 机制自动定位
 * 不渲染 Handle（subgraph 本身不可连接，边连接到子实体）
 */
export const ErSubgraphComponent = memo(function ErSubgraphComponent({
  data,
  selected,
}: NodeProps<ErSubgraphFlowNode>) {
  const borderColor = selected ? SELECTED_BORDER_COLOR : DEFAULT_BORDER_COLOR;
  const label = data.label || '';
  const direction = readField<string>(data, 'direction');

  // 方向标签
  const dirLabel = direction ? ` [${direction}]` : '';

  return (
    <div
      className="er-subgraph"
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
        className="er-subgraph-title"
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

      {/* 子节点容器 — React Flow 自动渲染子实体节点到此区域 */}
      <div
        className="er-subgraph-content"
        style={{
          position: 'relative',
          width: '100%',
          height: `calc(100% - ${TITLE_HEIGHT}px)`,
        }}
      />
    </div>
  );
});

ErSubgraphComponent.displayName = 'ErSubgraph';

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

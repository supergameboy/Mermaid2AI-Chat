/**
 * StateComposite 节点组件 — 渲染 stateDiagram 复合状态容器（带标题栏的圆角矩形）
 *
 * 单一职责：渲染复合状态容器视觉（标题栏 + 边框），不负责子节点定位
 *
 * 数据流:
 *   MermaidNode (type='state-composite') → StateCompositeComponent
 *     → 标题栏 (data.label) + 边框 + 子节点容器
 *
 * React Flow Parent Node 机制:
 *   - 子状态节点通过 parentId 指向 composite 节点
 *   - 子状态节点 extent: 'parent' 限制在父节点范围内
 *   - React Flow 自动管理子节点的相对定位
 *
 * 参考 ErSubgraphComponent 的实现模式
 */

import { memo } from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import type { MermaidNodeData } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

/** state-composite 节点数据（扩展 MermaidNodeData） */
export interface StateCompositeNodeData extends MermaidNodeData {
  /** 复合状态方向（可选，对应 metadata.composites[].direction） */
  direction?: string;
}

/** React Flow 节点类型 */
export type StateCompositeFlowNode = Node<StateCompositeNodeData, 'state-composite'>;

// ============================================================
// 常量
// ============================================================

const DEFAULT_BORDER_COLOR = '#5b5b5b';
const DEFAULT_BG_COLOR = 'rgba(135, 131, 120, 0.05)';
const DEFAULT_TITLE_BG = 'rgba(135, 131, 120, 0.15)';
const SELECTED_BORDER_COLOR = '#1890ff';
const TITLE_HEIGHT = 28;
const MIN_WIDTH = 240;
const MIN_HEIGHT = 120;

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

// ============================================================
// 节点组件
// ============================================================

/**
 * StateComposite 节点组件
 *
 * 渲染标题栏 + 边框，子状态节点由 React Flow Parent Node 机制自动定位
 * 不渲染 Handle（composite 本身不可连接，边连接到子状态）
 */
export const StateCompositeComponent = memo(function StateCompositeComponent({
  data,
  selected,
}: NodeProps<StateCompositeFlowNode>) {
  const borderColor = selected ? SELECTED_BORDER_COLOR : DEFAULT_BORDER_COLOR;
  const label = data.label || '';
  const direction = readField<string>(data, 'direction');

  // 方向标签
  const dirLabel = direction ? ` [${direction}]` : '';

  return (
    <div
      className="state-composite"
      style={{
        width: '100%',
        height: '100%',
        minWidth: MIN_WIDTH,
        minHeight: MIN_HEIGHT,
        border: `1px solid ${borderColor}`,
        borderRadius: '8px',
        backgroundColor: DEFAULT_BG_COLOR,
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* 标题栏 */}
      <div
        className="state-composite-title"
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
          borderRadius: '8px 8px 0 0',
          userSelect: 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}{dirLabel}
      </div>

      {/* 子节点容器 — React Flow 自动渲染子状态节点到此区域 */}
      <div
        className="state-composite-content"
        style={{
          position: 'relative',
          width: '100%',
          height: `calc(100% - ${TITLE_HEIGHT}px)`,
        }}
      />
    </div>
  );
});

StateCompositeComponent.displayName = 'StateComposite';

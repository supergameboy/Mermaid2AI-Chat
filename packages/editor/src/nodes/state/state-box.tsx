/**
 * StateBox 节点组件 — 渲染 stateDiagram 默认状态节点（圆角矩形 + label + 可选描述）
 *
 * 单一职责：渲染 stateDiagram 默认状态节点的视觉，管理 Handle 连接点
 *
 * 数据流:
 *   MermaidNode (type='state-default') → StateBoxComponent
 *     → 圆角矩形边框 + 居中 label 文本
 *     → 可选 stateDescription（描述文本，显示在 label 下方）
 *
 * 字段约定（通过 MermaidNodeData 承载）:
 *   - label: string                  — 状态名（M0 定义）
 *   - stateDescription?: string      — 状态描述（M0 定义）
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { MermaidNodeData } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

/** React Flow 节点类型，data 为 MermaidNodeData */
export type StateBoxFlowNode = Node<MermaidNodeData, 'state-default'>;

// ============================================================
// 常量
// ============================================================

const handleStyle = { width: 8, height: 8 };

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

/** StateBox 节点组件 — 渲染默认状态节点（圆角矩形 + label + 可选描述） */
export const StateBoxComponent = memo(function StateBoxComponent({
  data,
  selected,
}: NodeProps<StateBoxFlowNode>) {
  const description = readField<string>(data, 'stateDescription');

  const borderColor = selected ? '#1890ff' : '#333';
  const borderWidth = selected ? '2px' : '1px';

  return (
    <div
      className="state-box"
      style={{
        position: 'relative',
        display: 'inline-block',
        minWidth: 120,
        border: `${borderWidth} solid ${borderColor}`,
        borderRadius: 8,
        background: '#fff',
        fontSize: 14,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* 四方向 Handle — 支持任意方向连接 */}
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="target" position={Position.Left} id="left" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="right" style={handleStyle} />

      {/* 状态名 */}
      <div
        className="state-box-label"
        style={{
          padding: '6px 16px',
          textAlign: 'center',
          fontWeight: 500,
        }}
      >
        {data.label}
      </div>

      {/* 状态描述（可选） */}
      {description && (
        <>
          <div
            className="state-box-divider"
            style={{
              borderTop: `1px solid ${borderColor}`,
              margin: '0 4px',
              opacity: 0.5,
            }}
          />
          <div
            className="state-box-description"
            style={{
              padding: '4px 16px',
              fontSize: 12,
              color: '#666',
              textAlign: 'center',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {description}
          </div>
        </>
      )}
    </div>
  );
});

StateBoxComponent.displayName = 'StateBox';

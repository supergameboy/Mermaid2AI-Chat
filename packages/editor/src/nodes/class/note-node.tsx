/**
 * Note 节点组件 — 渲染 classDiagram 的注释节点
 *
 * 单一职责：渲染注释节点的视觉（带折角的矩形 + 文本），管理 Handle 连接点
 *
 * 数据流:
 *   MermaidNode (type='note') → NoteNodeComponent
 *     → 折角矩形 (data.label)
 *
 * 字段约定:
 *   - label: string — 注释文本（M0 定义）
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { MermaidNodeData } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

/** React Flow 节点类型，data 为 MermaidNodeData */
export type NoteFlowNode = Node<MermaidNodeData, 'note'>;

// ============================================================
// 常量
// ============================================================

const handleStyle = { width: 8, height: 8 };
const FOLD_SIZE = 12;

// ============================================================
// 节点组件
// ============================================================

/** Note 节点组件 — 渲染带折角的矩形注释 */
export const NoteNodeComponent = memo(function NoteNodeComponent({
  data,
  selected,
}: NodeProps<NoteFlowNode>) {
  const borderColor = selected ? '#1890ff' : '#999';
  const borderWidth = selected ? '2px' : '1px';

  return (
    <div
      className="class-note"
      style={{
        position: 'relative',
        display: 'inline-block',
        minWidth: 120,
        maxWidth: 280,
        background: '#fffce8',
        border: `${borderWidth} solid ${borderColor}`,
        borderRadius: 2,
        fontSize: 13,
        overflow: 'visible',
        boxSizing: 'border-box',
      }}
    >
      {/* 四方向 Handle */}
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="target" position={Position.Left} id="left" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="right" style={handleStyle} />

      {/* 折角效果 — 右上角折叠 */}
      <div
        className="note-fold"
        style={{
          position: 'absolute',
          top: -1,
          right: -1,
          width: 0,
          height: 0,
          borderTop: `${FOLD_SIZE}px solid ${borderColor}`,
          borderLeft: `${FOLD_SIZE}px solid transparent`,
        }}
      />
      <div
        className="note-fold-inner"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 0,
          height: 0,
          borderTop: `${FOLD_SIZE - 1}px solid #fffce8`,
          borderLeft: `${FOLD_SIZE - 1}px solid transparent`,
        }}
      />

      {/* 注释文本 */}
      <div
        className="note-text"
        style={{
          padding: '8px 12px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {data.label || '（空注释）'}
      </div>
    </div>
  );
});

NoteNodeComponent.displayName = 'NoteNode';

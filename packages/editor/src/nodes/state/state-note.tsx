/**
 * StateNote 节点组件 — 渲染 stateDiagram 的 Note 节点（黄色背景文本框）
 *
 * 单一职责：渲染 Note 节点的视觉（黄色背景 + 文本 + 左/右定位指示），管理 Handle 连接点
 *
 * 数据流:
 *   MermaidNode (type='state-note') → StateNoteComponent
 *     → 黄色背景 + 文本内容 + 左/右定位指示
 *
 * 字段约定（通过 MermaidNodeData 承载）:
 *   - label: string                       — Note 文本（M0 定义）
 *   - notePosition?: StateNotePosition    — Note 位置（'left of' | 'right of'，M0 定义）
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { MermaidNodeData, StateNotePosition } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

/** React Flow 节点类型，data 为 MermaidNodeData */
export type StateNoteFlowNode = Node<MermaidNodeData, 'state-note'>;

// ============================================================
// 常量
// ============================================================

const handleStyle = { width: 8, height: 8 };
const NOTE_BG = '#fffce8';
const NOTE_BORDER = '#d4b106';

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

/** StateNote 节点组件 — 渲染黄色背景的 Note 文本框 */
export const StateNoteComponent = memo(function StateNoteComponent({
  data,
  selected,
}: NodeProps<StateNoteFlowNode>) {
  const notePosition = readField<StateNotePosition>(data, 'notePosition');

  const borderColor = selected ? '#1890ff' : NOTE_BORDER;
  const borderWidth = selected ? '2px' : '1px';

  return (
    <div
      className="state-note"
      style={{
        position: 'relative',
        display: 'inline-block',
        minWidth: 120,
        maxWidth: 280,
        background: NOTE_BG,
        border: `${borderWidth} solid ${borderColor}`,
        borderRadius: 2,
        fontSize: 13,
        overflow: 'visible',
        boxSizing: 'border-box',
      }}
    >
      {/* 左右方向 Handle — 根据 notePosition 决定连接方向 */}
      <Handle type="target" position={Position.Left} id="left" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="right" style={handleStyle} />

      {/* 定位指示标签 */}
      {notePosition && (
        <div
          className="state-note-position"
          style={{
            position: 'absolute',
            top: -18,
            left: 0,
            fontSize: 10,
            color: '#999',
            userSelect: 'none',
          }}
        >
          {notePosition}
        </div>
      )}

      {/* Note 文本内容 */}
      <div
        className="state-note-text"
        style={{
          padding: '8px 12px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {data.label || '（空 Note）'}
      </div>
    </div>
  );
});

StateNoteComponent.displayName = 'StateNote';

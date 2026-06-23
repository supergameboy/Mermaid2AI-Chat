/**
 * State 特殊状态节点组件 — 渲染 stateDiagram 的特殊状态节点
 *
 * 单一职责：渲染 stateDiagram 特殊状态节点（start/end/fork/join/choice/divider）的视觉
 *
 * 数据流:
 *   MermaidNode (type='state-start' | 'state-end' | 'state-fork' | 'state-join' | 'state-choice' | 'state-divider')
 *     → 对应特殊状态组件
 *
 * 视觉约定（对齐官方 mermaid stateDiagram-v2 渲染）:
 *   - start:   实心圆 ●
 *   - end:     双圆 ◎（外圈 + 内圈实心）
 *   - fork:    实心矩形 ▬（宽扁黑色矩形）
 *   - join:    实心矩形 ▬（同 fork 视觉）
 *   - choice:  菱形 ◆
 *   - divider: 水平线 ———（仅一条横线，无内容）
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { MermaidNodeData } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

export type StateStartFlowNode = Node<MermaidNodeData, 'state-start'>;
export type StateEndFlowNode = Node<MermaidNodeData, 'state-end'>;
export type StateForkFlowNode = Node<MermaidNodeData, 'state-fork'>;
export type StateJoinFlowNode = Node<MermaidNodeData, 'state-join'>;
export type StateChoiceFlowNode = Node<MermaidNodeData, 'state-choice'>;
export type StateDividerFlowNode = Node<MermaidNodeData, 'state-divider'>;

// ============================================================
// 常量
// ============================================================

const handleStyle = { width: 8, height: 8 };
const SELECTED_COLOR = '#1890ff';
const DEFAULT_COLOR = '#333';

// ============================================================
// StateStart — 起始状态（实心圆 ●）
// ============================================================

/** StateStart 节点组件 — 渲染起始状态（实心圆） */
export const StateStartComponent = memo(function StateStartComponent({
  selected,
}: NodeProps<StateStartFlowNode>) {
  const borderColor = selected ? SELECTED_COLOR : DEFAULT_COLOR;

  return (
    <div
      className="state-start"
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {/* 上下方向 Handle */}
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />

      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: DEFAULT_COLOR,
          border: selected ? `2px solid ${borderColor}` : 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
});

StateStartComponent.displayName = 'StateStart';

// ============================================================
// StateEnd — 结束状态（双圆 ◎，外圈 + 内圈实心）
// ============================================================

/** StateEnd 节点组件 — 渲染结束状态（双圆） */
export const StateEndComponent = memo(function StateEndComponent({
  selected,
}: NodeProps<StateEndFlowNode>) {
  const borderColor = selected ? SELECTED_COLOR : DEFAULT_COLOR;

  return (
    <div
      className="state-end"
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {/* 上下方向 Handle */}
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />

      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: `2px solid ${borderColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: DEFAULT_COLOR,
          }}
        />
      </div>
    </div>
  );
});

StateEndComponent.displayName = 'StateEnd';

// ============================================================
// StateFork — 分叉状态（实心矩形 ▬，宽扁黑色矩形）
// ============================================================

/** StateFork 节点组件 — 渲染分叉状态（实心宽扁矩形） */
export const StateForkComponent = memo(function StateForkComponent({
  selected,
}: NodeProps<StateForkFlowNode>) {
  const borderColor = selected ? SELECTED_COLOR : 'transparent';

  return (
    <div
      className="state-fork"
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {/* 左右方向 Handle */}
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />

      <div
        style={{
          width: 60,
          height: 6,
          background: DEFAULT_COLOR,
          border: selected ? `1px solid ${borderColor}` : 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
});

StateForkComponent.displayName = 'StateFork';

// ============================================================
// StateJoin — 汇合状态（实心矩形 ▬，同 fork 视觉）
// ============================================================

/** StateJoin 节点组件 — 渲染汇合状态（实心宽扁矩形，同 fork 视觉） */
export const StateJoinComponent = memo(function StateJoinComponent({
  selected,
}: NodeProps<StateJoinFlowNode>) {
  const borderColor = selected ? SELECTED_COLOR : 'transparent';

  return (
    <div
      className="state-join"
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {/* 左右方向 Handle */}
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />

      <div
        style={{
          width: 60,
          height: 6,
          background: DEFAULT_COLOR,
          border: selected ? `1px solid ${borderColor}` : 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
});

StateJoinComponent.displayName = 'StateJoin';

// ============================================================
// StateChoice — 选择状态（菱形 ◆）
// ============================================================

/** StateChoice 节点组件 — 渲染选择状态（菱形） */
export const StateChoiceComponent = memo(function StateChoiceComponent({
  selected,
}: NodeProps<StateChoiceFlowNode>) {
  const borderColor = selected ? SELECTED_COLOR : DEFAULT_COLOR;
  const borderWidth = selected ? '2px' : '1px';

  return (
    <div
      className="state-choice"
      style={{ position: 'relative', display: 'inline-block', width: 40, height: 40 }}
    >
      {/* 四方向 Handle */}
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="target" position={Position.Left} id="left" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="right" style={handleStyle} />

      <div
        style={{
          width: 40,
          height: 40,
          transform: 'rotate(45deg)',
          border: `${borderWidth} solid ${borderColor}`,
          background: '#fff',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
});

StateChoiceComponent.displayName = 'StateChoice';

// ============================================================
// StateDivider — 分隔线（水平线 ———，仅一条横线，无内容）
// ============================================================

/** StateDivider 节点组件 — 渲染分隔线（水平横线，无内容） */
export const StateDividerComponent = memo(function StateDividerComponent({
  selected,
}: NodeProps<StateDividerFlowNode>) {
  const lineColor = selected ? SELECTED_COLOR : DEFAULT_COLOR;

  return (
    <div
      className="state-divider"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: 120,
        height: 12,
      }}
    >
      {/* 左右方向 Handle */}
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />

      <div
        style={{
          width: '100%',
          height: 1,
          borderTop: `1px solid ${lineColor}`,
        }}
      />
    </div>
  );
});

StateDividerComponent.displayName = 'StateDivider';

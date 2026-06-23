/**
 * State 状态节点组件
 *
 * 单一职责：渲染 stateDiagram 的状态节点
 * 特殊状态：start/end 用实心圆，fork/join 用粗横线，choice 用菱形
 */
import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { MermaidNodeData } from '@mermaid2aichat/serializer';

type StateFlowNode = Node<MermaidNodeData, 'state-node'>;

const handleStyle = { width: 8, height: 8 };

/** State 状态节点组件 */
export const StateNode = memo(({ data, selected }: NodeProps<StateFlowNode>) => {
  const nodeKind = data.nodeKind ?? 'normal';
  const selectedBorder = selected ? '2px solid #1890ff' : '1px solid #333';

  switch (nodeKind) {
    case 'start':
      // 起始状态：实心圆
      return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <Handle type="target" position={Position.Top} style={handleStyle} />
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: '#333',
              border: selected ? '2px solid #1890ff' : 'none',
            }}
          />
          <Handle type="source" position={Position.Bottom} style={handleStyle} />
        </div>
      );
    case 'end':
      // 结束状态：双圆（外圈+内圈实心）
      return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <Handle type="target" position={Position.Top} style={handleStyle} />
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: selected ? '3px solid #1890ff' : '2px solid #333',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#333' }} />
          </div>
          <Handle type="source" position={Position.Bottom} style={handleStyle} />
        </div>
      );
    case 'fork':
    case 'join':
      // 分叉/汇合：粗横线
      return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <Handle type="target" position={Position.Left} style={handleStyle} />
          <div
            style={{
              width: 60,
              height: 6,
              background: '#333',
              border: selected ? '1px solid #1890ff' : 'none',
            }}
          />
          <Handle type="source" position={Position.Right} style={handleStyle} />
        </div>
      );
    case 'choice':
      // 选择：菱形
      return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <Handle type="target" position={Position.Top} style={handleStyle} />
          <div
            style={{
              width: 40,
              height: 40,
              transform: 'rotate(45deg)',
              border: selectedBorder,
              background: '#fff',
            }}
          />
          <Handle type="source" position={Position.Bottom} style={handleStyle} />
        </div>
      );
    default:
      // 普通状态：矩形
      return (
        <div
          style={{
            position: 'relative',
            display: 'inline-block',
            padding: '6px 12px',
            border: selectedBorder,
            borderRadius: 4,
            background: '#fff',
            fontSize: 14,
          }}
        >
          <Handle type="target" position={Position.Top} style={handleStyle} />
          {data.label}
          <Handle type="source" position={Position.Bottom} style={handleStyle} />
        </div>
      );
  }
});

StateNode.displayName = 'StateNode';

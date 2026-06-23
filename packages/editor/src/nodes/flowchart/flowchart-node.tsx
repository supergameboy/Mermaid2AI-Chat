/**
 * flowchart 节点统一组件
 *
 * 单一职责：根据 data.shape 分发到具体形状组件，管理 Handle 连接点
 *
 * 数据流:
 *   React Flow NodeProps → DirectionContext → Handle 位置
 *     → ShapeRenderer(data.shape) → SVG 形状 + 标签
 */

import { createContext, useContext, memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type {
  FlowchartDirection,
  MermaidShapeType,
  MermaidNodeData,
} from '@mermaid2aichat/serializer';
import { ShapeRenderer, handleStyle } from './shapes/shape-component.js';

// ============================================================
// 类型
// ============================================================

/** React Flow 节点类型，data 为 MermaidNodeData */
export type FlowchartFlowNode = Node<MermaidNodeData, MermaidShapeType>;

// ============================================================
// Context
// ============================================================

/** 连接模式：'direction' 按方向连接 | 'nearest' 就近连接 */
export type ConnectionMode = 'direction' | 'nearest';

/** 画布方向 Context — 由 Canvas 提供，节点组件消费，用于动态设置 Handle 位置 */
export const DirectionContext = createContext<FlowchartDirection>('TD');

/** 连接模式 Context — 由 Canvas 提供，节点组件消费，用于根据模式渲染 Handle */
export const ConnectionModeContext = createContext<ConnectionMode>('direction');

// ============================================================
// 辅助函数
// ============================================================

/** 根据 direction 计算 source/target Handle 位置（按方向连接模式） */
function getHandlePositions(direction: FlowchartDirection): {
  source: Position;
  target: Position;
} {
  switch (direction) {
    case 'TB':
    case 'TD':
      return { source: Position.Bottom, target: Position.Top };
    case 'BT':
      return { source: Position.Top, target: Position.Bottom };
    case 'LR':
      return { source: Position.Right, target: Position.Left };
    case 'RL':
      return { source: Position.Left, target: Position.Right };
  }
}

// ============================================================
// 节点组件
// ============================================================

/** flowchart 节点组件 — 根据形状渲染不同 SVG 形状 */
export const FlowchartNodeComponent = memo(function FlowchartNodeComponent({
  data,
  selected,
}: NodeProps<FlowchartFlowNode>) {
  // 从 Context 获取 direction 和 connectionMode
  const direction = useContext(DirectionContext);
  const connectionMode = useContext(ConnectionModeContext);

  // 按方向连接：Handle 位置由 direction 决定
  // 就近连接：Handle 位置用 Top/Bottom（floating edge 不依赖 Handle 位置，但用户手动拖拽需要 Handle）
  const { source: sourcePos, target: targetPos } =
    connectionMode === 'direction'
      ? getHandlePositions(direction)
      : { source: Position.Bottom, target: Position.Top };

  // 读取扩展字段
  const icon = readField<string>(data, 'icon');
  const img = readField<string>(data, 'img');

  return (
    <div
      className={`mermaid-node${selected ? ' selected' : ''}`}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <Handle type="target" position={targetPos} style={handleStyle} />
      <ShapeRenderer
        shape={data.shape}
        label={data.label}
        style={data.style}
        selected={selected}
        icon={icon}
        img={img}
      />
      <Handle type="source" position={sourcePos} style={handleStyle} />
    </div>
  );
});

FlowchartNodeComponent.displayName = 'FlowchartNode';

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

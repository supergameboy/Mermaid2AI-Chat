/**
 * Mindmap 节点组件 — 渲染 mindmap 的 7 种节点形状
 *
 * 单一职责：根据 mindmapType 渲染对应形状的节点视觉，管理 Handle 连接点
 *
 * 数据流:
 *   MermaidNode (type='mindmap-default' | 'mindmap-rect' | 'mindmap-rounded' | ...)
 *     → 对应形状组件
 *     → getShapeStyle(mindmapType, selected) 获取 CSS 样式
 *     → 渲染 label 文本 + 可选 icon/class 装饰
 *
 * 树形结构:
 *   - 使用 React Flow Parent Node 机制（parentId + extent: 'parent'）
 *   - edges 从 parentId 派生（不存储在 CanvasState.edges）
 *   - target Handle 在左侧（接收父节点的连接）
 *   - source Handle 在右侧（连接子节点）
 *
 * 节点类型（7 种，对齐 M6 设计文档决策 2）:
 *   - 'mindmap-default': MindmapDefaultComponent  — 无边框文本（仅底线）
 *   - 'mindmap-rect':    MindmapRectComponent     — 矩形
 *   - 'mindmap-rounded': MindmapRoundedComponent  — 圆角矩形
 *   - 'mindmap-circle':  MindmapCircleComponent   — 圆形
 *   - 'mindmap-cloud':   MindmapCloudComponent    — 云形
 *   - 'mindmap-bang':    MindmapBangComponent     — 爆炸形
 *   - 'mindmap-hexagon': MindmapHexagonComponent  — 六边形
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { MermaidNodeData, MindmapNodeType } from '@mermaid2aichat/serializer';
import { getShapeStyle } from './mindmap-shapes.js';

// ============================================================
// 类型
// ============================================================

export type MindmapDefaultFlowNode = Node<MermaidNodeData, 'mindmap-default'>;
export type MindmapRectFlowNode = Node<MermaidNodeData, 'mindmap-rect'>;
export type MindmapRoundedFlowNode = Node<MermaidNodeData, 'mindmap-rounded'>;
export type MindmapCircleFlowNode = Node<MermaidNodeData, 'mindmap-circle'>;
export type MindmapCloudFlowNode = Node<MermaidNodeData, 'mindmap-cloud'>;
export type MindmapBangFlowNode = Node<MermaidNodeData, 'mindmap-bang'>;
export type MindmapHexagonFlowNode = Node<MermaidNodeData, 'mindmap-hexagon'>;

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
// 通用 Mindmap 节点组件
// ============================================================

interface MindmapNodeBaseProps {
  data: MermaidNodeData;
  selected: boolean;
  mindmapType: MindmapNodeType;
}

/**
 * 通用 Mindmap 节点组件
 *
 * 根据 mindmapType 渲染对应形状，显示 label + 可选 icon/class 装饰。
 * target Handle 在左侧（接收父节点的连接），source Handle 在右侧（连接子节点）。
 */
function MindmapNodeBase({ data, selected, mindmapType }: MindmapNodeBaseProps) {
  const icon = readField<string>(data, 'mindmapIcon');
  const className = readField<string>(data, 'mindmapClass');
  const isRoot = readField<boolean>(data, 'isRoot');

  const shapeStyle = getShapeStyle(mindmapType, selected);
  const nodeClassName = [
    'mindmap-node',
    `mindmap-${mindmapType}`,
    isRoot ? 'mindmap-root' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={nodeClassName} style={shapeStyle}>
      {/* target Handle 在左侧（接收父节点的连接） */}
      <Handle type="target" position={Position.Left} style={handleStyle} />

      {/* 节点内容 */}
      <div className="mindmap-node-content">
        {icon && (
          <span className="mindmap-icon" style={{ marginRight: 6 }}>
            <small>{icon}</small>
          </span>
        )}
        <span className="mindmap-label">{data.label}</span>
      </div>

      {/* source Handle 在右侧（连接子节点） */}
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  );
}

// ============================================================
// 7 种节点组件
// ============================================================

/** MindmapDefault 节点组件 — 渲染默认形状（无边框，仅底线） */
export const MindmapDefaultComponent = memo(function MindmapDefaultComponent({
  data,
  selected,
}: NodeProps<MindmapDefaultFlowNode>) {
  return <MindmapNodeBase data={data} selected={selected} mindmapType="default" />;
});
MindmapDefaultComponent.displayName = 'MindmapDefault';

/** MindmapRect 节点组件 — 渲染矩形形状 */
export const MindmapRectComponent = memo(function MindmapRectComponent({
  data,
  selected,
}: NodeProps<MindmapRectFlowNode>) {
  return <MindmapNodeBase data={data} selected={selected} mindmapType="rect" />;
});
MindmapRectComponent.displayName = 'MindmapRect';

/** MindmapRounded 节点组件 — 渲染圆角矩形形状 */
export const MindmapRoundedComponent = memo(function MindmapRoundedComponent({
  data,
  selected,
}: NodeProps<MindmapRoundedFlowNode>) {
  return <MindmapNodeBase data={data} selected={selected} mindmapType="rounded" />;
});
MindmapRoundedComponent.displayName = 'MindmapRounded';

/** MindmapCircle 节点组件 — 渲染圆形形状 */
export const MindmapCircleComponent = memo(function MindmapCircleComponent({
  data,
  selected,
}: NodeProps<MindmapCircleFlowNode>) {
  return <MindmapNodeBase data={data} selected={selected} mindmapType="circle" />;
});
MindmapCircleComponent.displayName = 'MindmapCircle';

/** MindmapCloud 节点组件 — 渲染云形形状 */
export const MindmapCloudComponent = memo(function MindmapCloudComponent({
  data,
  selected,
}: NodeProps<MindmapCloudFlowNode>) {
  return <MindmapNodeBase data={data} selected={selected} mindmapType="cloud" />;
});
MindmapCloudComponent.displayName = 'MindmapCloud';

/** MindmapBang 节点组件 — 渲染爆炸形形状 */
export const MindmapBangComponent = memo(function MindmapBangComponent({
  data,
  selected,
}: NodeProps<MindmapBangFlowNode>) {
  return <MindmapNodeBase data={data} selected={selected} mindmapType="bang" />;
});
MindmapBangComponent.displayName = 'MindmapBang';

/** MindmapHexagon 节点组件 — 渲染六边形形状 */
export const MindmapHexagonComponent = memo(function MindmapHexagonComponent({
  data,
  selected,
}: NodeProps<MindmapHexagonFlowNode>) {
  return <MindmapNodeBase data={data} selected={selected} mindmapType="hexagon" />;
});
MindmapHexagonComponent.displayName = 'MindmapHexagon';

/**
 * Note 边组件 — 渲染 classDiagram 的注释连接边
 *
 * 单一职责：渲染 note 节点到 class 节点的虚线连接
 *
 * 数据流:
 *   MermaidEdge (type='note-edge') → NoteEdgeComponent
 *     → 虚线连接（无箭头）
 */

import { memo } from 'react';
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';

/** Note 边组件 — note 到 class 的虚线连接 */
export const NoteEdgeComponent = memo(function NoteEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: selected ? '#1890ff' : '#999',
        strokeWidth: 1.5,
        strokeDasharray: '4,4',
      }}
    />
  );
});

NoteEdgeComponent.displayName = 'NoteEdge';

/**
 * Class 关系边组件 — 渲染 classDiagram 的关系边
 *
 * 单一职责：根据 relationType 渲染对应线型和端点 marker，显示基数和关系标签
 *
 * 数据流:
 *   MermaidEdgeData.relationType → getClassRelationStyle → stroke/marker
 *   MermaidEdgeData.classCardinality → 基数标签（from/to）
 *   MermaidEdgeData.relationLabel → 关系标签
 *
 * 支持 7 种关系类型:
 *   - extension: <|-- 实线空心三角（继承）
 *   - realization: <|.. 虚线空心三角（实现）
 *   - composition: *-- 实线实心菱形（组合）
 *   - aggregation: o-- 实线空心菱形（聚合）
 *   - dependency: <.. 虚线箭头（依赖）
 *   - lollipop: --o 实线圆圈（棒棒糖）
 *   - association: --> 实线箭头（关联）
 *
 * Marker 定义位于 graph-canvas.tsx 的 <defs> 中
 */

import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import type { MermaidEdgeData, ClassRelationType } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

/** class 关系基数（class 专用，通过索引签名承载） */
interface ClassCardinality {
  from: string;
  to: string;
}

// ============================================================
// 关系类型 → 样式映射
// ============================================================

/** 映射 ClassRelationType 到边样式和 marker */
function getClassRelationStyle(relationType: ClassRelationType | undefined): {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  markerEnd?: string;
  markerStart?: string;
} {
  switch (relationType) {
    case 'extension':
      // 继承：<|-- 实线空心三角
      return { stroke: '#333', strokeWidth: 2, markerEnd: 'url(#mermaid-hollow-triangle-marker)' };
    case 'realization':
      // 实现：<|.. 虚线空心三角
      return { stroke: '#333', strokeWidth: 2, strokeDasharray: '5,5', markerEnd: 'url(#mermaid-hollow-triangle-marker)' };
    case 'composition':
      // 组合：*-- 实线实心菱形
      return { stroke: '#333', strokeWidth: 2, markerStart: 'url(#mermaid-filled-diamond-marker)' };
    case 'aggregation':
      // 聚合：o-- 实线空心菱形
      return { stroke: '#333', strokeWidth: 2, markerStart: 'url(#mermaid-hollow-diamond-marker)' };
    case 'dependency':
      // 依赖：<.. 虚线箭头
      return { stroke: '#333', strokeWidth: 2, strokeDasharray: '5,5', markerEnd: 'url(#mermaid-arrow-marker)' };
    case 'lollipop':
      // 棒棒糖：--o 实线圆圈
      return { stroke: '#333', strokeWidth: 2, markerEnd: 'url(#mermaid-circle-marker)' };
    case 'association':
      // 关联：--> 实线箭头
      return { stroke: '#333', strokeWidth: 2, markerEnd: 'url(#mermaid-arrow-marker)' };
    default:
      // 默认：关联
      return { stroke: '#333', strokeWidth: 2, markerEnd: 'url(#mermaid-arrow-marker)' };
  }
}

// ============================================================
// 辅助函数
// ============================================================

/** 安全读取 MermaidEdgeData 的扩展字段 */
function readField<T>(data: MermaidEdgeData | undefined, key: string): T | undefined {
  if (!data) return undefined;
  const value = (data as Record<string, unknown>)[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as T;
}

// ============================================================
// 边组件
// ============================================================

/** Class 关系边组件 */
export const ClassEdgeComponent = memo(function ClassEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const edgeData = data as MermaidEdgeData | undefined;
  const relationType = edgeData?.relationType as ClassRelationType | undefined;
  const style = getClassRelationStyle(relationType);

  const cardinality = readField<ClassCardinality>(edgeData, 'classCardinality');
  const relationLabel = edgeData?.relationLabel ?? edgeData?.label;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // 基数标签位置：from 在 source 端，to 在 target 端
  // 使用路径的 1/4 和 3/4 位置近似
  const fromLabelX = sourceX + (labelX - sourceX) * 0.5;
  const fromLabelY = sourceY + (labelY - sourceY) * 0.5;
  const toLabelX = targetX + (labelX - targetX) * 0.5;
  const toLabelY = targetY + (labelY - targetY) * 0.5;

  const labelBorderStyle = selected ? '#1890ff' : '#d9d9d9';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          ...(selected ? { stroke: '#1890ff', strokeWidth: style.strokeWidth + 1 } : {}),
        }}
        markerEnd={style.markerEnd}
        markerStart={style.markerStart}
      />

      {/* 基数标签 — from 端 */}
      {cardinality?.from && (
        <EdgeLabelRenderer>
          <div
            className="edge-cardinality-from"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${fromLabelX}px, ${fromLabelY}px)`,
              background: '#fff',
              padding: '1px 6px',
              borderRadius: 3,
              fontSize: 11,
              border: `1px solid ${labelBorderStyle}`,
              pointerEvents: 'all',
              fontFamily: 'monospace',
            }}
          >
            {cardinality.from}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* 基数标签 — to 端 */}
      {cardinality?.to && (
        <EdgeLabelRenderer>
          <div
            className="edge-cardinality-to"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${toLabelX}px, ${toLabelY}px)`,
              background: '#fff',
              padding: '1px 6px',
              borderRadius: 3,
              fontSize: 11,
              border: `1px solid ${labelBorderStyle}`,
              pointerEvents: 'all',
              fontFamily: 'monospace',
            }}
          >
            {cardinality.to}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* 关系标签 — 中间位置 */}
      {relationLabel && (
        <EdgeLabelRenderer>
          <div
            className="edge-relation-label"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: '#fff',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 12,
              border: `1px solid ${labelBorderStyle}`,
              pointerEvents: 'all',
            }}
          >
            {relationLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

ClassEdgeComponent.displayName = 'ClassEdge';

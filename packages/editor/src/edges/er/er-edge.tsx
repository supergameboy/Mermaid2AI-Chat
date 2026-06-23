/**
 * ER 关系边组件 — 渲染 erDiagram 的关系边
 *
 * 单一职责：根据 cardinality/erIdentification 渲染对应线型和基数标记，显示角色标签
 *
 * 数据流:
 *   MermaidEdgeData.cardinality → 基数符号（from/to）
 *   MermaidEdgeData.erIdentification → 线型（实线/虚线）
 *   MermaidEdgeData.erRole / label → 角色标签
 *
 * 支持 5 种基数类型:
 *   - zero-or-one:    |o 零或一
 *   - zero-or-more:   o{ 零或多
 *   - one-or-more:    |{ 一或多
 *   - only-one:       || 仅一
 *   - md-parent:      u 多对多父节点（仅 source 端）
 *
 * 支持 2 种关系类型:
 *   - identifying:      -- 实线（标识关系）
 *   - non-identifying:  .. 虚线（非标识关系）
 */

import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import type { MermaidEdgeData, ERCardinality, ERIdentification } from '@mermaid2aichat/serializer';

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

/** 映射 ER 基数到标记符号
 *
 * 注意：MD_PARENT 使用 'u' 符号（仅 source 端有效，对齐 jison u(?=[\.\-\|]) 语法）
 */
function cardinalityToSymbol(card: ERCardinality | undefined): string {
  switch (card) {
    case 'zero-or-one':
      return '|o';
    case 'zero-or-more':
      return 'o{';
    case 'one-or-more':
      return '|{';
    case 'only-one':
      return '||';
    case 'md-parent':
      return 'u';
    default:
      return '';
  }
}

/** 根据关系类型返回线型样式 */
function getIdentificationStyle(id: ERIdentification | undefined): { strokeDasharray?: string } {
  if (id === 'non-identifying') {
    return { strokeDasharray: '5,5' };
  }
  return {};
}

// ============================================================
// 边组件
// ============================================================

/** ER 关系边组件 */
export const ErEdgeComponent = memo(function ErEdgeComponent({
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
  const cardinality = edgeData?.cardinality;
  const identification = readField<ERIdentification>(edgeData, 'erIdentification');
  const roleLabel = readField<string>(edgeData, 'erRole') ?? edgeData?.label;

  const identStyle = getIdentificationStyle(identification);
  const stroke = selected ? '#1890ff' : '#333';
  const strokeWidth = selected ? 3 : 2;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // 基数标签位置：from 在 source 端（路径 1/4 处），to 在 target 端（路径 3/4 处）
  const fromLabelX = sourceX + (labelX - sourceX) * 0.5;
  const fromLabelY = sourceY + (labelY - sourceY) * 0.5;
  const toLabelX = targetX + (labelX - targetX) * 0.5;
  const toLabelY = targetY + (labelY - targetY) * 0.5;

  const labelBorderStyle = selected ? '#1890ff' : '#d9d9d9';
  const fromSymbol = cardinalityToSymbol(cardinality?.from);
  const toSymbol = cardinalityToSymbol(cardinality?.to);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke,
          strokeWidth,
          ...identStyle,
        }}
      />

      {/* 基数标签 — from 端 */}
      {fromSymbol && (
        <EdgeLabelRenderer>
          <div
            className="er-edge-cardinality-from"
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
            {fromSymbol}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* 基数标签 — to 端 */}
      {toSymbol && (
        <EdgeLabelRenderer>
          <div
            className="er-edge-cardinality-to"
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
            {toSymbol}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* 角色标签 — 边中间位置 */}
      {roleLabel && (
        <EdgeLabelRenderer>
          <div
            className="er-edge-role-label"
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
            {roleLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

ErEdgeComponent.displayName = 'ErEdge';

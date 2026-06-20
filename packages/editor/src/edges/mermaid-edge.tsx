/**
 * Mermaid 自定义边组件 — 支持8种边样式
 *
 * 端点 marker 由 edgeStyle 主动计算（覆盖外部传入值），
 * 确保 circle/cross/bidirectional 端点视觉正确。
 * 所有 marker 使用自定义 SVG defs，在 canvas.tsx 中注册。
 */
import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import type { MermaidEdgeStyle } from '@mermaid2aichat/serializer';
import { getEdgeMarkerConfig, toMarkerUrl } from './edge-markers.js';
import { FloatingEdgeComponent } from './floating-edge.js';

interface MermaidEdgeData {
  edgeStyle: MermaidEdgeStyle;
  label?: string;
}

export const EDGE_STYLE_MAP: Record<MermaidEdgeStyle, {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
}> = {
  arrow:          { stroke: '#333', strokeWidth: 2 },
  line:           { stroke: '#333', strokeWidth: 2 },
  dotted:         { stroke: '#333', strokeWidth: 2, strokeDasharray: '5,5' },
  'dotted-arrow': { stroke: '#333', strokeWidth: 2, strokeDasharray: '5,5' },
  thick:          { stroke: '#333', strokeWidth: 4 },
  circle:         { stroke: '#333', strokeWidth: 2 },
  cross:          { stroke: '#333', strokeWidth: 2 },
  bidirectional:  { stroke: '#333', strokeWidth: 2 },
};

export const MermaidEdgeComponent = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) => {
  const edgeData = data as MermaidEdgeData | undefined;
  const edgeStyle = edgeData?.edgeStyle ?? 'arrow';
  const style = EDGE_STYLE_MAP[edgeStyle];

  // 根据 edgeStyle 主动计算 marker，覆盖外部传入值
  const markerConfig = getEdgeMarkerConfig(edgeStyle);
  const resolvedMarkerEnd = toMarkerUrl(markerConfig.markerEndType);
  const resolvedMarkerStart = toMarkerUrl(markerConfig.markerStartType);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          ...(selected ? { stroke: '#1890ff', strokeWidth: (style.strokeWidth ?? 2) + 1 } : {}),
        }}
        markerEnd={resolvedMarkerEnd}
        markerStart={resolvedMarkerStart}
      />
      {edgeData?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: '#fff',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              border: '1px solid #d9d9d9',
              pointerEvents: 'all',
            }}
            className="edge-label"
          >
            {edgeData.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

MermaidEdgeComponent.displayName = 'MermaidEdge';

export const edgeTypes = {
  default: MermaidEdgeComponent,
  smoothstep: MermaidEdgeComponent,
  floating: FloatingEdgeComponent,
};

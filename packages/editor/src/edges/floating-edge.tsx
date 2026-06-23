/**
 * Floating Edge — 就近连接模式的自定义边组件
 *
 * 动态计算 source/target 节点之间最近的连接点，不绑定到固定 Handle。
 * 使用 useInternalNode 获取节点位置和尺寸，根据节点中心点相对位置选择最近方向。
 * 复用 flowchart/edge-markers 的样式逻辑（getEdgeStyleConfig、toMarkerUrl）。
 */
import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
  useInternalNode,
  type EdgeProps,
  type InternalNode,
} from '@xyflow/react';
import type { MermaidEdgeData, MermaidEdgeStyle } from '@mermaid2aichat/serializer';
import { getEdgeStyleConfig, toMarkerUrl } from './flowchart/edge-markers.js';

/** 计算节点的中心点（绝对坐标） */
function getNodeCenter(node: InternalNode): { x: number; y: number } {
  const position = node.internals.positionAbsolute;
  const width = node.measured.width ?? 0;
  const height = node.measured.height ?? 0;
  return {
    x: position.x + width / 2,
    y: position.y + height / 2,
  };
}

/**
 * 计算两个节点之间最近的连接点和方向
 *
 * 算法：根据两个节点中心点的 dx/dy 比例选择方向
 * - |dx| > |dy|：水平方向连接（Left/Right）
 * - |dx| <= |dy|：垂直方向连接（Top/Bottom）
 *
 * 返回 source/target 的坐标和方向（Position）
 */
function getEdgeParams(
  source: InternalNode,
  target: InternalNode
): {
  sx: number;
  sy: number;
  sourcePos: Position;
  tx: number;
  ty: number;
  targetPos: Position;
} {
  const sourceCenter = getNodeCenter(source);
  const targetCenter = getNodeCenter(target);
  const sourcePos = source.internals.positionAbsolute;
  const targetPos = target.internals.positionAbsolute;
  const sourceWidth = source.measured.width ?? 0;
  const sourceHeight = source.measured.height ?? 0;
  const targetWidth = target.measured.width ?? 0;
  const targetHeight = target.measured.height ?? 0;

  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    // 水平连接
    if (dx > 0) {
      // source 在左，target 在右
      return {
        sx: sourcePos.x + sourceWidth,
        sy: sourceCenter.y,
        sourcePos: Position.Right,
        tx: targetPos.x,
        ty: targetCenter.y,
        targetPos: Position.Left,
      };
    } else {
      // source 在右，target 在左
      return {
        sx: sourcePos.x,
        sy: sourceCenter.y,
        sourcePos: Position.Left,
        tx: targetPos.x + targetWidth,
        ty: targetCenter.y,
        targetPos: Position.Right,
      };
    }
  } else {
    // 垂直连接
    if (dy > 0) {
      // source 在上，target 在下
      return {
        sx: sourceCenter.x,
        sy: sourcePos.y + sourceHeight,
        sourcePos: Position.Bottom,
        tx: targetCenter.x,
        ty: targetPos.y,
        targetPos: Position.Top,
      };
    } else {
      // source 在下，target 在上
      return {
        sx: sourceCenter.x,
        sy: sourcePos.y,
        sourcePos: Position.Top,
        tx: targetCenter.x,
        ty: targetPos.y + targetHeight,
        targetPos: Position.Bottom,
      };
    }
  }
}

/** Floating Edge 自定义边组件 — 就近连接模式 */
export const FloatingEdgeComponent = memo(({
  id,
  source,
  target,
  data,
  selected,
}: EdgeProps) => {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  // 节点未挂载或未测量时，不渲染边（避免初始渲染异常）
  if (!sourceNode || !targetNode) return null;

  const edgeData = data as MermaidEdgeData | undefined;
  const edgeStyle: MermaidEdgeStyle = edgeData?.edgeStyle ?? 'arrow';
  const config = getEdgeStyleConfig(edgeStyle);

  // 不可见线 — 仅布局占位，不渲染视觉元素
  if (config.stroke === 'invisible') {
    return null;
  }

  // 线型样式
  const strokeColor = selected ? '#1890ff' : '#333333';
  const stroke = config.strokeDasharray
    ? { stroke: strokeColor, strokeWidth: config.strokeWidth, strokeDasharray: config.strokeDasharray }
    : { stroke: strokeColor, strokeWidth: config.strokeWidth };

  // 端点 marker
  const markerEnd = toMarkerUrl(config.markerEnd);
  const markerStart = toMarkerUrl(config.markerStart);

  const { sx, sy, sourcePos, tx, ty, targetPos } = getEdgeParams(sourceNode, targetNode);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetX: tx,
    targetY: ty,
    targetPosition: targetPos,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={stroke}
        markerEnd={markerEnd}
        markerStart={markerStart}
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
              border: `1px solid ${selected ? '#1890ff' : '#d9d9d9'}`,
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

FloatingEdgeComponent.displayName = 'FloatingEdge';

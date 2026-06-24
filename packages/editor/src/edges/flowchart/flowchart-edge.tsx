/**
 * flowchart 边组件 — 根据 MermaidEdgeStyle 渲染对应线型 + 端点 marker
 *
 * 单一职责：根据 edgeStyle 从 EDGE_STYLE_CONFIG 获取线型和 marker 配置，渲染 BaseEdge
 *
 * 数据流:
 *   MermaidEdgeData.edgeStyle → EDGE_STYLE_CONFIG → stroke/strokeWidth/dasharray + marker
 *   MermaidEdgeData.interpolate → 曲线类型 → React Flow path 生成函数
 *   MermaidEdgeData.animate → 边动画（dasharray 流动）
 *     → React Flow BaseEdge + EdgeLabelRenderer
 *
 * 支持的 16 种边样式（对齐 flow.jison link 规则 + destructLink 逻辑）:
 *   - 实线: line/arrow/cross/circle
 *   - 粗实线: thick-line/thick-arrow/thick-cross/thick-circle
 *   - 虚线: dotted/dotted-arrow/dotted-cross/dotted-circle
 *   - 双端: bidirectional-arrow/bidirectional-cross/bidirectional-circle
 *   - 特殊: invisible（不可见线，仅布局占位）
 *
 * 支持的 13 种曲线类型（对齐官方 edges.js interpolate）:
 *   basis/cardinal/step/stepAfter/stepBefore/monotoneX/monotoneY/natural/linear/bumpX/bumpY/catmullRom/rounded
 */
import { memo, useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  Position,
  useInternalNode,
  useReactFlow,
  type EdgeProps,
  type InternalNode,
} from '@xyflow/react';
import type { MermaidEdgeData, MermaidEdgeStyle } from '@mermaid2aichat/serializer';
import { getEdgeStyleConfig, toMarkerUrl } from './edge-markers.js';

// ============================================================
// 类型
// ============================================================

/** 曲线类型联合（对齐官方 13 种） */
export type EdgeCurveType =
  | 'basis'
  | 'cardinal'
  | 'step'
  | 'stepAfter'
  | 'stepBefore'
  | 'monotoneX'
  | 'monotoneY'
  | 'natural'
  | 'linear'
  | 'bumpX'
  | 'bumpY'
  | 'catmullRom'
  | 'rounded';

// ============================================================
// 常量
// ============================================================

const DEFAULT_STROKE_COLOR = '#333333';
const SELECTED_STROKE_COLOR = '#1890ff';
const DEFAULT_FONT_SIZE = 12;

// ============================================================
// 曲线类型 → React Flow path 生成函数映射
// ============================================================

/**
 * 根据曲线类型选择 React Flow path 生成函数
 *
 * 官方 Mermaid 使用 d3-shape 生成 13 种曲线，这里映射到 React Flow 内置的 3 种 path 生成函数:
 *   - getBezierPath: basis/cardinal/monotoneX/monotoneY/natural/bumpX/bumpY/catmullRom（曲线类）
 *   - getSmoothStepPath: step/stepAfter/stepBefore/rounded（阶梯类）
 *   - getStraightPath: linear（直线）
 */
function getCurvePath(
  curveType: string | undefined,
  params: {
    sourceX: number;
    sourceY: number;
    sourcePosition: Parameters<typeof getBezierPath>[0]['sourcePosition'];
    targetX: number;
    targetY: number;
    targetPosition: Parameters<typeof getBezierPath>[0]['targetPosition'];
  },
): [path: string, labelX: number, labelY: number, offsetX: number, offsetY: number] {
  switch (curveType) {
    // 阶梯类曲线
    case 'step':
    case 'stepAfter':
    case 'stepBefore':
    case 'rounded':
      return getSmoothStepPath(params);

    // 直线
    case 'linear':
      return getStraightPath(params);

    // 曲线类（默认用 Bezier 近似）
    case 'basis':
    case 'cardinal':
    case 'monotoneX':
    case 'monotoneY':
    case 'natural':
    case 'bumpX':
    case 'bumpY':
    case 'catmullRom':
    default:
      return getBezierPath(params);
  }
}

// ============================================================
// 边组件
// ============================================================

/**
 * flowchart 边组件
 *
 * 根据 edgeStyle 主动计算 marker 和线型，覆盖外部传入值，
 * 确保 16 种边样式视觉正确。
 * 根据 interpolate 选择曲线类型，支持 13 种曲线。
 * 根据 animate 添加边动画（dasharray 流动）。
 */
export const FlowchartEdgeComponent = memo(function FlowchartEdgeComponent({
  id,
  source,
  target,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const edgeData = data as MermaidEdgeData | undefined;
  const edgeStyle: MermaidEdgeStyle = edgeData?.edgeStyle ?? 'arrow';
  const config = getEdgeStyleConfig(edgeStyle);

  // 并行边偏移 — 避免多条边从同一源/到同一目标时形成8字形交叉
  // 注意：hook 必须在 early return 之前调用（Rules of Hooks）
  const { getEdges } = useReactFlow();
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  const {
    adjustedSourceX,
    adjustedSourceY,
    adjustedTargetX,
    adjustedTargetY,
    finalSourcePosition,
    finalTargetPosition,
  } = useMemo(() => {
    const allEdges = getEdges();

    // 优先使用布局阶段计算的几何正确连接方向（回路边）
    const layoutSourcePosition = readField<string>(edgeData, 'sourcePosition');
    const layoutTargetPosition = readField<string>(edgeData, 'targetPosition');
    const hasLayoutPosition = layoutSourcePosition !== undefined && layoutTargetPosition !== undefined;

    let effectiveSourcePosition: Position = sourcePosition;
    let effectiveTargetPosition: Position = targetPosition;
    let effectiveSourceX = sourceX;
    let effectiveSourceY = sourceY;
    let effectiveTargetX = targetX;
    let effectiveTargetY = targetY;

    if (hasLayoutPosition && sourceNode && targetNode) {
      // 使用布局阶段计算的方向，并重新计算对应边中心点坐标，确保 Position 与坐标一致
      effectiveSourcePosition = parsePosition(layoutSourcePosition);
      effectiveTargetPosition = parsePosition(layoutTargetPosition);
      const sourceConnection = getConnectionPoint(sourceNode, effectiveSourcePosition);
      const targetConnection = getConnectionPoint(targetNode, effectiveTargetPosition);
      effectiveSourceX = sourceConnection.x;
      effectiveSourceY = sourceConnection.y;
      effectiveTargetX = targetConnection.x;
      effectiveTargetY = targetConnection.y;
    } else {
      // 双向边检测：A→B 和 B→A 同时存在时，翻转 id 较大边的 Position
      // 但如果反向边已被布局阶段标记为回路边并指定侧面绕行方向，
      // 则当前正向边保持默认方向，避免与回路边形成 8 字交叉
      const reverseEdge = allEdges.find(e =>
        e.id !== id && e.source === target && e.target === source
      );
      const reverseHasLayoutPosition =
        reverseEdge !== undefined &&
        readField<string>(reverseEdge.data, 'sourcePosition') !== undefined &&
        readField<string>(reverseEdge.data, 'targetPosition') !== undefined;
      if (reverseEdge && !reverseHasLayoutPosition && id > reverseEdge.id) {
        effectiveSourcePosition = flipPosition(sourcePosition);
        effectiveTargetPosition = flipPosition(targetPosition);
      }
    }

    // 同源边：共享相同 source 的边，按 (target, id) 排序确保确定性
    const sameSourceEdges = allEdges
      .filter(e => e.source === source)
      .sort((a, b) => a.target.localeCompare(b.target) || a.id.localeCompare(b.id));

    // 同目标边：共享相同 target 的边，按 (source, id) 排序确保确定性
    const sameTargetEdges = allEdges
      .filter(e => e.target === target)
      .sort((a, b) => a.source.localeCompare(b.source) || a.id.localeCompare(b.id));

    const PARALLEL_EDGE_SPACING = 20;

    // 源端偏移：在同源边中的对称偏移
    let sourceOffset = 0;
    if (sameSourceEdges.length > 1) {
      const idx = sameSourceEdges.findIndex(e => e.id === id);
      if (idx !== -1) {
        sourceOffset = (idx - (sameSourceEdges.length - 1) / 2) * PARALLEL_EDGE_SPACING;
      }
    }

    // 目标端偏移：在同目标边中的对称偏移
    let targetOffset = 0;
    if (sameTargetEdges.length > 1) {
      const idx = sameTargetEdges.findIndex(e => e.id === id);
      if (idx !== -1) {
        targetOffset = (idx - (sameTargetEdges.length - 1) / 2) * PARALLEL_EDGE_SPACING;
      }
    }

    // 根据真实连接方向应用偏移
    const isVerticalSource = effectiveSourcePosition === Position.Top || effectiveSourcePosition === Position.Bottom;
    const isVerticalTarget = effectiveTargetPosition === Position.Top || effectiveTargetPosition === Position.Bottom;

    return {
      adjustedSourceX: isVerticalSource ? effectiveSourceX + sourceOffset : effectiveSourceX,
      adjustedSourceY: isVerticalSource ? effectiveSourceY : effectiveSourceY + sourceOffset,
      adjustedTargetX: isVerticalTarget ? effectiveTargetX + targetOffset : effectiveTargetX,
      adjustedTargetY: isVerticalTarget ? effectiveTargetY : effectiveTargetY + targetOffset,
      finalSourcePosition: effectiveSourcePosition,
      finalTargetPosition: effectiveTargetPosition,
    };
  }, [
    getEdges,
    source,
    target,
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    edgeData?.sourcePosition,
    edgeData?.targetPosition,
    sourceNode,
    targetNode,
  ]);

  // 不可见线 — 仅布局占位，不渲染视觉元素
  if (config.stroke === 'invisible') {
    return null;
  }

  // 线型样式
  // Bug5: 优先使用 linkStyle 中定义的 stroke / stroke-width / stroke-dasharray
  const linkStyles = readField<string[]>(edgeData, 'styles');
  const parsedLinkStyle = parseLinkStyle(linkStyles);
  const strokeColor = selected
    ? SELECTED_STROKE_COLOR
    : (parsedLinkStyle.stroke ?? DEFAULT_STROKE_COLOR);
  const interpolate = readField<string>(edgeData, 'interpolate');
  const animate = readField<boolean>(edgeData, 'animate');

  const style: React.CSSProperties = {
    stroke: strokeColor,
    strokeWidth: parsedLinkStyle.strokeWidth ?? config.strokeWidth,
  };

  if (parsedLinkStyle.strokeDasharray || config.strokeDasharray) {
    style.strokeDasharray = parsedLinkStyle.strokeDasharray || config.strokeDasharray;
  }

  // 边动画（dasharray 流动）
  if (animate) {
    style.animation = 'dashdraw 0.5s linear infinite';
    if (!style.strokeDasharray) {
      style.strokeDasharray = '5,5';
    }
  }

  // 端点 marker
  const markerEnd = toMarkerUrl(config.markerEnd);
  const markerStart = toMarkerUrl(config.markerStart);

  // 路径（根据 interpolate 选择曲线类型，使用布局阶段计算的正确 Position）
  const [edgePath, labelX, labelY] = getCurvePath(interpolate, {
    sourceX: adjustedSourceX,
    sourceY: adjustedSourceY,
    sourcePosition: finalSourcePosition,
    targetX: adjustedTargetX,
    targetY: adjustedTargetY,
    targetPosition: finalTargetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
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
              fontSize: `${DEFAULT_FONT_SIZE}px`,
              border: `1px solid ${selected ? SELECTED_STROKE_COLOR : '#d9d9d9'}`,
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

// ============================================================
// 边类型注册
// ============================================================

/** flowchart 边类型注册表 */
export const flowchartEdgeTypes = {
  default: FlowchartEdgeComponent,
  smoothstep: FlowchartEdgeComponent,
};

// ============================================================
// 辅助函数
// ============================================================

/** 翻转连接点方向 — 用于双向边避免8字形交叉 */
function flipPosition(pos: Position): Position {
  switch (pos) {
    case Position.Top: return Position.Bottom;
    case Position.Bottom: return Position.Top;
    case Position.Left: return Position.Right;
    case Position.Right: return Position.Left;
  }
}

/** 将字符串连接方向解析为 React Flow Position 枚举 */
function parsePosition(pos: string): Position {
  switch (pos) {
    case 'top': return Position.Top;
    case 'bottom': return Position.Bottom;
    case 'left': return Position.Left;
    case 'right': return Position.Right;
    default: return Position.Bottom;
  }
}

/**
 * 根据节点和连接方向计算边中心点坐标
 *
 * 与 React Flow 默认连接点计算一致：
 * - Top: 顶边中点
 * - Bottom: 底边中点
 * - Left: 左边中点
 * - Right: 右边中点
 */
function getConnectionPoint(
  node: InternalNode,
  position: Position,
): { x: number; y: number } {
  const nodeX = node.internals.positionAbsolute.x;
  const nodeY = node.internals.positionAbsolute.y;
  const width = node.measured.width ?? 0;
  const height = node.measured.height ?? 0;

  switch (position) {
    case Position.Top:
      return { x: nodeX + width / 2, y: nodeY };
    case Position.Bottom:
      return { x: nodeX + width / 2, y: nodeY + height };
    case Position.Left:
      return { x: nodeX, y: nodeY + height / 2 };
    case Position.Right:
      return { x: nodeX + width, y: nodeY + height / 2 };
  }
}

/** 安全读取扩展字段 */
function readField<T>(data: Record<string, unknown> | undefined, key: string): T | undefined {
  if (!data) return undefined;
  const value = data[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as T;
}

/** 解析 linkStyle 字符串数组，提取 stroke / stroke-width / stroke-dasharray */
function parseLinkStyle(styles: string[] | undefined): {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
} {
  if (!styles || styles.length === 0) return {};
  const result: { stroke?: string; strokeWidth?: number; strokeDasharray?: string } = {};
  for (const s of styles) {
    const colonIndex = s.indexOf(':');
    if (colonIndex === -1) continue;
    const key = s.substring(0, colonIndex).trim();
    const value = s.substring(colonIndex + 1).trim();
    switch (key) {
      case 'stroke':
        result.stroke = value;
        break;
      case 'stroke-width':
      case 'strokeWidth': {
        const num = Number(value);
        if (Number.isFinite(num)) {
          result.strokeWidth = num;
        } else {
          const loose = Number(value.replace(/[^0-9.]/g, ''));
          if (Number.isFinite(loose)) {
            result.strokeWidth = loose;
          }
        }
        break;
      }
      case 'stroke-dasharray':
        result.strokeDasharray = value;
        break;
    }
  }
  return result;
}

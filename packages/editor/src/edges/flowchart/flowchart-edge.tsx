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
import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
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

  // 不可见线 — 仅布局占位，不渲染视觉元素
  if (config.stroke === 'invisible') {
    return null;
  }

  // 线型样式
  const strokeColor = selected ? SELECTED_STROKE_COLOR : DEFAULT_STROKE_COLOR;
  const interpolate = readField<string>(edgeData, 'interpolate');
  const animate = readField<boolean>(edgeData, 'animate');

  const style: React.CSSProperties = {
    stroke: strokeColor,
    strokeWidth: config.strokeWidth,
  };

  if (config.strokeDasharray) {
    style.strokeDasharray = config.strokeDasharray;
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

  // 路径（根据 interpolate 选择曲线类型）
  const [edgePath, labelX, labelY] = getCurvePath(interpolate, {
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

/** 安全读取扩展字段 */
function readField<T>(data: Record<string, unknown> | undefined, key: string): T | undefined {
  if (!data) return undefined;
  const value = data[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as T;
}

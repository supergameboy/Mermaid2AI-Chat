/**
 * SliceArc — 饼图切片扇形组件
 *
 * 单一职责：渲染单个饼图切片的 SVG path，支持 hover 高亮和点击/右键交互
 *
 * 数据流:
 *   props (slice/angles/color) → SVG path + 文本标签 → 用户交互回调
 */

import type { MouseEvent } from 'react';
import type { PieSlice } from '@mermaid2aichat/serializer';
import {
  describePieSlice,
  pieSliceMidAngle,
  polarToCartesian,
} from '../specialized/shared/chart-layout.js';

/** SliceArc 组件 Props */
export interface SliceArcProps {
  /** 切片数据 */
  slice: PieSlice;
  /** 起始角度（度，0=12点钟方向，顺时针） */
  startAngle: number;
  /** 结束角度（度） */
  endAngle: number;
  /** 饼图半径 */
  radius: number;
  /** 圆心 X 坐标 */
  centerX: number;
  /** 圆心 Y 坐标 */
  centerY: number;
  /** 切片颜色 */
  color: string;
  /** 是否高亮（hover 或选中） */
  isHighlighted: boolean;
  /** 点击回调 */
  onClick: () => void;
  /** 右键菜单回调 */
  onContextMenu?: (e: MouseEvent) => void;
  /** 是否显示数值（showData） */
  showData: boolean;
  /** 切片总值（用于百分比计算） */
  total: number;
}

/** 标签半径偏移量（相对于半径） */
const LABEL_RADIUS_FACTOR = 0.6;

export function SliceArc(props: SliceArcProps) {
  const {
    slice,
    startAngle,
    endAngle,
    radius,
    centerX,
    centerY,
    color,
    isHighlighted,
    onClick,
    onContextMenu,
    showData,
    total,
  } = props;

  const path = describePieSlice(centerX, centerY, radius, startAngle, endAngle);
  const midAngle = pieSliceMidAngle(startAngle, endAngle);
  const labelRadius = radius * LABEL_RADIUS_FACTOR;
  const labelPos = polarToCartesian(centerX, centerY, labelRadius, midAngle);

  // 高亮时向外偏移的效果（通过 transform 实现）
  const highlightOffset = isHighlighted ? 8 : 0;
  const highlightTransform = highlightOffset > 0
    ? `translate(${Math.cos((midAngle - 90) * Math.PI / 180) * highlightOffset} ${Math.sin((midAngle - 90) * Math.PI / 180) * highlightOffset})`
    : undefined;

  const percentage = total > 0 ? ((slice.value / total) * 100).toFixed(1) : '0.0';

  return (
    <g
      transform={highlightTransform}
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
    >
      <path
        d={path}
        fill={color}
        stroke="#fff"
        strokeWidth={isHighlighted ? 3 : 2}
        opacity={isHighlighted ? 1 : 0.9}
      />
      {showData && (
        <text
          x={labelPos.x}
          y={labelPos.y}
          fontSize={12}
          fill="#fff"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ pointerEvents: 'none', fontWeight: 600 }}
        >
          {slice.value} ({percentage}%)
        </text>
      )}
    </g>
  );
}

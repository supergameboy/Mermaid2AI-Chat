/**
 * ActivationBar — 时序图激活条（生命线上的实心矩形）
 *
 * 单一职责：在生命线上渲染激活条，表示参与者在某段时间内处于活动状态
 */
import { memo } from 'react';
import { ACTIVATION_BAR_WIDTH, ACTIVATION_BAR_HEIGHT } from './layout-constants.js';

interface ActivationBarProps {
  /** 参与者中心 X 坐标 */
  x: number;
  /** 激活条顶部 Y 坐标 */
  y: number;
  /** 激活条高度（覆盖的消息行数 × 行高），默认单行 */
  height?: number;
  /** 是否被选中 */
  selected?: boolean;
}

/** 激活条组件 */
export const ActivationBar = memo(function ActivationBar({
  x,
  y,
  height = ACTIVATION_BAR_HEIGHT,
  selected,
}: ActivationBarProps) {
  const fill = selected ? '#1890ff' : '#e6f7ff';
  const stroke = selected ? '#1890ff' : '#1890ff';

  return (
    <rect
      x={x - ACTIVATION_BAR_WIDTH / 2}
      y={y}
      width={ACTIVATION_BAR_WIDTH}
      height={height}
      fill={fill}
      stroke={stroke}
      strokeWidth={1}
      rx={2}
    />
  );
});

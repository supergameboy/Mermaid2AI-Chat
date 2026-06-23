/**
 * Lifeline — 时序图参与者生命线（虚线）
 *
 * 单一职责：渲染参与者下方的虚线，从参与者底部延伸到最后一条消息
 */
import { memo } from 'react';
import {
  PARTICIPANT_BOTTOM_Y,
  LIFELINE_BOTTOM_PADDING,
} from './layout-constants.js';

interface LifelineProps {
  /** 参与者中心 X 坐标 */
  x: number;
  /** 最后一条消息的 Y 坐标（生命线终点） */
  lastMessageY: number;
  /** 是否被选中 */
  selected?: boolean;
}

/** 生命线组件 */
export const Lifeline = memo(function Lifeline({ x, lastMessageY, selected }: LifelineProps) {
  const y1 = PARTICIPANT_BOTTOM_Y;
  const y2 = Math.max(lastMessageY + LIFELINE_BOTTOM_PADDING, y1 + 40);
  const stroke = selected ? '#1890ff' : '#999';

  return (
    <line
      x1={x}
      y1={y1}
      x2={x}
      y2={y2}
      stroke={stroke}
      strokeWidth={1.5}
      strokeDasharray="6,4"
      pointerEvents="none"
    />
  );
});

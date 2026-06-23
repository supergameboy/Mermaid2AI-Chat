/**
 * BlockFrame — 时序图块结构框（alt/opt/loop/par/critical/break/rect）
 *
 * 单一职责：在消息组周围渲染彩色矩形框，含左上角标签
 * 支持嵌套块（通过 depth 控制缩进和颜色深浅）
 */
import { memo } from 'react';
import type { SequenceBlockType } from '@mermaid2aichat/serializer';
import {
  BLOCK_LABEL_HEIGHT,
  BLOCK_PADDING,
  getMessageY,
} from './layout-constants.js';

interface BlockFrameProps {
  /** 块类型 */
  type: SequenceBlockType;
  /** 块标签（如 alt 的条件描述） */
  label?: string;
  /** 起始消息 sequence */
  startMessage: number;
  /** 结束消息 sequence（不含），undefined 表示到最后 */
  endMessage?: number;
  /** 最后一条消息的 sequence（用于计算 endMessage 缺省时的下界） */
  lastSequence: number;
  /** 块左边界 X 坐标 */
  leftX: number;
  /** 块右边界 X 坐标 */
  rightX: number;
  /** 嵌套深度（0=顶层） */
  depth: number;
  /** 是否被选中 */
  selected: boolean;
  /** 块在 blocks 数组中的索引（用于选中和编辑回调） */
  blockIndex: number;
  /** 点击选中回调 */
  onSelect: (blockIndex: number) => void;
}

/** 块类型 → 颜色映射 */
const BLOCK_COLORS: Record<SequenceBlockType, { fill: string; stroke: string; label: string }> = {
  alt:      { fill: 'rgba(24, 144, 255, 0.06)', stroke: '#1890ff', label: 'alt' },
  opt:      { fill: 'rgba(82, 196, 26, 0.06)',  stroke: '#52c41a', label: 'opt' },
  loop:     { fill: 'rgba(250, 173, 20, 0.06)', stroke: '#faad14', label: 'loop' },
  par:      { fill: 'rgba(114, 46, 209, 0.06)', stroke: '#722ed1', label: 'par' },
  'par-over': { fill: 'rgba(114, 46, 209, 0.06)', stroke: '#722ed1', label: 'par_over' },
  critical: { fill: 'rgba(245, 34, 45, 0.06)',  stroke: '#f5222d', label: 'critical' },
  break:    { fill: 'rgba(245, 34, 45, 0.06)',  stroke: '#f5222d', label: 'break' },
  rect:     { fill: 'rgba(19, 194, 194, 0.06)', stroke: '#13c2c2', label: 'rect' },
  autonumber: { fill: 'rgba(0, 0, 0, 0.04)',   stroke: '#999',    label: 'autonumber' },
};

/** 块结构框组件 */
export const BlockFrame = memo(function BlockFrame({
  type,
  label,
  startMessage,
  endMessage,
  lastSequence,
  leftX,
  rightX,
  depth,
  selected,
  blockIndex,
  onSelect,
}: BlockFrameProps) {
  const color = BLOCK_COLORS[type] ?? BLOCK_COLORS.alt;
  const yTop = getMessageY(startMessage) - BLOCK_PADDING - BLOCK_LABEL_HEIGHT;
  const endSeq = endMessage !== undefined ? endMessage : lastSequence + 1;
  const yBottom = getMessageY(endSeq) - BLOCK_PADDING;
  const height = yBottom - yTop;
  const width = rightX - leftX;

  // 嵌套缩进
  const indent = depth * 6;
  const x = leftX - indent;
  const w = width + indent * 2;

  const displayLabel = label ? `${color.label}: ${label}` : color.label;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(blockIndex);
  };

  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={handleClick}
    >
      <rect
        x={x}
        y={yTop}
        width={w}
        height={height}
        fill={color.fill}
        stroke={selected ? '#1890ff' : color.stroke}
        strokeWidth={selected ? 2 : 1}
        rx={2}
        ry={2}
      />
      {/* 左上角标签条 */}
      <rect
        x={x}
        y={yTop}
        width={Math.max(displayLabel.length * 7 + 16, 60)}
        height={BLOCK_LABEL_HEIGHT}
        fill={color.stroke}
        rx={2}
        ry={2}
      />
      <text
        x={x + 8}
        y={yTop + BLOCK_LABEL_HEIGHT / 2}
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
        fill="#fff"
      >
        {displayLabel}
      </text>
    </g>
  );
});

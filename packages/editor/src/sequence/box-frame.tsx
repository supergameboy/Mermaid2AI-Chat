/**
 * BoxFrame — 时序图 Box 分组框（围绕一组参与者）
 *
 * 单一职责：在参与者组周围渲染带名称和背景色的矩形框
 * 位置由父组件根据参与者实际索引计算后传入
 */
import { memo } from 'react';
import type { SequenceBoxInfo } from '@mermaid2aichat/serializer';
import {
  PARTICIPANT_TOP_Y,
  PARTICIPANT_HEIGHT,
  BOX_LABEL_HEIGHT,
  BOX_PADDING,
} from './layout-constants.js';

interface BoxFrameProps {
  /** Box 信息 */
  box: SequenceBoxInfo;
  /** Box 在 sequenceBoxes 数组中的索引（用于选中和编辑回调） */
  boxIndex: number;
  /** 框左边界 X 坐标（最左参与者的左边界 - padding） */
  leftX: number;
  /** 框右边界 X 坐标（最右参与者的右边界 + padding） */
  rightX: number;
  /** 最后一条消息的 Y 坐标（用于计算框底部） */
  lastMessageY: number;
  /** 是否被选中 */
  selected: boolean;
  /** 点击选中回调 */
  onSelect: (boxIndex: number) => void;
}

/** Box 框组件 */
export const BoxFrame = memo(function BoxFrame({
  box,
  boxIndex,
  leftX,
  rightX,
  lastMessageY,
  selected,
  onSelect,
}: BoxFrameProps) {
  const topY = PARTICIPANT_TOP_Y - BOX_LABEL_HEIGHT - BOX_PADDING;
  const bottomY = Math.max(lastMessageY + 20, PARTICIPANT_TOP_Y + PARTICIPANT_HEIGHT + 40);
  const width = rightX - leftX;
  const height = bottomY - topY;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(boxIndex);
  };

  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={handleClick}
    >
      <rect
        x={leftX}
        y={topY}
        width={width}
        height={height}
        fill={box.color || 'rgba(24, 144, 255, 0.05)'}
        stroke={selected ? '#1890ff' : '#999'}
        strokeWidth={selected ? 2 : 1}
        strokeDasharray="4,2"
        rx={4}
        ry={4}
      />
      {/* 顶部标签条 */}
      <rect
        x={leftX}
        y={topY}
        width={Math.max(box.name.length * 8 + 16, 50)}
        height={BOX_LABEL_HEIGHT}
        fill={box.color || '#1890ff'}
        rx={2}
        ry={2}
      />
      <text
        x={leftX + 8}
        y={topY + BOX_LABEL_HEIGHT / 2}
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
        fill="#fff"
      >
        {box.name}
      </text>
    </g>
  );
});

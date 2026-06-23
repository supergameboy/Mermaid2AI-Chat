/**
 * NoteRow — 时序图注释（Note left of / right of / over）
 *
 * 单一职责：在指定参与者的生命线左/右/上方渲染黄色注释框
 */
import { memo } from 'react';
import type { SequenceNoteInfo } from '@mermaid2aichat/serializer';
import {
  NOTE_WIDTH,
  NOTE_HEIGHT,
  getMessageY,
} from './layout-constants.js';

interface NoteRowProps {
  /** 注释信息 */
  note: SequenceNoteInfo;
  /** 注释在 notes 数组中的索引（用于选中和编辑回调） */
  noteIndex: number;
  /** 关联参与者中心 X 坐标 */
  participantX: number;
  /** 第二个关联参与者中心 X 坐标（position='over' 且跨两个参与者时使用） */
  overParticipantX?: number;
  /** 是否被选中 */
  selected: boolean;
  /** 点击选中回调（传递 noteIndex） */
  onSelect: (noteIndex: number) => void;
}

/** 注释组件 */
export const NoteRow = memo(function NoteRow({
  note,
  noteIndex,
  participantX,
  overParticipantX,
  selected,
  onSelect,
}: NoteRowProps) {
  const y = getMessageY(note.messageIndex) - NOTE_HEIGHT / 2;

  // 计算 X 坐标：left/right 在参与者侧，over 在参与者上方居中
  let noteX: number;
  if (note.position === 'left') {
    noteX = participantX - NOTE_WIDTH - 8;
  } else if (note.position === 'right') {
    noteX = participantX + 8;
  } else {
    // over：单参与者居中，双参与者跨中点
    const centerX = overParticipantX !== undefined
      ? (participantX + overParticipantX) / 2
      : participantX;
    noteX = centerX - NOTE_WIDTH / 2;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(noteIndex);
  };

  return (
    <g
      transform={`translate(${noteX}, ${y})`}
      style={{ cursor: 'pointer' }}
      onClick={handleClick}
    >
      <rect
        x={0}
        y={0}
        width={NOTE_WIDTH}
        height={NOTE_HEIGHT}
        rx={2}
        ry={2}
        fill="#fffbe6"
        stroke={selected ? '#1890ff' : '#faad14'}
        strokeWidth={selected ? 2 : 1}
      />
      {/* 折角效果 */}
      <path
        d={`M ${NOTE_WIDTH - 8} 0 L ${NOTE_WIDTH} 8 L ${NOTE_WIDTH - 8} 8 Z`}
        fill="#ffe58f"
        stroke={selected ? '#1890ff' : '#faad14'}
        strokeWidth={1}
      />
      <text
        x={NOTE_WIDTH / 2}
        y={NOTE_HEIGHT / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fill="#333"
      >
        {truncateLabel(note.label, 12)}
      </text>
    </g>
  );
});

/** 截断过长标签 */
function truncateLabel(label: string, maxLen: number): string {
  if (label.length <= maxLen) return label;
  return label.slice(0, maxLen - 1) + '…';
}

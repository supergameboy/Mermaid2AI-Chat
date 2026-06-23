/**
 * ParticipantRow — 时序图参与者行（顶部参与者框）
 *
 * 单一职责：渲染单个参与者框，包含图标和名称，支持点击选中和双击编辑
 */
import { memo } from 'react';
import type { MermaidNode } from '@mermaid2aichat/serializer';
import {
  PARTICIPANT_TOP_Y,
  PARTICIPANT_HEIGHT,
  PARTICIPANT_WIDTH,
} from './layout-constants.js';

interface ParticipantRowProps {
  /** 参与者节点数据 */
  participant: MermaidNode;
  /** 参与者中心 X 坐标 */
  x: number;
  /** 是否被选中 */
  selected: boolean;
  /** 点击选中回调 */
  onSelect: (id: string) => void;
  /** 双击编辑回调 */
  onEdit: (id: string) => void;
}

/** 参与者类型 → 图标映射 */
const PARTICIPANT_ICONS: Record<string, string> = {
  actor: '👤',
  participant: '📦',
};

/** 参与者框组件 */
export const ParticipantRow = memo(function ParticipantRow({
  participant,
  x,
  selected,
  onSelect,
  onEdit,
}: ParticipantRowProps) {
  const icon = PARTICIPANT_ICONS[participant.data.participantType ?? 'participant'] ?? '📦';
  const left = x - PARTICIPANT_WIDTH / 2;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(participant.id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(participant.id);
  };

  return (
    <g
      transform={`translate(${left}, ${PARTICIPANT_TOP_Y})`}
      style={{ cursor: 'pointer' }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <rect
        x={0}
        y={0}
        width={PARTICIPANT_WIDTH}
        height={PARTICIPANT_HEIGHT}
        rx={4}
        ry={4}
        fill={selected ? '#e6f7ff' : '#fff'}
        stroke={selected ? '#1890ff' : '#333'}
        strokeWidth={selected ? 2 : 1}
      />
      <text
        x={PARTICIPANT_WIDTH / 2}
        y={PARTICIPANT_HEIGHT / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={14}
        fontWeight={600}
        fill="#333"
      >
        <tspan dx={-8}>{icon}</tspan>
        <tspan dx={4}>{participant.data.label}</tspan>
      </text>
    </g>
  );
});

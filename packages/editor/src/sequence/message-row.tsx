/**
 * MessageRow — 时序图消息行（参与者之间的箭头）
 *
 * 单一职责：渲染单条消息箭头，含线型、箭头头、标签、激活指示
 */
import { memo } from 'react';
import type { MermaidEdge, SequenceArrowType } from '@mermaid2aichat/serializer';

interface MessageRowProps {
  /** 消息边数据 */
  message: MermaidEdge;
  /** 起始参与者中心 X 坐标 */
  sourceX: number;
  /** 目标参与者中心 X 坐标 */
  targetX: number;
  /** 消息 Y 坐标 */
  y: number;
  /** 是否被选中 */
  selected: boolean;
  /** 是否显示序号（autonumber） */
  showSequenceNumber: boolean;
  /** 点击选中回调 */
  onSelect: (id: string) => void;
  /** 双击编辑回调 */
  onEdit: (id: string) => void;
}

/** 根据 SequenceArrowType 推导线型 */
function getLineStyle(messageType: SequenceArrowType): {
  strokeDasharray: string;
  strokeWidth: number;
} {
  // 含 'dotted' 关键字的为虚线
  if (messageType.includes('dotted')) {
    return { strokeDasharray: '5,4', strokeWidth: 1.5 };
  }
  return { strokeDasharray: 'none', strokeWidth: 1.5 };
}

/** 根据 SequenceArrowType 推导箭头头 marker id */
function getArrowMarkerId(messageType: SequenceArrowType): string | undefined {
  // 双向箭头使用双向 marker
  if (messageType === 'bidirectional-solid' || messageType === 'bidirectional-dotted') {
    return 'seq-arrow-bidirectional';
  }
  // 十字
  if (messageType === 'solid-cross' || messageType === 'dotted-cross') {
    return 'seq-arrow-cross';
  }
  // 圆点
  if (messageType === 'solid-point' || messageType === 'dotted-point') {
    return 'seq-arrow-point';
  }
  // 开放箭头
  if (messageType === 'solid-open' || messageType === 'dotted-open') {
    return 'seq-arrow-open';
  }
  // 默认实心三角
  return 'seq-arrow-filled';
}

/** 消息行组件 */
export const MessageRow = memo(function MessageRow({
  message,
  sourceX,
  targetX,
  y,
  selected,
  showSequenceNumber,
  onSelect,
  onEdit,
}: MessageRowProps) {
  const messageType: SequenceArrowType = message.data.messageType ?? 'solid-arrow';
  const lineStyle = getLineStyle(messageType);
  const markerId = getArrowMarkerId(messageType);
  const stroke = selected ? '#1890ff' : '#333';

  // 处理自调用（source === target）：绘制半圆
  const isSelfCall = sourceX === targetX;
  const label = message.data.label ?? '';
  const sequence = typeof message.data.sequence === 'number' ? message.data.sequence : 0;
  const activate = message.data.activate === true;
  const deactivate = message.data.deactivate === true;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(message.id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(message.id);
  };

  // 标签位置：箭头中点上方
  const labelX = (sourceX + targetX) / 2;
  const labelY = y - 8;

  // 激活/停用后缀
  const suffix = activate ? ' +' : deactivate ? ' -' : '';
  const displayLabel = label + suffix;
  const sequenceLabel = showSequenceNumber ? `${sequence + 1}. ` : '';

  if (isSelfCall) {
    // 自调用：绘制半圆路径
    const radius = 20;
    const path = `M ${sourceX} ${y} C ${sourceX + radius * 2} ${y - radius}, ${sourceX + radius * 2} ${y + radius}, ${sourceX} ${y + radius}`;
    return (
      <g
        style={{ cursor: 'pointer' }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={lineStyle.strokeWidth}
          strokeDasharray={lineStyle.strokeDasharray}
          markerEnd={markerId ? `url(#${markerId})` : undefined}
        />
        <text
          x={sourceX + 30}
          y={y - 4}
          fontSize={12}
          fill={selected ? '#1890ff' : '#333'}
        >
          {sequenceLabel}{displayLabel}
        </text>
      </g>
    );
  }

  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <line
        x1={sourceX}
        y1={y}
        x2={targetX}
        y2={y}
        stroke={stroke}
        strokeWidth={selected ? lineStyle.strokeWidth + 0.5 : lineStyle.strokeWidth}
        strokeDasharray={lineStyle.strokeDasharray}
        markerEnd={markerId ? `url(#${markerId})` : undefined}
      />
      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        fontSize={12}
        fill={selected ? '#1890ff' : '#333'}
      >
        {sequenceLabel}{displayLabel}
      </text>
    </g>
  );
});

/**
 * PeriodNode — 时间段节点组件
 *
 * 单一职责：显示时间段标签和关联事件，支持点击和右键交互
 *
 * 数据流:
 *   TimelinePeriod → PeriodNode → 点击/右键回调
 */

import { memo } from 'react';
import type { ReactElement } from 'react';
import type { TimelinePeriod } from '@mermaid2aichat/serializer';
import { EventNode } from './event-node.js';

export interface PeriodNodeProps {
  /** 时间段数据 */
  period: TimelinePeriod;
  /** 布局方向 */
  direction: 'LR' | 'TB';
  /** 是否高亮 */
  isHighlighted: boolean;
  /** 点击回调 */
  onClick: () => void;
  /** 右键回调 */
  onContextMenu: (e: React.MouseEvent) => void;
  /** 事件点击回调 */
  onEventClick: (eventIdx: number) => void;
}

/** 时间段配色（循环使用） */
const PERIOD_COLORS = [
  '#1890ff', '#52c41a', '#fa8c16', '#f5222d',
  '#722ed1', '#13c2c2', '#eb2f96', '#faad14',
];

export const PeriodNode = memo(function PeriodNode({
  period,
  direction,
  isHighlighted,
  onClick,
  onContextMenu,
  onEventClick,
}: PeriodNodeProps): ReactElement {
  const color = PERIOD_COLORS[0]; // 颜色由渲染器分配，这里用默认色
  const isHorizontal = direction === 'LR';

  return (
    <div
      className={`timeline-period ${isHighlighted ? 'highlighted' : ''} ${isHorizontal ? 'horizontal' : 'vertical'}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {/* 时间段标记点 */}
      <div className="timeline-marker" style={{ background: color }} />
      <div className="timeline-period-content">
        <div className="timeline-period-label" style={{ color }}>
          {period.label}
        </div>
        <div className="timeline-events">
          {period.events.map((event, eventIdx) => (
            <EventNode
              key={eventIdx}
              event={event}
              direction={direction}
              onClick={() => onEventClick(eventIdx)}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

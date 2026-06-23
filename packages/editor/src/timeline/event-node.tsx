/**
 * EventNode — 事件节点组件
 *
 * 单一职责：显示事件标签，支持点击交互
 *
 * 数据流:
 *   TimelineEvent → EventNode → 点击回调
 */

import { memo } from 'react';
import type { ReactElement } from 'react';
import type { TimelineEvent } from '@mermaid2aichat/serializer';

export interface EventNodeProps {
  /** 事件数据 */
  event: TimelineEvent;
  /** 布局方向 */
  direction: 'LR' | 'TB';
  /** 是否高亮 */
  isHighlighted?: boolean;
  /** 点击回调 */
  onClick: () => void;
}

export const EventNode = memo(function EventNode({
  event,
  direction,
  isHighlighted = false,
  onClick,
}: EventNodeProps): ReactElement {
  const isHorizontal = direction === 'LR';

  return (
    <div
      className={`timeline-event ${isHighlighted ? 'highlighted' : ''} ${isHorizontal ? 'horizontal' : 'vertical'}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <span className="timeline-event-label">{event.label}</span>
    </div>
  );
});

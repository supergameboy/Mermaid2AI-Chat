/**
 * SectionGroup — Section 分组组件
 *
 * 单一职责：用虚线框包裹 section 的 periods，显示 section 标题
 *
 * 决策 8：section 用虚线框 + 标题视觉分组
 *
 * 数据流:
 *   TimelineSection → SectionGroup → 子组件（PeriodNode[]）
 */

import { memo } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { TimelineSection } from '@mermaid2aichat/serializer';

export interface SectionGroupProps {
  /** Section 数据 */
  section: TimelineSection;
  /** 布局方向 */
  direction: 'LR' | 'TB';
  /** 子组件（PeriodNode[]） */
  children: ReactNode;
  /** 是否高亮 */
  isHighlighted?: boolean;
  /** 右键回调 */
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const SectionGroup = memo(function SectionGroup({
  section,
  direction,
  children,
  isHighlighted = false,
  onContextMenu,
}: SectionGroupProps): ReactElement {
  const isHorizontal = direction === 'LR';
  const hasName = section.name !== undefined && section.name !== '';

  return (
    <div
      className={`timeline-section ${isHighlighted ? 'highlighted' : ''} ${isHorizontal ? 'horizontal' : 'vertical'}`}
      onContextMenu={onContextMenu}
    >
      {hasName && (
        <div className="timeline-section-name">{section.name}</div>
      )}
      <div className="timeline-section-content">
        {children}
      </div>
    </div>
  );
});

/**
 * Legend — 饼图图例组件
 *
 * 单一职责：渲染图例列表，显示每个切片的 label/颜色/数值/百分比，支持删除
 *
 * 数据流:
 *   props (slices/colors/total) → 图例列表 → 用户交互回调
 */

import type { PieSlice } from '@mermaid2aichat/serializer';
import { calculatePercentage } from '@mermaid2aichat/serializer';

/** Legend 组件 Props */
export interface LegendProps {
  /** 切片列表 */
  slices: PieSlice[];
  /** 颜色列表（与 slices 一一对应） */
  colors: string[];
  /** 总值（用于百分比计算） */
  total: number;
  /** 高亮索引（hover 或选中时高亮对应项） */
  highlightedIdx?: number | null;
  /** 删除切片回调 */
  onRemoveSlice?: (idx: number) => void;
  /** hover 图例项回调（用于高亮对应切片） */
  onHoverSlice?: (idx: number | null) => void;
}

export function Legend(props: LegendProps) {
  const { slices, colors, total, highlightedIdx, onRemoveSlice, onHoverSlice } = props;

  return (
    <div className="pie-legend">
      {slices.map((slice, idx) => {
        const percentage = calculatePercentage(slice.value, total).toFixed(1);
        const isHighlighted = highlightedIdx === idx;
        return (
          <div
            key={idx}
            className={`pie-legend-item ${isHighlighted ? 'pie-legend-item-highlighted' : ''}`}
            onMouseEnter={() => onHoverSlice?.(idx)}
            onMouseLeave={() => onHoverSlice?.(null)}
          >
            <span className="pie-legend-color" style={{ background: colors[idx] }} />
            <span className="pie-legend-label">{slice.label}</span>
            <span className="pie-legend-value">{slice.value}</span>
            <span className="pie-legend-percentage">({percentage}%)</span>
            {onRemoveSlice && (
              <button
                type="button"
                className="pie-legend-remove"
                onClick={() => onRemoveSlice(idx)}
                title="删除切片"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

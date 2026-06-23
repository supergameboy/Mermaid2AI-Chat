/**
 * DependencyArrow — 甘特图依赖箭头组件
 *
 * 单一职责：渲染任务间的依赖关系箭头（从前置任务结束点 → 后置任务起始点）
 * 支持多依赖（每个依赖一条箭头）
 */

export interface DependencyArrowProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export function DependencyArrow(props: DependencyArrowProps): JSX.Element {
  const { from, to } = props;
  // 绘制 L 形箭头：从前置任务右端 → 向下/上 → 到后置任务左端
  const midX = from.x + (to.x - from.x) / 2;
  const path = [
    `M ${from.x} ${from.y}`,
    `L ${midX} ${from.y}`,
    `L ${midX} ${to.y}`,
    `L ${to.x} ${to.y}`,
  ].join(' ');

  return (
    <g style={{ pointerEvents: 'none' }}>
      <path
        d={path}
        fill="none"
        stroke="#999"
        strokeWidth={1.5}
        strokeDasharray="3,2"
      />
      {/* 箭头头部 */}
      <polygon
        points={`${to.x},${to.y} ${to.x - 6},${to.y - 4} ${to.x - 6},${to.y + 4}`}
        fill="#999"
      />
    </g>
  );
}

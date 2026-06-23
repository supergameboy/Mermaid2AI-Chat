/**
 * TaskBar — 甘特图任务条组件
 *
 * 单一职责：渲染单个任务条，根据 tags 渲染状态样式，发出拖拽/缩放事件
 * - tags 包含 'milestone' → 菱形渲染（不可拖拽/缩放）
 * - tags 包含 'done' → 已完成样式（绿色）
 * - tags 包含 'active' → 进行中样式（蓝色）
 * - tags 包含 'crit' → 关键任务样式（红色边框）
 * - 多标签组合（如 ['done', 'crit']）→ 组合样式
 *
 * 交互：
 * - 拖拽任务条主体 → onDrag(deltaDays) → 更新 startDate
 * - 拖拽任务条右边缘 resize handle → onResize(deltaDays) → 更新 duration
 */
import { useCallback, useRef, useState } from 'react';
import type { GanttTask } from '@mermaid2aichat/serializer';

export interface TaskBarProps {
  task: GanttTask;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 每天对应的像素宽度（用于像素↔天数转换） */
  dayWidth: number;
  onClick: () => void;
  /** 右键上下文菜单事件 */
  onContextMenu?: (e: React.MouseEvent) => void;
  /** 拖拽任务条主体（移动 startDate），deltaDays 为拖拽天数（可负） */
  onDrag?: (deltaDays: number) => void;
  /** 拖拽右边缘 resize handle（改变 duration），deltaDays 为缩放天数（可负） */
  onResize?: (deltaDays: number) => void;
}

/** 任务状态颜色映射 */
const TAG_COLORS: Record<string, string> = {
  done: '#52c41a',
  active: '#1890ff',
  crit: '#f5222d',
  milestone: '#fa8c16',
};

/** 根据 tags 获取主色调 */
function getPrimaryColor(tags: string[] | undefined): string {
  if (!tags || tags.length === 0) return '#8c8c8c';
  // 优先级：milestone > crit > done > active
  if (tags.includes('milestone')) return TAG_COLORS.milestone;
  if (tags.includes('crit')) return TAG_COLORS.crit;
  if (tags.includes('done')) return TAG_COLORS.done;
  if (tags.includes('active')) return TAG_COLORS.active;
  return '#8c8c8c';
}

/** Resize handle 宽度（像素） */
const RESIZE_HANDLE_WIDTH = 6;

export function TaskBar(props: TaskBarProps): JSX.Element {
  const { task, x, y, width, height, dayWidth, onClick, onContextMenu, onDrag, onResize } = props;
  const isMilestone = task.tags?.includes('milestone') ?? false;
  const color = getPrimaryColor(task.tags);
  const isCrit = task.tags?.includes('crit') ?? false;

  // 拖拽状态：'none' | 'move' | 'resize'
  const [dragMode, setDragMode] = useState<'none' | 'move' | 'resize'>('none');
  // 拖拽起点 X（像素，相对 SVG 坐标系）
  const dragStartX = useRef(0);

  /** 开始拖拽（move 或 resize） */
  const handlePointerDown = useCallback(
    (mode: 'move' | 'resize') => (e: React.PointerEvent<SVGElement>) => {
      // milestone 不可拖拽
      if (isMilestone) return;
      // 阻止冒泡，避免触发 onClick
      e.stopPropagation();
      e.preventDefault();
      // 捕获指针，确保 pointermove/pointerup 能被接收
      (e.target as SVGElement).setPointerCapture(e.pointerId);
      dragStartX.current = e.clientX;
      setDragMode(mode);
    },
    [isMilestone]
  );

  /** 拖拽中 */
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGElement>) => {
      if (dragMode === 'none') return;
      const deltaX = e.clientX - dragStartX.current;
      const deltaDays = Math.round(deltaX / dayWidth);
      if (deltaDays === 0) return;
      // 更新起点，使 deltaDays 为增量而非累计
      dragStartX.current += deltaDays * dayWidth;
      if (dragMode === 'move' && onDrag) {
        onDrag(deltaDays);
      } else if (dragMode === 'resize' && onResize) {
        onResize(deltaDays);
      }
    },
    [dragMode, dayWidth, onDrag, onResize]
  );

  /** 结束拖拽 */
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGElement>) => {
      if (dragMode === 'none') return;
      (e.target as SVGElement).releasePointerCapture(e.pointerId);
      setDragMode('none');
    },
    [dragMode]
  );

  if (isMilestone) {
    // 菱形渲染（milestone 不可拖拽/缩放）
    const cx = x;
    const cy = y + height / 2;
    const halfSize = Math.min(height / 2, 8);
    const points = [
      `${cx},${cy - halfSize}`,
      `${cx + halfSize},${cy}`,
      `${cx},${cy + halfSize}`,
      `${cx - halfSize},${cy}`,
    ].join(' ');
    return (
      <g onClick={onClick} onContextMenu={onContextMenu} style={{ cursor: 'pointer' }}>
        <polygon
          points={points}
          fill={color}
          stroke="#fff"
          strokeWidth={1}
        />
        {task.label && (
          <text
            x={cx + halfSize + 6}
            y={cy + 4}
            fontSize={12}
            fill="#333"
          >
            {task.label}
          </text>
        )}
      </g>
    );
  }

  // 矩形任务条
  const minWidth = Math.max(width, 4);
  const canDrag = onDrag !== undefined;
  const canResize = onResize !== undefined;
  return (
    <g
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{ cursor: canDrag ? 'move' : 'pointer' }}
    >
      {/* 任务条主体（可拖拽移动） */}
      <rect
        x={x}
        y={y + 2}
        width={minWidth}
        height={height - 4}
        rx={3}
        fill={color}
        stroke={isCrit ? '#f5222d' : '#fff'}
        strokeWidth={isCrit ? 2 : 1}
        opacity={task.tags?.includes('done') ? 0.7 : 1}
        onPointerDown={canDrag ? handlePointerDown('move') : undefined}
        onPointerMove={canDrag ? handlePointerMove : undefined}
        onPointerUp={canDrag ? handlePointerUp : undefined}
      />
      {task.label && (
        <text
          x={x + 4}
          y={y + height / 2 + 4}
          fontSize={11}
          fill="#fff"
          style={{ pointerEvents: 'none' }}
        >
          {width > 30 ? task.label : ''}
        </text>
      )}
      {/* 右边缘 resize handle（可缩放 duration） */}
      {canResize && (
        <rect
          x={x + minWidth - RESIZE_HANDLE_WIDTH}
          y={y + 2}
          width={RESIZE_HANDLE_WIDTH}
          height={height - 4}
          fill="transparent"
          stroke="#fff"
          strokeWidth={1}
          style={{ cursor: 'ew-resize' }}
          onPointerDown={handlePointerDown('resize')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      )}
    </g>
  );
}

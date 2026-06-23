/**
 * GanttRenderer — 甘特图渲染器
 *
 * 单一职责：将 GanttCanvasState 渲染为 SVG 甘特图
 * - 按 section 分组显示任务条
 * - 任务状态颜色：done(绿)/active(蓝)/crit(红)/milestone(菱形)
 * - 支持点击任务条编辑标签
 */
import { useState, useCallback } from 'react';
import type { GanttCanvasState, GanttTask } from '@mermaid2aichat/serializer';
import { SpecializedShell } from './shared/specialized-shell.js';
import { formatShortDate, daysBetween, parseDurationToDays } from './shared/chart-layout.js';
import type { GanttRendererProps } from './types.js';

/** 任务状态颜色映射 */
const STATUS_COLORS: Record<string, string> = {
  done: '#52c41a',
  active: '#1890ff',
  crit: '#f5222d',
  milestone: '#fa8c16',
};

const ROW_HEIGHT = 28;
const SECTION_HEADER_HEIGHT = 32;
const LEFT_PADDING = 200;
const RIGHT_PADDING = 40;
const TOP_PADDING = 60;
const DAY_WIDTH = 30;

/** 计算任务起始天数（相对最早任务） */
function getTaskStartDay(task: GanttTask, allTasks: GanttTask[]): number {
  if (task.startDate) {
    const earliest = getEarliestDate(allTasks);
    if (earliest) return daysBetween(earliest, task.startDate);
  }
  if (task.afterId) {
    const dep = allTasks.find((t) => t.id === task.afterId);
    if (dep) return getTaskStartDay(dep, allTasks) + getTaskDurationDays(dep);
  }
  return 0;
}

/** 计算任务持续天数 */
function getTaskDurationDays(task: GanttTask): number {
  if (task.duration) return parseDurationToDays(task.duration);
  if (task.endDate && task.startDate) return daysBetween(task.startDate, task.endDate);
  return 1;
}

/** 获取所有任务中最早的起始日期 */
function getEarliestDate(tasks: GanttTask[]): string | null {
  const dates = tasks
    .filter((t) => t.startDate)
    .map((t) => t.startDate!) as string[];
  if (dates.length === 0) return null;
  return dates.sort()[0];
}

/** 计算甘特图总天数范围 */
function getTotalDays(sections: GanttCanvasState['sections']): number {
  const allTasks = sections.flatMap((s) => s.tasks);
  if (allTasks.length === 0) return 30;
  const maxEnd = Math.max(
    ...allTasks.map((t) => getTaskStartDay(t, allTasks) + getTaskDurationDays(t))
  );
  return Math.max(30, maxEnd + 5);
}

export function GanttRenderer(props: GanttRendererProps) {
  const { syncCanvas, onCanvasUpdate, ...shellProps } = props;
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const allTasks = syncCanvas.sections.flatMap((s) => s.tasks);
  const totalDays = getTotalDays(syncCanvas.sections);
  const svgWidth = LEFT_PADDING + totalDays * DAY_WIDTH + RIGHT_PADDING;

  // 计算每行 y 位置
  const rows: { sectionName: string; task: GanttTask | null; y: number }[] = [];
  let currentY = TOP_PADDING;
  for (const section of syncCanvas.sections) {
    rows.push({ sectionName: section.name, task: null, y: currentY });
    currentY += SECTION_HEADER_HEIGHT;
    for (const task of section.tasks) {
      rows.push({ sectionName: section.name, task, y: currentY });
      currentY += ROW_HEIGHT;
    }
  }
  const svgHeight = currentY + 40;

  const handleTaskClick = useCallback((task: GanttTask) => {
    setEditingTaskId(task.id ?? task.label);
    setEditLabel(task.label);
  }, []);

  const handleLabelConfirm = useCallback(
    (sectionIdx: number, taskIdx: number) => {
      if (!editingTaskId) return;
      const newSections = syncCanvas.sections.map((s, si) => {
        if (si !== sectionIdx) return s;
        return {
          ...s,
          tasks: s.tasks.map((t, ti) => {
            if (ti !== taskIdx) return t;
            return { ...t, label: editLabel };
          }),
        };
      });
      onCanvasUpdate({ ...syncCanvas, sections: newSections });
      setEditingTaskId(null);
    },
    [editingTaskId, editLabel, syncCanvas, onCanvasUpdate]
  );

  return (
    <SpecializedShell
      syncCanvas={syncCanvas}
      onCanvasUpdate={onCanvasUpdate}
      {...shellProps}
    >
      <div className="specialized-chart-wrapper">
        <div className="specialized-title">{syncCanvas.title ?? '甘特图'}</div>
        <div className="specialized-scroll-container">
          <svg
            width={svgWidth}
            height={svgHeight}
            className="gantt-svg"
            role="img"
            aria-label="甘特图"
          >
            {/* 时间轴标尺 */}
            <line
              x1={LEFT_PADDING}
              y1={TOP_PADDING - 20}
              x2={LEFT_PADDING + totalDays * DAY_WIDTH}
              y2={TOP_PADDING - 20}
              stroke="#d9d9d9"
              strokeWidth={1}
            />
            {Array.from({ length: totalDays + 1 }, (_, i) => (
              <g key={i}>
                <line
                  x1={LEFT_PADDING + i * DAY_WIDTH}
                  y1={TOP_PADDING - 24}
                  x2={LEFT_PADDING + i * DAY_WIDTH}
                  y2={TOP_PADDING - 16}
                  stroke="#999"
                  strokeWidth={1}
                />
                {i % 7 === 0 && (
                  <text
                    x={LEFT_PADDING + i * DAY_WIDTH}
                    y={TOP_PADDING - 28}
                    fontSize={10}
                    fill="#999"
                    textAnchor="middle"
                  >
                    Day {i}
                  </text>
                )}
              </g>
            ))}

            {/* 区段和任务条 */}
            {rows.map((row, idx) => {
              if (!row.task) {
                // 区段标题行
                return (
                  <g key={`section-${idx}`}>
                    <rect
                      x={0}
                      y={row.y}
                      width={svgWidth}
                      height={SECTION_HEADER_HEIGHT}
                      fill="#fafafa"
                    />
                    <text
                      x={12}
                      y={row.y + SECTION_HEADER_HEIGHT / 2 + 4}
                      fontSize={13}
                      fontWeight={600}
                      fill="#333"
                    >
                      {row.sectionName}
                    </text>
                  </g>
                );
              }
              const task = row.task;
              const startDay = getTaskStartDay(task, allTasks);
              const duration = getTaskDurationDays(task);
              const x = LEFT_PADDING + startDay * DAY_WIDTH;
              const width = Math.max(duration * DAY_WIDTH, 8);
              const isMilestone = task.status === 'milestone';
              const color = STATUS_COLORS[task.status ?? 'active'] ?? STATUS_COLORS.active;
              const taskIdx = syncCanvas.sections
                .find((s) => s.name === row.sectionName)!
                .tasks.indexOf(task);
              const sectionIdx = syncCanvas.sections.findIndex(
                (s) => s.name === row.sectionName
              );

              return (
                <g
                  key={`task-${idx}`}
                  onClick={() => handleTaskClick(task)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* 任务标签（左侧） */}
                  <text
                    x={12}
                    y={row.y + ROW_HEIGHT / 2 + 4}
                    fontSize={12}
                    fill="#333"
                  >
                    {task.label}
                  </text>
                  {/* 任务条 */}
                  {isMilestone ? (
                    <polygon
                      points={`${x},${row.y + ROW_HEIGHT / 2 - 8} ${x + 8},${row.y + ROW_HEIGHT / 2} ${x},${row.y + ROW_HEIGHT / 2 + 8} ${x - 8},${row.y + ROW_HEIGHT / 2}`}
                      fill={color}
                      stroke="#fff"
                      strokeWidth={1}
                    />
                  ) : (
                    <rect
                      x={x}
                      y={row.y + 4}
                      width={width}
                      height={ROW_HEIGHT - 8}
                      rx={3}
                      fill={color}
                      stroke="#fff"
                      strokeWidth={1}
                    />
                  )}
                  {/* 起止日期提示 */}
                  {task.startDate && (
                    <text
                      x={x + width + 6}
                      y={row.y + ROW_HEIGHT / 2 + 4}
                      fontSize={10}
                      fill="#999"
                    >
                      {formatShortDate(task.startDate)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* 编辑任务标签的浮层 */}
          {editingTaskId && (
            <div className="specialized-edit-overlay">
              <div className="specialized-edit-dialog">
                <label className="panel-label">
                  任务名称
                  <input
                    className="panel-input"
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    autoFocus
                  />
                </label>
                <div className="specialized-edit-actions">
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => {
                      const sectionIdx = syncCanvas.sections.findIndex((s) =>
                        s.tasks.some((t) => (t.id ?? t.label) === editingTaskId)
                      );
                      const taskIdx = syncCanvas.sections[sectionIdx].tasks.findIndex(
                        (t) => (t.id ?? t.label) === editingTaskId
                      );
                      handleLabelConfirm(sectionIdx, taskIdx);
                    }}
                  >
                    确认
                  </button>
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => setEditingTaskId(null)}
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </SpecializedShell>
  );
}

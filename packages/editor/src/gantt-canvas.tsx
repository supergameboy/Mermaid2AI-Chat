/**
 * GanttCanvas — 甘特图专用画布（非 React Flow，时间轴布局）
 *
 * 单一职责：管理甘特图画布状态，渲染任务条 + 依赖箭头 + 时间轴 + 编辑面板
 *
 * 数据流设计（单向，无循环）：
 * - 服务端同步：syncCanvas → 直接渲染（GanttCanvasState 是只读的）
 * - 本地操作：用户编辑 → 更新 sections/config → onCanvasUpdate(GanttCanvasState) → 外部
 *
 * 渲染层次（从底到顶）：
 *   1. 时间轴（日期刻度 + todayMarker + weekend 着色）
 *   2. 区段标题行
 *   3. 依赖箭头（从前置任务 → 后置任务）
 *   4. 任务条（根据 tags 渲染状态）
 *   5. 编辑面板（浮层）
 */
import { useCallback, useMemo, useState } from 'react';
import {
  type CanvasState,
  type GanttCanvasState,
  type GanttTask,
  type GanttSection,
} from '@mermaid2aichat/serializer';
import type { CanvasDispatcherProps } from './canvas.js';
import { SpecializedShell } from './specialized/shared/specialized-shell.js';
import { TaskBar, DependencyArrow, TimelineAxis } from './gantt/index.js';
import {
  GanttTaskPanel,
  GanttSectionPanel,
  GanttConfigPanel,
} from './components/gantt/index.js';
import {
  formatShortDate,
  daysBetween,
  parseDurationToDays,
  generateChartId,
} from './specialized/shared/chart-layout.js';

// ============================================================
// 布局常量
// ============================================================
const ROW_HEIGHT = 28;
const SECTION_HEADER_HEIGHT = 32;
const LEFT_PADDING = 200;
const RIGHT_PADDING = 40;
const TOP_PADDING = 60;
const DAY_WIDTH = 30;

// ============================================================
// 辅助函数
// ============================================================

/** 计算任务持续天数 */
function getTaskDurationDays(task: GanttTask): number {
  if (task.duration) return parseDurationToDays(task.duration);
  if (task.endDate && task.startDate) return daysBetween(task.startDate, task.endDate);
  return 1;
}

/** 获取所有任务中最早的起始日期
 *
 * 注意：startDate 格式取决于 dateFormat（可能是 YYYY-MM-DD 或 MM/DD/YYYY 等），
 * 不能用字典序排序，必须用 Date 对象比较。
 */
function getEarliestDate(tasks: GanttTask[]): string | null {
  const dates = tasks
    .filter((t) => t.startDate)
    .map((t) => new Date(t.startDate as string));
  if (dates.length === 0) return null;
  const earliest = dates.reduce((min, d) => (d < min ? d : min));
  return tasks
    .filter((t) => t.startDate && new Date(t.startDate as string).getTime() === earliest.getTime())
    .map((t) => t.startDate as string)[0] ?? null;
}

/** 获取所有任务中最晚的结束日期
 *
 * 注意：endDate 格式取决于 dateFormat，不能用字典序排序，必须用 Date 对象比较。
 */
function getLatestEndDate(tasks: GanttTask[]): string | null {
  const endDates: { date: Date; str: string }[] = [];
  for (const t of tasks) {
    if (t.endDate) {
      endDates.push({ date: new Date(t.endDate), str: t.endDate });
    } else if (t.startDate && t.duration) {
      const start = new Date(t.startDate);
      start.setDate(start.getDate() + getTaskDurationDays(t));
      endDates.push({ date: start, str: start.toISOString().slice(0, 10) });
    }
  }
  if (endDates.length === 0) return null;
  const latest = endDates.reduce((max, d) => (d.date > max.date ? d : max));
  return latest.str;
}

/** 计算任务起始天数（相对最早任务）
 *
 * 循环依赖保护：使用 path Set 检测当前递归路径上的循环依赖。
 * 如果检测到循环依赖，输出 console.warn 并返回 0（整个依赖分支返回 0，不累加 duration）。
 *
 * @param task - 当前任务
 * @param allTasks - 所有任务列表
 * @param earliestDate - 所有任务中最早的起始日期（外部计算一次，避免 O(n²) 重复计算）
 * @param path - 当前递归路径上已访问的任务 ID（用于检测循环依赖）
 */
function getTaskStartDay(
  task: GanttTask,
  allTasks: GanttTask[],
  earliestDate: string | null,
  path: Set<string> = new Set()
): number {
  // 循环依赖检测：如果任务有 ID 且在当前路径上已访问，说明有循环依赖
  if (task.id && path.has(task.id)) {
    console.warn(`[GanttCanvas] 检测到循环依赖：任务 ${task.id} 在依赖路径上，返回 startDay=0`);
    return Number.NaN;
  }

  if (task.startDate && earliestDate) {
    return daysBetween(earliestDate, task.startDate);
  }

  if (task.dependencies && task.dependencies.length > 0) {
    // 将当前任务加入路径，递归后移除（只在当前路径上检测，不跨路径共享）
    if (task.id) {
      path.add(task.id);
    }
    let maxEnd = 0;
    let hasCycle = false;
    for (const depId of task.dependencies) {
      const dep = allTasks.find((t) => t.id === depId);
      if (dep) {
        const depStart = getTaskStartDay(dep, allTasks, earliestDate, path);
        // 依赖返回 NaN（循环依赖），标记并跳过（不累加 duration）
        if (Number.isNaN(depStart)) {
          hasCycle = true;
          continue;
        }
        const depEnd = depStart + getTaskDurationDays(dep);
        if (depEnd > maxEnd) maxEnd = depEnd;
      }
    }
    if (task.id) {
      path.delete(task.id);
    }
    // 有循环依赖时，整个分支返回 0（无法正确解析依赖链）
    return hasCycle ? 0 : maxEnd;
  }
  return 0;
}

/** 计算甘特图总天数范围 */
function getTotalDays(sections: GanttSection[], earliestDate: string | null): number {
  const allTasks = sections.flatMap((s) => s.tasks);
  if (allTasks.length === 0) return 30;
  const maxEnd = Math.max(
    ...allTasks.map((t) => getTaskStartDay(t, allTasks, earliestDate) + getTaskDurationDays(t))
  );
  return Math.max(30, maxEnd + 5);
}

// ============================================================
// 编辑面板状态
// ============================================================

type EditingPanel =
  | { type: 'task'; sectionIdx: number; taskIdx: number }
  | { type: 'section'; sectionIdx: number }
  | { type: 'config' }
  | { type: 'addTask'; sectionIdx: number }
  | null;

/** 右键上下文菜单状态 */
type ContextMenu =
  | { type: 'task'; sectionIdx: number; taskIdx: number; x: number; y: number }
  | { type: 'section'; sectionIdx: number; x: number; y: number }
  | { type: 'canvas'; x: number; y: number }
  | null;

/** 右键上下文菜单 payload（不含坐标，由 handleContextMenu 补充） */
type ContextMenuPayload =
  | { type: 'task'; sectionIdx: number; taskIdx: number }
  | { type: 'section'; sectionIdx: number }
  | { type: 'canvas' };

// ============================================================
// GanttCanvas 主组件
// ============================================================

export function GanttCanvas(props: CanvasDispatcherProps): JSX.Element {
  const { syncCanvas, onCanvasUpdate, ...shellProps } = props;
  const ganttCanvas = syncCanvas as GanttCanvasState;
  const [editingPanel, setEditingPanel] = useState<EditingPanel>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  /** 删除 section 确认对话框（有任务时询问处理方式） */
  const [deleteSectionConfirm, setDeleteSectionConfirm] = useState<{ sectionIdx: number } | null>(null);

  // canvas.tsx 在分发前已校验 onCanvasUpdate 存在，此处断言非空
  const handleCanvasUpdate = onCanvasUpdate as (canvas: CanvasState) => void;

  const allTasks = useMemo(
    () => ganttCanvas.sections.flatMap((s) => s.tasks),
    [ganttCanvas.sections]
  );
  // earliestDate 只计算一次，传入 getTaskStartDay/getTotalDays 避免 O(n²) 重复计算
  const earliestDate = useMemo(
    () => getEarliestDate(allTasks),
    [allTasks]
  );
  const totalDays = useMemo(
    () => getTotalDays(ganttCanvas.sections, earliestDate),
    [ganttCanvas.sections, earliestDate]
  );
  const svgWidth = LEFT_PADDING + totalDays * DAY_WIDTH + RIGHT_PADDING;

  // 计算每行 y 位置
  const rows = useMemo(() => {
    const result: {
      sectionName: string;
      sectionIdx: number;
      task: GanttTask | null;
      taskIdx: number;
      y: number;
    }[] = [];
    let currentY = TOP_PADDING;
    ganttCanvas.sections.forEach((section, si) => {
      result.push({
        sectionName: section.name,
        sectionIdx: si,
        task: null,
        taskIdx: -1,
        y: currentY,
      });
      currentY += SECTION_HEADER_HEIGHT;
      section.tasks.forEach((task, ti) => {
        result.push({
          sectionName: section.name,
          sectionIdx: si,
          task,
          taskIdx: ti,
          y: currentY,
        });
        currentY += ROW_HEIGHT;
      });
    });
    return result;
  }, [ganttCanvas.sections]);

  const svgHeight = rows.length > 0
    ? rows[rows.length - 1].y + ROW_HEIGHT + 40
    : TOP_PADDING + 40;

  // 获取时间轴范围（earliestDate 已在前面用 useMemo 计算）
  const latestDate = useMemo(() => getLatestEndDate(allTasks), [allTasks]);
  const axisStartDate = earliestDate ? new Date(earliestDate) : new Date();
  const axisEndDate = latestDate
    ? new Date(latestDate)
    : new Date(axisStartDate.getTime() + totalDays * 24 * 60 * 60 * 1000);

  // ============================================================
  // 编辑操作回调
  // ============================================================

  const handleTaskClick = useCallback(
    (sectionIdx: number, taskIdx: number) => {
      setEditingPanel({ type: 'task', sectionIdx, taskIdx });
    },
    []
  );

  const handleSectionClick = useCallback((sectionIdx: number) => {
    setEditingPanel({ type: 'section', sectionIdx });
  }, []);

  /** 拖拽任务条主体 → 更新 startDate（依赖驱动的任务不可拖拽） */
  const handleTaskDrag = useCallback(
    (sectionIdx: number, taskIdx: number, deltaDays: number) => {
      const task = ganttCanvas.sections[sectionIdx]?.tasks[taskIdx];
      if (!task) return;
      // 依赖驱动的任务 startDate 由依赖决定，不可手动拖拽
      if (task.dependencies && task.dependencies.length > 0) return;
      const baseDate = task.startDate ?? earliestDate ?? new Date().toISOString().slice(0, 10);
      const newDate = new Date(baseDate);
      newDate.setDate(newDate.getDate() + deltaDays);
      const newStartDate = newDate.toISOString().slice(0, 10);
      const newSections = ganttCanvas.sections.map((s, si) => {
        if (si !== sectionIdx) return s;
        return {
          ...s,
          tasks: s.tasks.map((t, ti) => {
            if (ti !== taskIdx) return t;
            return { ...t, startDate: newStartDate };
          }),
        };
      });
      handleCanvasUpdate({ ...ganttCanvas, sections: newSections });
    },
    [ganttCanvas, earliestDate, handleCanvasUpdate]
  );

  /** 拖拽任务条右边缘 → 更新 duration（或 endDate）
   *
   * 单一数据源：更新 duration 时清除 endDate（避免同时存在 duration 和 endDate）。
   */
  const handleTaskResize = useCallback(
    (sectionIdx: number, taskIdx: number, deltaDays: number) => {
      const task = ganttCanvas.sections[sectionIdx]?.tasks[taskIdx];
      if (!task) return;
      const newSections = ganttCanvas.sections.map((s, si) => {
        if (si !== sectionIdx) return s;
        return {
          ...s,
          tasks: s.tasks.map((t, ti) => {
            if (ti !== taskIdx) return t;
            // 优先更新 duration（清除 endDate，保证单一数据源）
            if (t.duration) {
              const currentDays = parseDurationToDays(t.duration);
              const newDays = Math.max(1, currentDays + deltaDays);
              return { ...t, duration: `${newDays}d`, endDate: undefined };
            }
            // 无 duration 时更新 endDate
            if (t.endDate) {
              const newEnd = new Date(t.endDate);
              newEnd.setDate(newEnd.getDate() + deltaDays);
              return { ...t, endDate: newEnd.toISOString().slice(0, 10) };
            }
            // 既无 duration 也无 endDate，设置 duration
            return { ...t, duration: `${Math.max(1, deltaDays)}d` };
          }),
        };
      });
      handleCanvasUpdate({ ...ganttCanvas, sections: newSections });
    },
    [ganttCanvas, handleCanvasUpdate]
  );

  const handleTaskUpdate = useCallback(
    (updates: Partial<GanttTask>) => {
      if (!editingPanel || editingPanel.type !== 'task') return;
      const { sectionIdx, taskIdx } = editingPanel;
      const newSections = ganttCanvas.sections.map((s, si) => {
        if (si !== sectionIdx) return s;
        return {
          ...s,
          tasks: s.tasks.map((t, ti) => {
            if (ti !== taskIdx) return t;
            return { ...t, ...updates };
          }),
        };
      });
      handleCanvasUpdate({ ...ganttCanvas, sections: newSections });
    },
    [editingPanel, ganttCanvas, handleCanvasUpdate]
  );

  const handleTaskDelete = useCallback(() => {
    if (!editingPanel || editingPanel.type !== 'task') return;
    const { sectionIdx, taskIdx } = editingPanel;
    const newSections = ganttCanvas.sections.map((s, si) => {
      if (si !== sectionIdx) return s;
      return {
        ...s,
        tasks: s.tasks.filter((_, ti) => ti !== taskIdx),
      };
    });
    handleCanvasUpdate({ ...ganttCanvas, sections: newSections });
    setEditingPanel(null);
  }, [editingPanel, ganttCanvas, handleCanvasUpdate]);

  const handleSectionRename = useCallback(
    (sectionIdx: number, name: string) => {
      const newSections = ganttCanvas.sections.map((s, si) => {
        if (si !== sectionIdx) return s;
        return { ...s, name };
      });
      handleCanvasUpdate({ ...ganttCanvas, sections: newSections });
    },
    [ganttCanvas, handleCanvasUpdate]
  );

  /** 删除 section（递归删除任务） */
  const handleSectionDelete = useCallback(
    (sectionIdx: number) => {
      const newSections = ganttCanvas.sections.filter((_, si) => si !== sectionIdx);
      handleCanvasUpdate({ ...ganttCanvas, sections: newSections });
      setEditingPanel(null);
    },
    [ganttCanvas, handleCanvasUpdate]
  );

  /** 删除 section 并将任务提升到目标 section */
  const handleSectionDeleteAndMerge = useCallback(
    (sectionIdx: number, targetSectionIdx: number) => {
      const deletedSection = ganttCanvas.sections[sectionIdx];
      if (!deletedSection) return;
      const newSections = ganttCanvas.sections
        .map((s, si) => {
          if (si === targetSectionIdx) {
            return { ...s, tasks: [...s.tasks, ...deletedSection.tasks] };
          }
          return s;
        })
        .filter((_, si) => si !== sectionIdx);
      handleCanvasUpdate({ ...ganttCanvas, sections: newSections });
      setEditingPanel(null);
    },
    [ganttCanvas, handleCanvasUpdate]
  );

  /** 删除 section 请求（有任务时弹出确认对话框） */
  const handleSectionDeleteRequest = useCallback(
    (sectionIdx: number) => {
      const section = ganttCanvas.sections[sectionIdx];
      if (!section) return;
      if (section.tasks.length > 0) {
        setDeleteSectionConfirm({ sectionIdx });
      } else {
        handleSectionDelete(sectionIdx);
      }
    },
    [ganttCanvas.sections, handleSectionDelete]
  );

  const handleAddTask = useCallback(
    (sectionIdx: number) => {
      const newTask: GanttTask = {
        id: generateChartId('task'),
        label: '新任务',
        tags: [],
        startDate: earliestDate ?? new Date().toISOString().slice(0, 10),
        duration: '7d',
      };
      const newSections = ganttCanvas.sections.map((s, si) => {
        if (si !== sectionIdx) return s;
        return { ...s, tasks: [...s.tasks, newTask] };
      });
      handleCanvasUpdate({ ...ganttCanvas, sections: newSections });
      setEditingPanel(null);
    },
    [ganttCanvas, earliestDate, handleCanvasUpdate]
  );

  const handleConfigUpdate = useCallback(
    (updates: Partial<GanttCanvasState>) => {
      handleCanvasUpdate({ ...ganttCanvas, ...updates });
    },
    [ganttCanvas, handleCanvasUpdate]
  );

  const handleAddSection = useCallback(() => {
    const newSection: GanttSection = {
      name: `Section ${ganttCanvas.sections.length + 1}`,
      tasks: [],
    };
    handleCanvasUpdate({
      ...ganttCanvas,
      sections: [...ganttCanvas.sections, newSection],
    });
  }, [ganttCanvas, handleCanvasUpdate]);

  // ============================================================
  // 右键上下文菜单回调
  // ============================================================

  /** 右键任务 → 切换状态标签（done/active/crit/milestone）
   *
   * 数据一致性保证：有 tags 时必须确保任务有 id（否则序列化时 formatTaskLine 会抛异常，
   * 破坏 round-trip 一致性）。如果设置非空 tags 且任务无 id，自动生成 id。
   */
  const handleToggleTag = useCallback(
    (sectionIdx: number, taskIdx: number, tag: string) => {
      const task = ganttCanvas.sections[sectionIdx]?.tasks[taskIdx];
      if (!task) return;
      const currentTags = task.tags ?? [];
      // milestone 互斥（切换 milestone 时移除其他状态，切换其他状态时移除 milestone）
      const isMilestoneToggle = tag === 'milestone';
      const nextTags = isMilestoneToggle
        ? currentTags.includes('milestone')
          ? currentTags.filter((t) => t !== 'milestone')
          : ['milestone']
        : currentTags.includes(tag)
          ? currentTags.filter((t) => t !== tag && t !== 'milestone')
          : [...currentTags.filter((t) => t !== 'milestone'), tag];
      const newSections = ganttCanvas.sections.map((s, si) => {
        if (si !== sectionIdx) return s;
        return {
          ...s,
          tasks: s.tasks.map((t, ti) => {
            if (ti !== taskIdx) return t;
            const updated: GanttTask = {
              ...t,
              tags: nextTags.length > 0 ? nextTags : undefined,
            };
            // 有 tags 但无 id 时自动生成 id（保证 round-trip 一致性）
            if (updated.tags && updated.tags.length > 0 && !updated.id) {
              updated.id = generateChartId('task');
            }
            return updated;
          }),
        };
      });
      handleCanvasUpdate({ ...ganttCanvas, sections: newSections });
    },
    [ganttCanvas, handleCanvasUpdate]
  );

  /** 右键任务 → 删除任务 */
  const handleDeleteTask = useCallback(
    (sectionIdx: number, taskIdx: number) => {
      const newSections = ganttCanvas.sections.map((s, si) => {
        if (si !== sectionIdx) return s;
        return { ...s, tasks: s.tasks.filter((_, ti) => ti !== taskIdx) };
      });
      handleCanvasUpdate({ ...ganttCanvas, sections: newSections });
    },
    [ganttCanvas, handleCanvasUpdate]
  );

  /** 右键任务/section/画布事件处理 */
  const handleContextMenu = useCallback(
    (
      e: React.MouseEvent,
      payload: ContextMenuPayload
    ) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ ...payload, x: e.clientX, y: e.clientY } as ContextMenu);
    },
    []
  );

  // 构建任务位置映射（用于依赖箭头）
  const taskPositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number; width: number }>();
    for (const row of rows) {
      if (row.task && row.task.id) {
        const startDay = getTaskStartDay(row.task, allTasks, earliestDate);
        const duration = getTaskDurationDays(row.task);
        const x = LEFT_PADDING + startDay * DAY_WIDTH;
        const width = Math.max(duration * DAY_WIDTH, 8);
        map.set(row.task.id, { x: x + width, y: row.y + ROW_HEIGHT / 2, width });
      }
    }
    return map;
  }, [rows, allTasks, earliestDate]);

  // 当前编辑的任务/区段
  const currentEditingTask =
    editingPanel?.type === 'task'
      ? ganttCanvas.sections[editingPanel.sectionIdx]?.tasks[editingPanel.taskIdx]
      : undefined;
  const currentEditingSection =
    editingPanel?.type === 'section'
      ? ganttCanvas.sections[editingPanel.sectionIdx]
      : undefined;

  return (
    <SpecializedShell
      syncCanvas={syncCanvas}
      onCanvasUpdate={handleCanvasUpdate}
      {...shellProps}
    >
      <div className="specialized-chart-wrapper">
        <div className="specialized-title">{ganttCanvas.title ?? '甘特图'}</div>
        <div className="specialized-scroll-container">
          <svg
            width={svgWidth}
            height={svgHeight}
            className="gantt-svg"
            role="img"
            aria-label="甘特图"
            onContextMenu={(e) => handleContextMenu(e, { type: 'canvas' })}
          >
            {/* 时间轴 */}
            <TimelineAxis
              startDate={axisStartDate}
              endDate={axisEndDate}
              dateFormat={ganttCanvas.dateFormat}
              todayMarker={ganttCanvas.todayMarker}
              excludes={ganttCanvas.excludes ?? []}
              dayWidth={DAY_WIDTH}
              leftPadding={LEFT_PADDING}
              topPadding={TOP_PADDING}
            />

            {/* 区段和任务条 */}
            {rows.map((row, idx) => {
              if (!row.task) {
                // 区段标题行
                return (
                  <g
                    key={`section-${idx}`}
                    onClick={() => handleSectionClick(row.sectionIdx)}
                    onContextMenu={(e) =>
                      handleContextMenu(e, {
                        type: 'section',
                        sectionIdx: row.sectionIdx,
                      })
                    }
                    style={{ cursor: 'pointer' }}
                  >
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
              const startDay = getTaskStartDay(task, allTasks, earliestDate);
              const duration = getTaskDurationDays(task);
              const x = LEFT_PADDING + startDay * DAY_WIDTH;
              const width = Math.max(duration * DAY_WIDTH, 8);
              return (
                <TaskBar
                  key={`task-${idx}`}
                  task={task}
                  x={x}
                  y={row.y}
                  width={width}
                  height={ROW_HEIGHT}
                  dayWidth={DAY_WIDTH}
                  onClick={() => handleTaskClick(row.sectionIdx, row.taskIdx)}
                  onContextMenu={(e) =>
                    handleContextMenu(e, {
                      type: 'task',
                      sectionIdx: row.sectionIdx,
                      taskIdx: row.taskIdx,
                    })
                  }
                  onDrag={(deltaDays) => handleTaskDrag(row.sectionIdx, row.taskIdx, deltaDays)}
                  onResize={(deltaDays) => handleTaskResize(row.sectionIdx, row.taskIdx, deltaDays)}
                />
              );
            })}

            {/* 依赖箭头 */}
            {allTasks
              .filter((t) => t.dependencies && t.dependencies.length > 0 && t.id)
              .map((task) => {
                const toPos = taskPositions.get(task.id as string);
                if (!toPos) return null;
                return (task.dependencies as string[]).map((depId) => {
                  const fromPos = taskPositions.get(depId);
                  if (!fromPos) return null;
                  return (
                    <DependencyArrow
                      key={`dep-${task.id}-${depId}`}
                      from={{ x: fromPos.x, y: fromPos.y }}
                      to={{ x: toPos.x - toPos.width, y: toPos.y }}
                    />
                  );
                });
              })}
          </svg>

          {/* 工具栏按钮 */}
          <div className="gantt-toolbar">
            <button
              type="button"
              className="toolbar-btn"
              onClick={handleAddSection}
            >
              添加区段
            </button>
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => setEditingPanel({ type: 'config' })}
            >
              图表配置
            </button>
          </div>

          {/* 编辑面板浮层 */}
          {editingPanel && (
            <div className="specialized-edit-overlay">
              <div className="specialized-edit-dialog">
                {editingPanel.type === 'task' && currentEditingTask && (
                  <GanttTaskPanel
                    task={currentEditingTask}
                    allTasks={allTasks}
                    onChange={handleTaskUpdate}
                    onDelete={handleTaskDelete}
                  />
                )}
                {editingPanel.type === 'section' && currentEditingSection && (
                  <GanttSectionPanel
                    section={currentEditingSection}
                    onRename={(name) => handleSectionRename(editingPanel.sectionIdx, name)}
                    onDelete={() => handleSectionDeleteRequest(editingPanel.sectionIdx)}
                    onAddTask={() => handleAddTask(editingPanel.sectionIdx)}
                  />
                )}
                {editingPanel.type === 'config' && (
                  <GanttConfigPanel
                    config={ganttCanvas}
                    onChange={handleConfigUpdate}
                  />
                )}
                <div className="specialized-edit-actions">
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => setEditingPanel(null)}
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 右键上下文菜单 */}
          {contextMenu && (
            <div
              className="gantt-context-menu-overlay"
              onClick={() => setContextMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu(null);
              }}
            >
              <div
                className="gantt-context-menu"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                onClick={(e) => e.stopPropagation()}
              >
                {contextMenu.type === 'task' && (
                  <>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        setEditingPanel({
                          type: 'task',
                          sectionIdx: contextMenu.sectionIdx,
                          taskIdx: contextMenu.taskIdx,
                        });
                        setContextMenu(null);
                      }}
                    >
                      编辑任务（含依赖/链接）
                    </button>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        handleToggleTag(contextMenu.sectionIdx, contextMenu.taskIdx, 'done');
                        setContextMenu(null);
                      }}
                    >
                      切换 done
                    </button>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        handleToggleTag(contextMenu.sectionIdx, contextMenu.taskIdx, 'active');
                        setContextMenu(null);
                      }}
                    >
                      切换 active
                    </button>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        handleToggleTag(contextMenu.sectionIdx, contextMenu.taskIdx, 'crit');
                        setContextMenu(null);
                      }}
                    >
                      切换 crit
                    </button>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        handleToggleTag(contextMenu.sectionIdx, contextMenu.taskIdx, 'milestone');
                        setContextMenu(null);
                      }}
                    >
                      切换 milestone
                    </button>
                    <button
                      type="button"
                      className="context-menu-item context-menu-danger"
                      onClick={() => {
                        handleDeleteTask(contextMenu.sectionIdx, contextMenu.taskIdx);
                        setContextMenu(null);
                      }}
                    >
                      删除任务
                    </button>
                  </>
                )}
                {contextMenu.type === 'section' && (
                  <>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        setEditingPanel({ type: 'section', sectionIdx: contextMenu.sectionIdx });
                        setContextMenu(null);
                      }}
                    >
                      编辑区段
                    </button>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        handleAddTask(contextMenu.sectionIdx);
                        setContextMenu(null);
                      }}
                    >
                      添加任务
                    </button>
                    <button
                      type="button"
                      className="context-menu-item context-menu-danger"
                      onClick={() => {
                        handleSectionDeleteRequest(contextMenu.sectionIdx);
                        setContextMenu(null);
                      }}
                    >
                      删除区段
                    </button>
                  </>
                )}
                {contextMenu.type === 'canvas' && (
                  <>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        handleAddSection();
                        setContextMenu(null);
                      }}
                    >
                      添加区段
                    </button>
                    {ganttCanvas.sections.length > 0 && (
                      <button
                        type="button"
                        className="context-menu-item"
                        onClick={() => {
                          handleAddTask(ganttCanvas.sections.length - 1);
                          setContextMenu(null);
                        }}
                      >
                        添加任务到最后区段
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* 删除 section 确认对话框（有任务时询问处理方式） */}
          {deleteSectionConfirm && (() => {
            const { sectionIdx } = deleteSectionConfirm;
            const section = ganttCanvas.sections[sectionIdx];
            if (!section) return null;
            const otherSections = ganttCanvas.sections.filter((_, si) => si !== sectionIdx);
            return (
              <div
                className="specialized-edit-overlay"
                onClick={() => setDeleteSectionConfirm(null)}
              >
                <div
                  className="specialized-edit-dialog"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                >
                  <h3 className="type-switch-title">删除区段确认</h3>
                  <p>
                    区段「{section.name}」包含 {section.tasks.length} 个任务，
                    请选择任务处理方式：
                  </p>
                  <div className="specialized-edit-actions">
                    <button
                      type="button"
                      className="toolbar-btn panel-btn-danger"
                      onClick={() => {
                        handleSectionDelete(sectionIdx);
                        setDeleteSectionConfirm(null);
                      }}
                    >
                      递归删除任务
                    </button>
                    {otherSections.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="toolbar-btn"
                        onClick={() => {
                          const targetIdx = ganttCanvas.sections.indexOf(s);
                          handleSectionDeleteAndMerge(sectionIdx, targetIdx);
                          setDeleteSectionConfirm(null);
                        }}
                      >
                        提升到「{s.name}」
                      </button>
                    ))}
                    <button
                      type="button"
                      className="toolbar-btn"
                      onClick={() => setDeleteSectionConfirm(null)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </SpecializedShell>
  );
}

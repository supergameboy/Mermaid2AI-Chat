/**
 * GanttTaskPanel — Gantt 任务属性编辑面板
 *
 * 单一职责：编辑 GanttTask 的各项属性（名称、标签、ID、日期、依赖、时长、链接）
 *
 * 数据流:
 *   GanttTask → GanttTaskPanel → onChange(Partial<GanttTask>) → 更新 CanvasState.sections[].tasks[]
 *
 * 字段约定（对应官方 gantt 语法）:
 *   - label: string              — 任务名称
 *   - tags?: string[]            — 任务标签（done/active/crit/milestone）
 *   - id?: string               — 任务 ID（用于依赖引用）
 *   - startDate?: string         — 开始日期
 *   - dependencies?: string[]   — 依赖任务 ID 列表（对应 after t1 t2 语法）
 *   - duration?: string         — 持续时长（如 7d, 1w）
 *   - endDate?: string          — 结束日期（可选）
 *   - clickUrl?: string         — 点击链接（对应 click href 语法）
 */

import { memo } from 'react';
import type { GanttTask } from '@mermaid2aichat/serializer';

// ============================================================
// 常量
// ============================================================

/** Gantt 任务标签选项（对应官方语法关键字） */
const TAG_OPTIONS: ReadonlyArray<{ readonly value: string; readonly label: string }> = [
  { value: 'done', label: 'done 已完成' },
  { value: 'active', label: 'active 进行中' },
  { value: 'crit', label: 'crit 关键任务' },
  { value: 'milestone', label: 'milestone 里程碑' },
];

// ============================================================
// 类型
// ============================================================

export interface GanttTaskPanelProps {
  /** 当前编辑的任务 */
  task: GanttTask;
  /** 所有任务列表（用于选择依赖任务，对应 after t1 t2 语法） */
  allTasks: GanttTask[];
  /** 更新回调，传入部分字段 */
  onChange: (updates: Partial<GanttTask>) => void;
  /** 删除当前任务 */
  onDelete: () => void;
}

// ============================================================
// 组件
// ============================================================

/** Gantt 任务属性编辑面板组件 */
export const GanttTaskPanel = memo(function GanttTaskPanel({
  task,
  allTasks,
  onChange,
  onDelete,
}: GanttTaskPanelProps) {
  const tags = task.tags ?? [];
  const dependencies = task.dependencies ?? [];

  /** 可选为依赖的任务（排除自身和无 ID 任务，使用类型谓词确保 id 为 string） */
  const dependencyOptions = allTasks.filter(
    (t): t is GanttTask & { id: string } =>
      t.id !== undefined && t.id !== task.id
  );

  /** 切换标签选中状态 */
  const handleToggleTag = (tag: string) => {
    const next = tags.includes(tag)
      ? tags.filter((t) => t !== tag)
      : [...tags, tag];
    onChange({ tags: next.length > 0 ? next : undefined });
  };

  /** 切换依赖任务选中状态 */
  const handleToggleDependency = (taskId: string) => {
    const next = dependencies.includes(taskId)
      ? dependencies.filter((id) => id !== taskId)
      : [...dependencies, taskId];
    onChange({ dependencies: next.length > 0 ? next : undefined });
  };

  return (
    <div className="panel-content">
      {/* 任务名称 */}
      <label className="panel-label">
        任务名称
        <input
          className="panel-input"
          type="text"
          value={task.label}
          placeholder="如: 需求分析"
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </label>

      {/* 任务 ID */}
      <label className="panel-label">
        任务 ID
        <input
          className="panel-input"
          type="text"
          value={task.id ?? ''}
          placeholder="如: t1（用于依赖引用）"
          onChange={(e) => onChange({ id: e.target.value || undefined })}
        />
      </label>

      {/* 标签（多选） */}
      <div className="panel-label">
        标签
        <div className="panel-checkbox-group">
          {TAG_OPTIONS.map((opt) => (
            <label key={opt.value} className="panel-checkbox-item">
              <input
                type="checkbox"
                checked={tags.includes(opt.value)}
                onChange={() => handleToggleTag(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* 开始日期 */}
      <label className="panel-label">
        开始日期
        <input
          className="panel-input"
          type="date"
          value={task.startDate ?? ''}
          onChange={(e) => onChange({ startDate: e.target.value || undefined })}
        />
      </label>

      {/* 持续时长 */}
      <label className="panel-label">
        持续时长
        <input
          className="panel-input"
          type="text"
          value={task.duration ?? ''}
          placeholder="如: 7d, 1w, 2w"
          onChange={(e) => onChange({ duration: e.target.value || undefined })}
        />
      </label>

      {/* 结束日期（可选） */}
      <label className="panel-label">
        结束日期（可选）
        <input
          className="panel-input"
          type="date"
          value={task.endDate ?? ''}
          onChange={(e) => onChange({ endDate: e.target.value || undefined })}
        />
      </label>

      {/* 依赖任务（多选，对应 after t1 t2 语法） */}
      <div className="panel-label">
        依赖任务（after 语法）
        <div className="panel-checkbox-group">
          {dependencyOptions.map((t) => (
            <label key={t.id} className="panel-checkbox-item">
              <input
                type="checkbox"
                checked={dependencies.includes(t.id)}
                onChange={() => handleToggleDependency(t.id)}
              />
              {t.label}
            </label>
          ))}
          {dependencyOptions.length === 0 && (
            <span style={{ fontSize: '12px', color: '#999' }}>
              暂无可依赖的任务（需先为其他任务设置 ID）
            </span>
          )}
        </div>
      </div>

      {/* 点击链接（对应 click href 语法） */}
      <label className="panel-label">
        点击链接（click href）
        <input
          className="panel-input"
          type="url"
          value={task.clickUrl ?? ''}
          placeholder="https://example.com"
          onChange={(e) => onChange({ clickUrl: e.target.value || undefined })}
        />
      </label>

      {/* 删除按钮 */}
      <button className="panel-btn panel-btn-danger" onClick={onDelete}>
        删除任务
      </button>
    </div>
  );
});

GanttTaskPanel.displayName = 'GanttTaskPanel';

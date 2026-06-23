/**
 * GanttSectionPanel — Gantt 区段编辑面板
 *
 * 单一职责：编辑 GanttSection 的名称、删除区段、添加任务到区段
 *
 * 数据流:
 *   GanttSection → GanttSectionPanel → onRename/onDelete/onAddTask → 更新 CanvasState.sections[]
 *
 * 字段约定:
 *   - name: string        — 区段名称（对应 section 语法）
 *   - tasks: GanttTask[] — 区段下任务列表（只读展示数量，新增通过 onAddTask 触发）
 */

import { memo, useState, useEffect } from 'react';
import type { GanttSection } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

export interface GanttSectionPanelProps {
  /** 当前编辑的区段 */
  section: GanttSection;
  /** 重命名区段 */
  onRename: (name: string) => void;
  /** 删除区段 */
  onDelete: () => void;
  /** 添加任务到区段 */
  onAddTask: () => void;
}

// ============================================================
// 组件
// ============================================================

/** Gantt 区段编辑面板组件 */
export const GanttSectionPanel = memo(function GanttSectionPanel({
  section,
  onRename,
  onDelete,
  onAddTask,
}: GanttSectionPanelProps) {
  const [name, setName] = useState(section.name);

  // 同步外部更新
  useEffect(() => {
    setName(section.name);
  }, [section.name]);

  /** 提交重命名（失焦或回车时触发，避免每次按键都更新） */
  const handleCommitRename = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== section.name) {
      onRename(trimmed);
    } else if (!trimmed) {
      // 空名称回退为原值
      setName(section.name);
    }
  };

  return (
    <div className="panel-content">
      {/* 区段名称 */}
      <label className="panel-label">
        区段名称
        <input
          className="panel-input"
          type="text"
          value={name}
          placeholder="如: 开发阶段"
          onChange={(e) => setName(e.target.value)}
          onBlur={handleCommitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCommitRename();
            }
          }}
        />
      </label>

      {/* 任务数量（只读信息） */}
      <div className="panel-info">
        <span className="info-label">任务数量:</span>
        <span className="info-value">{section.tasks.length}</span>
      </div>

      {/* 添加任务按钮 */}
      <button className="panel-btn" onClick={onAddTask}>
        添加任务
      </button>

      {/* 删除区段按钮 */}
      <button className="panel-btn panel-btn-danger" onClick={onDelete}>
        删除区段
      </button>
    </div>
  );
});

GanttSectionPanel.displayName = 'GanttSectionPanel';

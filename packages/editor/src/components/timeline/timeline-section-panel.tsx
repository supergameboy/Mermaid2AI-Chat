/**
 * TimelineSectionPanel — Section 属性编辑面板
 *
 * 单一职责：编辑 TimelineSection 的 name，支持重命名和删除 section
 *
 * 数据流:
 *   TimelineSection → TimelineSectionPanel → onRename(name)/onDelete → 更新 CanvasState
 */

import { memo, useState, useEffect } from 'react';
import type { TimelineSection } from '@mermaid2aichat/serializer';

export interface TimelineSectionPanelProps {
  /** 当前编辑的 section */
  section: TimelineSection;
  /** 重命名回调 */
  onRename: (name: string) => void;
  /** 删除当前 section */
  onDelete: () => void;
}

export const TimelineSectionPanel = memo(function TimelineSectionPanel({
  section,
  onRename,
  onDelete,
}: TimelineSectionPanelProps) {
  // 本地状态用于受控输入，避免每次按键都触发 CanvasState 更新
  const [name, setName] = useState(section.name ?? '');

  // 切换编辑目标时同步本地状态
  useEffect(() => {
    setName(section.name ?? '');
  }, [section]);

  /** 确认重命名：将本地状态提交到 CanvasState */
  const handleConfirm = () => {
    onRename(name);
  };

  return (
    <div className="timeline-section-panel">
      <div className="panel-header">
        <h3 className="panel-title">区段属性</h3>
      </div>

      <div className="panel-body">
        <label className="panel-label">
          区段名称
          <input
            className="panel-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="区段名称（留空表示默认区段）"
          />
        </label>
      </div>

      <div className="panel-actions">
        <button
          type="button"
          className="toolbar-btn panel-confirm-btn"
          onClick={handleConfirm}
        >
          确认
        </button>
        <button
          type="button"
          className="toolbar-btn panel-delete-btn"
          onClick={onDelete}
        >
          删除区段
        </button>
      </div>
    </div>
  );
});

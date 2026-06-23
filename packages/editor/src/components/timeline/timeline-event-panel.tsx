/**
 * TimelineEventPanel — 事件属性编辑面板
 *
 * 单一职责：编辑 TimelineEvent 的 label，支持删除事件
 *
 * 数据流:
 *   TimelineEvent → TimelineEventPanel → onChange(Partial<TimelineEvent>) → 更新 CanvasState
 */

import { memo, useState, useEffect } from 'react';
import type { TimelineEvent } from '@mermaid2aichat/serializer';

export interface TimelineEventPanelProps {
  /** 当前编辑的事件 */
  event: TimelineEvent;
  /** 更新回调，传入部分字段 */
  onChange: (updates: Partial<TimelineEvent>) => void;
  /** 删除当前事件 */
  onDelete: () => void;
}

export const TimelineEventPanel = memo(function TimelineEventPanel({
  event,
  onChange,
  onDelete,
}: TimelineEventPanelProps) {
  // 本地状态用于受控输入，避免每次按键都触发 CanvasState 更新
  const [label, setLabel] = useState(event.label);

  // 切换编辑目标时同步本地状态
  useEffect(() => {
    setLabel(event.label);
  }, [event]);

  /** 确认编辑：将本地状态提交到 CanvasState */
  const handleConfirm = () => {
    onChange({ label });
  };

  return (
    <div className="timeline-event-panel">
      <div className="panel-header">
        <h3 className="panel-title">事件属性</h3>
      </div>

      <div className="panel-body">
        <label className="panel-label">
          标签
          <input
            className="panel-input"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="事件标签"
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
          删除事件
        </button>
      </div>
    </div>
  );
});

/**
 * TimelinePeriodPanel — 时间段属性编辑面板
 *
 * 单一职责：编辑 TimelinePeriod 的 label，支持删除时间段
 *
 * 数据流:
 *   TimelinePeriod → TimelinePeriodPanel → onChange(Partial<TimelinePeriod>) → 更新 CanvasState
 *
 * 注意: TimelinePeriod 数据模型只有 label 和 events（types.ts 定义），
 *       score 是 DB 内部字段，不在此面板编辑（官方 jison 传 0，未使用）。
 */

import { memo, useState, useEffect } from 'react';
import type { TimelinePeriod } from '@mermaid2aichat/serializer';

export interface TimelinePeriodPanelProps {
  /** 当前编辑的时间段 */
  period: TimelinePeriod;
  /** 更新回调，传入部分字段 */
  onChange: (updates: Partial<TimelinePeriod>) => void;
  /** 删除当前时间段 */
  onDelete: () => void;
}

export const TimelinePeriodPanel = memo(function TimelinePeriodPanel({
  period,
  onChange,
  onDelete,
}: TimelinePeriodPanelProps) {
  // 本地状态用于受控输入，避免每次按键都触发 CanvasState 更新
  const [label, setLabel] = useState(period.label);

  // 切换编辑目标时同步本地状态
  useEffect(() => {
    setLabel(period.label);
  }, [period]);

  /** 确认编辑：将本地状态提交到 CanvasState */
  const handleConfirm = () => {
    onChange({ label });
  };

  return (
    <div className="timeline-period-panel">
      <div className="panel-header">
        <h3 className="panel-title">时间段属性</h3>
      </div>

      <div className="panel-body">
        <label className="panel-label">
          标签
          <input
            className="panel-input"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="时间段标签"
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
          删除时间段
        </button>
      </div>
    </div>
  );
});

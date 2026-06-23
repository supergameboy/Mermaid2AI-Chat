/**
 * PieSlicePanel — 饼图切片属性编辑面板
 *
 * 单一职责：编辑 PieSlice 的 label 和 value，支持删除切片
 *
 * 数据流:
 *   PieSlice → PieSlicePanel → onChange(Partial<PieSlice>) → 更新 CanvasState.slices[]
 *
 * 注意: PieSlice 数据模型只有 label 和 value（types.ts 定义），
 *       color 由渲染器按索引分配（PIE_COLORS 数组），不在此面板编辑。
 */

import { memo, useState, useEffect } from 'react';
import type { PieSlice } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

export interface PieSlicePanelProps {
  /** 当前编辑的切片 */
  slice: PieSlice;
  /** 更新回调，传入部分字段 */
  onChange: (updates: Partial<PieSlice>) => void;
  /** 删除当前切片 */
  onDelete: () => void;
}

// ============================================================
// 组件
// ============================================================

/** 饼图切片属性编辑面板组件 */
export const PieSlicePanel = memo(function PieSlicePanel({
  slice,
  onChange,
  onDelete,
}: PieSlicePanelProps) {
  // 本地状态用于受控输入，避免每次按键都触发 CanvasState 更新
  const [label, setLabel] = useState(slice.label);
  const [value, setValue] = useState(String(slice.value));

  // 切片切换时同步本地状态
  useEffect(() => {
    setLabel(slice.label);
    setValue(String(slice.value));
  }, [slice]);

  /** 确认编辑：将本地状态提交到 CanvasState */
  const handleConfirm = () => {
    const numValue = parseFloat(value);
    const updates: Partial<PieSlice> = { label };
    if (!isNaN(numValue) && numValue >= 0) {
      updates.value = numValue;
    }
    onChange(updates);
  };

  return (
    <div className="pie-slice-panel">
      <div className="panel-header">
        <h3 className="panel-title">切片属性</h3>
      </div>

      <div className="panel-body">
        <label className="panel-label">
          标签
          <input
            className="panel-input"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="切片标签"
          />
        </label>

        <label className="panel-label">
          数值
          <input
            className="panel-input"
            type="number"
            min="0"
            step="0.1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="数值（非负）"
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
          删除切片
        </button>
      </div>
    </div>
  );
});

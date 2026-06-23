/**
 * XYChartSeriesPanel — 数据系列编辑面板
 *
 * 单一职责：编辑 XYSeries 的 name/type/data/color，删除系列
 *
 * 数据流:
 *   XYSeries → XYChartSeriesPanel → onChange(Partial<XYSeries>) → 更新 CanvasState.series[]
 */

import { memo, useState, useEffect } from 'react';
import type { XYSeries, StateClassDefInfo } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

export interface XYChartSeriesPanelProps {
  /** 当前编辑的数据系列 */
  plot: XYSeries;
  /** 可用的 classDef 列表（用于 className 下拉选择） */
  classes: StateClassDefInfo[];
  /** 更新回调，传入部分字段 */
  onChange: (updates: Partial<XYSeries>) => void;
  /** 删除当前系列 */
  onDelete: () => void;
}

// ============================================================
// 组件
// ============================================================

/** 数据系列编辑面板组件 */
export const XYChartSeriesPanel = memo(function XYChartSeriesPanel({
  plot,
  classes,
  onChange,
  onDelete,
}: XYChartSeriesPanelProps) {
  // 本地状态用于受控输入
  const [name, setName] = useState(plot.name ?? '');
  const [type, setType] = useState<XYSeries['type']>(plot.type);
  const [dataStr, setDataStr] = useState(plot.data.join(', '));
  const [color, setColor] = useState(plot.color ?? '#ECECEC');
  const [className, setClassName] = useState(plot.className ?? '');

  // 系列切换时同步本地状态
  useEffect(() => {
    setName(plot.name ?? '');
    setType(plot.type);
    setDataStr(plot.data.join(', '));
    setColor(plot.color ?? '#ECECEC');
    setClassName(plot.className ?? '');
  }, [plot]);

  /** 确认编辑：将本地状态提交到 CanvasState */
  const handleConfirm = () => {
    // 解析数据数组（支持逗号或空格分隔）
    const data = dataStr
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => parseFloat(s))
      .filter((n) => !Number.isNaN(n));

    const updates: Partial<XYSeries> = {
      type,
      data,
      color,
      name: name || undefined,
      className: className || undefined,
    };

    onChange(updates);
  };

  return (
    <div className="xychart-series-panel">
      <div className="panel-header">
        <h3 className="panel-title">数据系列属性</h3>
      </div>

      <div className="panel-body">
        <label className="panel-label">
          系列名称（可选）
          <input
            className="panel-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如 Sales"
          />
        </label>

        <label className="panel-label">
          类型
          <select
            className="panel-input"
            value={type}
            onChange={(e) => setType(e.target.value as XYSeries['type'])}
          >
            <option value="line">折线图（line）</option>
            <option value="bar">柱状图（bar）</option>
          </select>
        </label>

        <label className="panel-label">
          数据（逗号分隔）
          <textarea
            className="panel-textarea"
            value={dataStr}
            onChange={(e) => setDataStr(e.target.value)}
            placeholder="如 10, 20, 30"
            rows={3}
          />
        </label>

        <label className="panel-label">
          颜色
          <input
            className="panel-input"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </label>

        <label className="panel-label">
          样式类（className）
          <select
            className="panel-input"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
          >
            <option value="">无</option>
            {classes.map((cls) => (
              <option key={cls.name} value={cls.name}>
                {cls.name}
              </option>
            ))}
          </select>
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
          删除系列
        </button>
      </div>
    </div>
  );
});

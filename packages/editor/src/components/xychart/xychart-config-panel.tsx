/**
 * XYChartConfigPanel — 图表配置面板
 *
 * 单一职责：编辑 XYChartCanvasState 的图表级配置
 *   - title/accTitle/accDescription
 *   - xAxis（type/title/categories 或 min-max）
 *   - yAxis（title/min-max，强制 linear）
 *   - orientation（vertical/horizontal）
 *   - showDataLabel
 *   - plotColorPalette
 *
 * 数据流:
 *   XYChartCanvasState → XYChartConfigPanel → onChange(Partial<XYChartCanvasState>) → 更新 CanvasState
 */

import { memo, useState, useEffect } from 'react';
import type { XYChartCanvasState, XYAxis } from '@mermaid2aichat/serializer';
import { DEFAULT_PLOT_COLOR_PALETTE_STR } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

export interface XYChartConfigPanelProps {
  /** 当前画布配置 */
  config: XYChartCanvasState;
  /** 更新回调，传入部分字段 */
  onChange: (updates: Partial<XYChartCanvasState>) => void;
}

// ============================================================
// 组件
// ============================================================

/** 图表配置面板组件 */
export const XYChartConfigPanel = memo(function XYChartConfigPanel({
  config,
  onChange,
}: XYChartConfigPanelProps) {
  // 本地状态用于受控输入
  const [title, setTitle] = useState(config.title ?? '');
  const [accTitle, setAccTitle] = useState(config.accTitle ?? '');
  const [accDescription, setAccDescription] = useState(config.accDescription ?? '');
  const [orientation, setOrientation] = useState(config.orientation ?? 'vertical');
  const [showDataLabel, setShowDataLabel] = useState(config.showDataLabel ?? false);
  const [plotColorPalette, setPlotColorPalette] = useState(
    config.plotColorPalette ?? DEFAULT_PLOT_COLOR_PALETTE_STR
  );

  // x-axis
  const [xAxisType, setXAxisType] = useState<XYAxis['type']>(config.xAxis.type);
  const [xAxisTitle, setXAxisTitle] = useState(config.xAxis.title ?? '');
  const [xAxisCategories, setXAxisCategories] = useState(
    config.xAxis.categories?.join(', ') ?? ''
  );
  const [xAxisMin, setXAxisMin] = useState(String(config.xAxis.min ?? 0));
  const [xAxisMax, setXAxisMax] = useState(String(config.xAxis.max ?? 100));

  // y-axis（强制 linear）
  const [yAxisTitle, setYAxisTitle] = useState(config.yAxis.title ?? '');
  const [yAxisMin, setYAxisMin] = useState(String(config.yAxis.min ?? 0));
  const [yAxisMax, setYAxisMax] = useState(String(config.yAxis.max ?? 100));

  // 配置变化时同步本地状态
  useEffect(() => {
    setTitle(config.title ?? '');
    setAccTitle(config.accTitle ?? '');
    setAccDescription(config.accDescription ?? '');
    setOrientation(config.orientation ?? 'vertical');
    setShowDataLabel(config.showDataLabel ?? false);
    setPlotColorPalette(config.plotColorPalette ?? DEFAULT_PLOT_COLOR_PALETTE_STR);
    setXAxisType(config.xAxis.type);
    setXAxisTitle(config.xAxis.title ?? '');
    setXAxisCategories(config.xAxis.categories?.join(', ') ?? '');
    setXAxisMin(String(config.xAxis.min ?? 0));
    setXAxisMax(String(config.xAxis.max ?? 100));
    setYAxisTitle(config.yAxis.title ?? '');
    setYAxisMin(String(config.yAxis.min ?? 0));
    setYAxisMax(String(config.yAxis.max ?? 100));
  }, [config]);

  /** 确认编辑：将本地状态提交到 CanvasState */
  const handleConfirm = () => {
    // 构建 x-axis
    let xAxis: XYAxis;
    if (xAxisType === 'band') {
      const categories = xAxisCategories
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      xAxis = { type: 'band', categories };
      if (xAxisTitle) xAxis.title = xAxisTitle;
    } else {
      xAxis = {
        type: 'linear',
        min: parseFloat(xAxisMin) || 0,
        max: parseFloat(xAxisMax) || 100,
      };
      if (xAxisTitle) xAxis.title = xAxisTitle;
    }

    // 构建 y-axis（强制 linear）
    const yAxis: XYAxis = {
      type: 'linear',
      min: parseFloat(yAxisMin) || 0,
      max: parseFloat(yAxisMax) || 100,
    };
    if (yAxisTitle) yAxis.title = yAxisTitle;

    onChange({
      title: title || undefined,
      accTitle: accTitle || undefined,
      accDescription: accDescription || undefined,
      orientation: orientation === 'horizontal' ? 'horizontal' : undefined,
      showDataLabel: showDataLabel || undefined,
      plotColorPalette: plotColorPalette !== DEFAULT_PLOT_COLOR_PALETTE_STR ? plotColorPalette : undefined,
      xAxis,
      yAxis,
    });
  };

  return (
    <div className="xychart-config-panel">
      <div className="panel-header">
        <h3 className="panel-title">图表配置</h3>
      </div>

      <div className="panel-body">
        <label className="panel-label">
          标题
          <input
            className="panel-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="图表标题"
          />
        </label>

        <label className="panel-label">
          无障碍标题（accTitle）
          <input
            className="panel-input"
            type="text"
            value={accTitle}
            onChange={(e) => setAccTitle(e.target.value)}
            placeholder="无障碍标题"
          />
        </label>

        <label className="panel-label">
          无障碍描述（accDescription）
          <textarea
            className="panel-textarea"
            value={accDescription}
            onChange={(e) => setAccDescription(e.target.value)}
            placeholder="无障碍描述"
            rows={2}
          />
        </label>

        <div className="panel-row">
          <label className="panel-label">
            方向
            <select
              className="panel-input"
              value={orientation}
              onChange={(e) => setOrientation(e.target.value as 'vertical' | 'horizontal')}
            >
              <option value="vertical">垂直（vertical）</option>
              <option value="horizontal">水平（horizontal）</option>
            </select>
          </label>
          <label className="panel-label">
            显示数据标签
            <select
              className="panel-input"
              value={showDataLabel ? 'true' : 'false'}
              onChange={(e) => setShowDataLabel(e.target.value === 'true')}
            >
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
        </div>

        <label className="panel-label">
          调色板（plotColorPalette）
          <textarea
            className="panel-textarea"
            value={plotColorPalette}
            onChange={(e) => setPlotColorPalette(e.target.value)}
            placeholder="如 #FF0000, #00FF00, #0000FF"
            rows={2}
          />
        </label>

        <div className="panel-section-title">X 轴</div>
        <label className="panel-label">
          类型
          <select
            className="panel-input"
            value={xAxisType}
            onChange={(e) => setXAxisType(e.target.value as XYAxis['type'])}
          >
            <option value="band">类别（band）</option>
            <option value="linear">数值范围（linear）</option>
          </select>
        </label>
        <label className="panel-label">
          标题
          <input
            className="panel-input"
            type="text"
            value={xAxisTitle}
            onChange={(e) => setXAxisTitle(e.target.value)}
            placeholder="如 Months"
          />
        </label>
        {xAxisType === 'band' ? (
          <label className="panel-label">
            类别（逗号分隔）
            <input
              className="panel-input"
              type="text"
              value={xAxisCategories}
              onChange={(e) => setXAxisCategories(e.target.value)}
              placeholder="如 jan, feb, mar"
            />
          </label>
        ) : (
          <div className="panel-row">
            <label className="panel-label">
              最小值
              <input
                className="panel-input"
                type="number"
                step="any"
                value={xAxisMin}
                onChange={(e) => setXAxisMin(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="panel-label">
              最大值
              <input
                className="panel-input"
                type="number"
                step="any"
                value={xAxisMax}
                onChange={(e) => setXAxisMax(e.target.value)}
                placeholder="100"
              />
            </label>
          </div>
        )}

        <div className="panel-section-title">Y 轴（仅 linear）</div>
        <label className="panel-label">
          标题
          <input
            className="panel-input"
            type="text"
            value={yAxisTitle}
            onChange={(e) => setYAxisTitle(e.target.value)}
            placeholder="如 Sales"
          />
        </label>
        <div className="panel-row">
          <label className="panel-label">
            最小值
            <input
              className="panel-input"
              type="number"
              step="any"
              value={yAxisMin}
              onChange={(e) => setYAxisMin(e.target.value)}
              placeholder="0"
            />
          </label>
          <label className="panel-label">
            最大值
            <input
              className="panel-input"
              type="number"
              step="any"
              value={yAxisMax}
              onChange={(e) => setYAxisMax(e.target.value)}
              placeholder="100"
            />
          </label>
        </div>
      </div>

      <div className="panel-actions">
        <button
          type="button"
          className="toolbar-btn panel-confirm-btn"
          onClick={handleConfirm}
        >
          确认
        </button>
      </div>
    </div>
  );
});

/**
 * XYChartRenderer — 坐标图渲染器
 *
 * 单一职责：将 XYChartCanvasState 渲染为 SVG 坐标图，提供完整编辑功能
 *
 * 功能:
 * - SVG 坐标轴渲染（band/linear x-axis + linear y-axis）
 * - 根据 series.type 绘制折线图或柱状图
 * - 支持 chartOrientation（vertical/horizontal 坐标轴交换）
 * - 支持 showDataLabel（显示数据标签）
 * - 支持多系列颜色分配（series.color）
 * - 拖拽数据点 → 更新 data 值 → onCanvasUpdate
 * - 双击数据点 → 打开 XYChartSeriesPanel
 * - 右键系列 → 上下文菜单 → 删除
 * - 右键画布 → 上下文菜单 → 添加 line/bar 系列
 * - 点击配置按钮 → 打开 XYChartConfigPanel
 *
 * 数据流:
 *   XYChartCanvasState → XYChartRenderer → SVG 坐标图 + 编辑面板
 *   用户编辑 → onCanvasUpdate(XYChartCanvasState) → 外部同步
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { MouseEvent, ReactElement } from 'react';
import type { XYChartCanvasState, XYSeries } from '@mermaid2aichat/serializer';
import { DEFAULT_PLOT_COLOR_PALETTE, formatDataValue } from '@mermaid2aichat/serializer';
import { SpecializedShell } from './shared/specialized-shell.js';
import { createLinearScale } from './shared/chart-layout.js';
import type { XYChartRendererProps } from './types.js';
import { XYChartSeriesPanel } from '../components/xychart/xychart-series-panel.js';
import { XYChartConfigPanel } from '../components/xychart/xychart-config-panel.js';

// ============================================================
// 常量
// ============================================================

const SVG_WIDTH = 600;
const SVG_HEIGHT = 400;
const PADDING_LEFT = 60;
const PADDING_RIGHT = 40;
const PADDING_TOP = 40;
const PADDING_BOTTOM = 50;

const CHART_WIDTH = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const CHART_HEIGHT = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

const DEFAULT_POINT_RADIUS = 4;

// ============================================================
// 右键菜单状态
// ============================================================

interface ContextMenuState {
  x: number;
  y: number;
  /** 系列索引（null 表示右键空白画布） */
  seriesIdx: number | null;
}

// ============================================================
// 组件
// ============================================================

export function XYChartRenderer(props: XYChartRendererProps): ReactElement {
  const { syncCanvas, onCanvasUpdate, ...shellProps } = props;

  // 选中系列索引（打开编辑面板）
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  // 是否显示配置面板
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  // 拖拽状态
  const [draggingIdx, setDraggingIdx] = useState<{ seriesIdx: number; pointIdx: number } | null>(null);
  // SVG 引用
  const svgRef = useRef<SVGSVGElement>(null);

  const { xAxis, yAxis, series, orientation, showDataLabel } = syncCanvas;
  const isHorizontal = orientation === 'horizontal';

  // 外部更新 series 后，selectedIdx 可能越界
  useEffect(() => {
    if (selectedIdx !== null && selectedIdx >= series.length) {
      setSelectedIdx(null);
    }
  }, [series.length, selectedIdx]);

  // ============================================================
  // 坐标计算
  // ============================================================

  /** 计算数据点数量（用于 band 轴定位） */
  const dataPointCount = useMemo(() => {
    if (series.length === 0) return 0;
    return Math.max(...series.map((s) => s.data.length));
  }, [series]);

  /** x-axis 范围 */
  const xDomain = useMemo(() => {
    if (xAxis.type === 'band') {
      return { min: 0, max: Math.max(0, dataPointCount - 1) };
    }
    return { min: xAxis.min ?? 0, max: xAxis.max ?? 100 };
  }, [xAxis, dataPointCount]);

  /** y-axis 范围 */
  const yDomain = useMemo(() => {
    return { min: yAxis.min ?? 0, max: yAxis.max ?? 100 };
  }, [yAxis]);

  /**
   * 比例函数（根据 orientation 选择）
   * - vertical: x 轴水平（categories 沿 x），y 轴垂直（values 沿 y）
   * - horizontal: x 轴垂直（categories 沿 y），y 轴水平（values 沿 x）— 坐标轴交换
   */
  const scales = useMemo(() => {
    if (isHorizontal) {
      // 坐标轴交换：values 沿 x 轴，categories 沿 y 轴
      const valueScale = createLinearScale(
        yDomain.min, yDomain.max,
        PADDING_LEFT, PADDING_LEFT + CHART_WIDTH
      );
      const categoryScale = createLinearScale(
        xDomain.min, xDomain.max,
        PADDING_TOP + CHART_HEIGHT, PADDING_TOP  // y 轴反转
      );
      return { valueScale, categoryScale };
    }
    // vertical（默认）
    const categoryScale = createLinearScale(
      xDomain.min, xDomain.max,
      PADDING_LEFT, PADDING_LEFT + CHART_WIDTH
    );
    const valueScale = createLinearScale(
      yDomain.min, yDomain.max,
      PADDING_TOP + CHART_HEIGHT, PADDING_TOP  // y 轴反转
    );
    return { valueScale, categoryScale };
  }, [isHorizontal, xDomain, yDomain]);

  /** x-axis 刻度 */
  const xTicks = useMemo(() => {
    if (xAxis.type === 'band' && xAxis.categories) {
      return xAxis.categories.map((cat, i) => ({ label: cat, value: i }));
    }
    // linear
    return Array.from({ length: 6 }, (_, i) => {
      const v = xDomain.min + (i / 5) * (xDomain.max - xDomain.min);
      return { label: formatDataValue(v), value: v };
    });
  }, [xAxis, xDomain]);

  /** y-axis 刻度 */
  const yTicks = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const v = yDomain.min + (i / 4) * (yDomain.max - yDomain.min);
      return { label: formatDataValue(v), value: v };
    });
  }, [yDomain]);

  // ============================================================
  // 编辑操作
  // ============================================================

  /** 更新系列 */
  const handleUpdateSeries = useCallback((updates: Partial<XYSeries>) => {
    if (selectedIdx === null) return;
    const newSeries = series.map((s, i) =>
      i === selectedIdx ? { ...s, ...updates } : s
    );
    onCanvasUpdate({ ...syncCanvas, series: newSeries });
  }, [selectedIdx, series, syncCanvas, onCanvasUpdate]);

  /** 删除系列 */
  const handleRemoveSeries = useCallback((idx: number) => {
    const newSeries = series.filter((_, i) => i !== idx);
    onCanvasUpdate({ ...syncCanvas, series: newSeries });
    if (selectedIdx === idx) {
      setSelectedIdx(null);
    } else if (selectedIdx !== null && idx < selectedIdx) {
      setSelectedIdx(selectedIdx - 1);
    }
  }, [series, syncCanvas, onCanvasUpdate, selectedIdx]);

  /** 添加系列 */
  const handleAddSeries = useCallback((type: 'line' | 'bar') => {
    const dataLength = dataPointCount > 0 ? dataPointCount : 5;
    const newSeries: XYSeries = {
      type,
      data: Array.from({ length: dataLength }, () => Math.round(Math.random() * 100)),
      color: DEFAULT_PLOT_COLOR_PALETTE[series.length % DEFAULT_PLOT_COLOR_PALETTE.length],
    };
    onCanvasUpdate({ ...syncCanvas, series: [...series, newSeries] });
  }, [series, syncCanvas, onCanvasUpdate, dataPointCount]);

  /** 更新配置 */
  const handleUpdateConfig = useCallback((updates: Partial<XYChartCanvasState>) => {
    onCanvasUpdate({ ...syncCanvas, ...updates });
  }, [syncCanvas, onCanvasUpdate]);

  // ============================================================
  // 交互处理
  // ============================================================

  /** 数据点点击：选中系列并打开编辑面板 */
  const handlePointClick = useCallback((idx: number) => {
    setSelectedIdx(idx);
    setShowConfigPanel(false);
    setContextMenu(null);
  }, []);

  /** 数据点右键：打开上下文菜单 */
  const handlePointContextMenu = useCallback((e: MouseEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, seriesIdx: idx });
  }, []);

  /** 画布右键：打开上下文菜单（添加系列） */
  const handleCanvasContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, seriesIdx: null });
  }, []);

  /** 关闭右键菜单 */
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  /** 右键菜单：删除系列 */
  const handleContextMenuDelete = useCallback(() => {
    if (contextMenu !== null && contextMenu.seriesIdx !== null) {
      handleRemoveSeries(contextMenu.seriesIdx);
    }
    setContextMenu(null);
  }, [contextMenu, handleRemoveSeries]);

  /** 右键菜单：添加 line 系列 */
  const handleContextMenuAddLine = useCallback(() => {
    handleAddSeries('line');
    setContextMenu(null);
  }, [handleAddSeries]);

  /** 右键菜单：添加 bar 系列 */
  const handleContextMenuAddBar = useCallback(() => {
    handleAddSeries('bar');
    setContextMenu(null);
  }, [handleAddSeries]);

  /** 数据点拖拽开始 */
  const handlePointMouseDown = useCallback((seriesIdx: number, pointIdx: number, e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingIdx({ seriesIdx, pointIdx });
  }, []);

  /** 拖拽中：更新数据值 */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (draggingIdx === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = SVG_WIDTH / rect.width;
    const scaleY = SVG_HEIGHT / rect.height;
    const sx = (e.clientX - rect.left) * scaleX;
    const sy = (e.clientY - rect.top) * scaleY;

    // 根据 orientation 计算新值
    // vertical: 拖拽 y 像素 → 更新 data 值（y 轴是 value 轴）
    // horizontal: 拖拽 x 像素 → 更新 data 值（x 轴是 value 轴）
    let newValue: number;
    if (isHorizontal) {
      // value 沿 x 轴
      const valuePixel = sx;
      const ratio = (valuePixel - PADDING_LEFT) / CHART_WIDTH;
      newValue = yDomain.min + ratio * (yDomain.max - yDomain.min);
    } else {
      // value 沿 y 轴（反转）
      const valuePixel = sy;
      const ratio = (PADDING_TOP + CHART_HEIGHT - valuePixel) / CHART_HEIGHT;
      newValue = yDomain.min + ratio * (yDomain.max - yDomain.min);
    }

    const { seriesIdx, pointIdx } = draggingIdx;
    const newSeries = series.map((s, i) => {
      if (i !== seriesIdx) return s;
      return {
        ...s,
        data: s.data.map((d, j) => (j === pointIdx ? newValue : d)),
      };
    });
    onCanvasUpdate({ ...syncCanvas, series: newSeries });
  }, [draggingIdx, series, syncCanvas, onCanvasUpdate, isHorizontal, yDomain]);

  /** 拖拽结束 */
  const handleMouseUp = useCallback(() => {
    setDraggingIdx(null);
  }, []);

  // 当前选中的系列
  const selectedSeries = selectedIdx !== null ? series[selectedIdx] : null;

  // ============================================================
  // 渲染
  // ============================================================

  /** 渲染坐标轴 */
  const renderAxes = () => {
    if (isHorizontal) {
      // horizontal: value 轴在底部（x 轴），category 轴在左侧（y 轴）
      return (
        <>
          {/* value 轴刻度（底部） */}
          {yTicks.map((tick, i) => {
            const x = scales.valueScale(tick.value);
            return (
              <g key={`y-${i}`}>
                <line x1={x} y1={PADDING_TOP} x2={x} y2={PADDING_TOP + CHART_HEIGHT} stroke="#f0f0f0" strokeWidth={1} />
                <text x={x} y={PADDING_TOP + CHART_HEIGHT + 20} fontSize={11} fill="#999" textAnchor="middle">
                  {tick.label}
                </text>
              </g>
            );
          })}
          {/* category 轴刻度（左侧） */}
          {xTicks.map((tick, i) => {
            const y = scales.categoryScale(tick.value);
            return (
              <g key={`x-${i}`}>
                <text x={PADDING_LEFT - 8} y={y + 4} fontSize={11} fill="#999" textAnchor="end">
                  {tick.label}
                </text>
              </g>
            );
          })}
          {/* 坐标轴线 */}
          <line x1={PADDING_LEFT} y1={PADDING_TOP} x2={PADDING_LEFT} y2={PADDING_TOP + CHART_HEIGHT} stroke="#666" strokeWidth={1.5} />
          <line x1={PADDING_LEFT} y1={PADDING_TOP + CHART_HEIGHT} x2={PADDING_LEFT + CHART_WIDTH} y2={PADDING_TOP + CHART_HEIGHT} stroke="#666" strokeWidth={1.5} />
          {/* 轴标签 */}
          {yAxis.title && (
            <text x={PADDING_LEFT + CHART_WIDTH / 2} y={SVG_HEIGHT - 10} fontSize={12} fill="#666" textAnchor="middle">
              {yAxis.title}
            </text>
          )}
          {xAxis.title && (
            <text x={20} y={PADDING_TOP + CHART_HEIGHT / 2} fontSize={12} fill="#666" textAnchor="middle" transform={`rotate(-90 20 ${PADDING_TOP + CHART_HEIGHT / 2})`}>
              {xAxis.title}
            </text>
          )}
        </>
      );
    }

    // vertical（默认）: category 轴在底部（x 轴），value 轴在左侧（y 轴）
    return (
      <>
        {/* value 轴网格线和刻度（左侧） */}
        {yTicks.map((tick, i) => {
          const y = scales.valueScale(tick.value);
          return (
            <g key={`y-${i}`}>
              <line x1={PADDING_LEFT} y1={y} x2={PADDING_LEFT + CHART_WIDTH} y2={y} stroke="#f0f0f0" strokeWidth={1} />
              <text x={PADDING_LEFT - 8} y={y + 4} fontSize={11} fill="#999" textAnchor="end">
                {tick.label}
              </text>
            </g>
          );
        })}
        {/* category 轴刻度（底部） */}
        {xTicks.map((tick, i) => {
          const x = scales.categoryScale(tick.value);
          return (
            <g key={`x-${i}`}>
              <line x1={x} y1={PADDING_TOP + CHART_HEIGHT} x2={x} y2={PADDING_TOP + CHART_HEIGHT + 5} stroke="#999" strokeWidth={1} />
              <text x={x} y={PADDING_TOP + CHART_HEIGHT + 20} fontSize={11} fill="#999" textAnchor="middle">
                {tick.label}
              </text>
            </g>
          );
        })}
        {/* 坐标轴线 */}
        <line x1={PADDING_LEFT} y1={PADDING_TOP} x2={PADDING_LEFT} y2={PADDING_TOP + CHART_HEIGHT} stroke="#666" strokeWidth={1.5} />
        <line x1={PADDING_LEFT} y1={PADDING_TOP + CHART_HEIGHT} x2={PADDING_LEFT + CHART_WIDTH} y2={PADDING_TOP + CHART_HEIGHT} stroke="#666" strokeWidth={1.5} />
        {/* 轴标签 */}
        {xAxis.title && (
          <text x={PADDING_LEFT + CHART_WIDTH / 2} y={SVG_HEIGHT - 10} fontSize={12} fill="#666" textAnchor="middle">
            {xAxis.title}
          </text>
        )}
        {yAxis.title && (
          <text x={20} y={PADDING_TOP + CHART_HEIGHT / 2} fontSize={12} fill="#666" textAnchor="middle" transform={`rotate(-90 20 ${PADDING_TOP + CHART_HEIGHT / 2})`}>
            {yAxis.title}
          </text>
        )}
      </>
    );
  };

  /** 渲染数据系列 */
  const renderSeries = () => {
    const barCount = series.filter((s) => s.type === 'bar').length;
    let barIdx = 0;

    return series.map((s, si) => {
      const color = s.color ?? DEFAULT_PLOT_COLOR_PALETTE[si % DEFAULT_PLOT_COLOR_PALETTE.length];
      const isSelected = selectedIdx === si;

      if (s.type === 'bar') {
        // 柱状图
        const barWidth = isHorizontal
          ? CHART_HEIGHT / s.data.length / (barCount + 1)
          : CHART_WIDTH / s.data.length / (barCount + 1);
        const currentBarIdx = barIdx++;

        return (
          <g key={`series-${si}`}>
            {s.data.map((value, pi) => {
              const categoryPos = scales.categoryScale(pi);
              const valuePos = scales.valueScale(value);

              let x: number, y: number, w: number, h: number;
              if (isHorizontal) {
                // horizontal: bar 从左向右生长，沿 y 轴排列
                x = PADDING_LEFT;
                y = categoryPos + currentBarIdx * barWidth;
                w = Math.max(0, valuePos - PADDING_LEFT);
                h = Math.max(0, barWidth - 2);
              } else {
                // vertical: bar 从下向上生长，沿 x 轴排列
                x = categoryPos + currentBarIdx * barWidth;
                y = valuePos;
                w = Math.max(0, barWidth - 2);
                h = Math.max(0, PADDING_TOP + CHART_HEIGHT - valuePos);
              }

              return (
                <rect
                  key={`bar-${si}-${pi}`}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill={color}
                  opacity={isSelected ? 1 : 0.85}
                  onClick={() => handlePointClick(si)}
                  onContextMenu={(e) => handlePointContextMenu(e, si)}
                  onMouseDown={(e) => handlePointMouseDown(si, pi, e)}
                  style={{ cursor: 'pointer' }}
                >
                  {showDataLabel && (
                    <title>{formatDataValue(value)}</title>
                  )}
                </rect>
              );
            })}
            {/* showDataLabel: 显示数据标签 */}
            {showDataLabel && s.data.map((value, pi) => {
              const categoryPos = scales.categoryScale(pi);
              const valuePos = scales.valueScale(value);
              const labelX = isHorizontal ? valuePos + 5 : categoryPos;
              const labelY = isHorizontal ? categoryPos + 4 : valuePos - 5;
              return (
                <text
                  key={`label-${si}-${pi}`}
                  x={labelX}
                  y={labelY}
                  fontSize={10}
                  fill="#666"
                  textAnchor={isHorizontal ? 'start' : 'middle'}
                >
                  {formatDataValue(value)}
                </text>
              );
            })}
          </g>
        );
      }

      // 折线图
      const points = s.data.map((value, pi) => {
        const categoryPos = scales.categoryScale(pi);
        const valuePos = scales.valueScale(value);
        if (isHorizontal) {
          return `${valuePos},${categoryPos}`;
        }
        return `${categoryPos},${valuePos}`;
      }).join(' ');

      return (
        <g key={`series-${si}`}>
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={2}
            opacity={isSelected ? 1 : 0.85}
          />
          {s.data.map((value, pi) => {
            const categoryPos = scales.categoryScale(pi);
            const valuePos = scales.valueScale(value);
            const cx = isHorizontal ? valuePos : categoryPos;
            const cy = isHorizontal ? categoryPos : valuePos;
            return (
              <circle
                key={`point-${si}-${pi}`}
                cx={cx}
                cy={cy}
                r={DEFAULT_POINT_RADIUS}
                fill={color}
                stroke="#fff"
                strokeWidth={1.5}
                onClick={() => handlePointClick(si)}
                onContextMenu={(e) => handlePointContextMenu(e, si)}
                onMouseDown={(e) => handlePointMouseDown(si, pi, e)}
                style={{ cursor: draggingIdx?.seriesIdx === si && draggingIdx?.pointIdx === pi ? 'grabbing' : 'grab' }}
              >
                {showDataLabel && (
                  <title>{formatDataValue(value)}</title>
                )}
              </circle>
            );
          })}
          {/* showDataLabel: 显示数据标签 */}
          {showDataLabel && s.data.map((value, pi) => {
            const categoryPos = scales.categoryScale(pi);
            const valuePos = scales.valueScale(value);
            const labelX = isHorizontal ? valuePos + 8 : categoryPos;
            const labelY = isHorizontal ? categoryPos + 4 : valuePos - 8;
            return (
              <text
                key={`label-${si}-${pi}`}
                x={labelX}
                y={labelY}
                fontSize={10}
                fill="#666"
                textAnchor={isHorizontal ? 'start' : 'middle'}
              >
                {formatDataValue(value)}
              </text>
            );
          })}
        </g>
      );
    });
  };

  return (
    <SpecializedShell
      syncCanvas={syncCanvas}
      onCanvasUpdate={onCanvasUpdate}
      {...shellProps}
    >
      <div className="specialized-chart-wrapper">
        <div className="specialized-header">
          <div className="specialized-title">{syncCanvas.title ?? '坐标图'}</div>
          <button
            type="button"
            className="toolbar-btn specialized-config-btn"
            onClick={() => {
              setShowConfigPanel(!showConfigPanel);
              setSelectedIdx(null);
            }}
            title="图表配置"
          >
            {showConfigPanel ? '关闭配置' : '图表配置'}
          </button>
        </div>

        <div className="xychart-container">
          <div
            className="xychart-canvas"
            onContextMenu={handleCanvasContextMenu}
          >
            <svg
              ref={svgRef}
              width={SVG_WIDTH}
              height={SVG_HEIGHT}
              className="xychart-svg"
              role="img"
              aria-label={syncCanvas.title ?? '坐标图'}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {renderAxes()}
              {renderSeries()}

              {/* 空状态提示 */}
              {series.length === 0 && (
                <text
                  x={PADDING_LEFT + CHART_WIDTH / 2}
                  y={PADDING_TOP + CHART_HEIGHT / 2}
                  fontSize={14}
                  fill="#999"
                  textAnchor="middle"
                >
                  右键画布添加数据系列
                </text>
              )}
            </svg>
          </div>

          <div className="xychart-sidebar">
            {/* 图例 */}
            <div className="xychart-legend">
              {series.map((s, si) => {
                const color = s.color ?? DEFAULT_PLOT_COLOR_PALETTE[si % DEFAULT_PLOT_COLOR_PALETTE.length];
                return (
                  <div
                    key={si}
                    className="xychart-legend-item"
                    onClick={() => handlePointClick(si)}
                    style={{ cursor: 'pointer', fontWeight: selectedIdx === si ? 600 : 400 }}
                  >
                    <span
                      className="xychart-legend-color"
                      style={{
                        background: color,
                        borderRadius: s.type === 'bar' ? 2 : '50%',
                      }}
                    />
                    <span className="xychart-legend-label">{s.name ?? `系列 ${si + 1}`}</span>
                    <span className="xychart-legend-type">({s.type})</span>
                  </div>
                );
              })}
            </div>
            <div className="xychart-hint">
              提示：拖拽数据点调整数值，双击编辑系列属性，右键删除/添加
            </div>
          </div>
        </div>

        {/* 编辑面板区域 */}
        {selectedSeries && !showConfigPanel && (
          <div className="specialized-edit-panel">
            <XYChartSeriesPanel
              plot={selectedSeries}
              classes={syncCanvas.classDefs ?? []}
              onChange={handleUpdateSeries}
              onDelete={() => selectedIdx !== null && handleRemoveSeries(selectedIdx)}
            />
          </div>
        )}

        {showConfigPanel && (
          <div className="specialized-edit-panel">
            <XYChartConfigPanel
              config={syncCanvas}
              onChange={handleUpdateConfig}
            />
          </div>
        )}
      </div>

      {/* 右键上下文菜单 */}
      {contextMenu && (
        <>
          <div
            className="context-menu-overlay"
            onClick={handleCloseContextMenu}
            onContextMenu={(e) => { e.preventDefault(); handleCloseContextMenu(); }}
          />
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.seriesIdx !== null ? (
              <button
                type="button"
                className="context-menu-item"
                onClick={handleContextMenuDelete}
              >
                删除系列
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={handleContextMenuAddLine}
                >
                  添加 line 系列
                </button>
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={handleContextMenuAddBar}
                >
                  添加 bar 系列
                </button>
              </>
            )}
          </div>
        </>
      )}
    </SpecializedShell>
  );
}

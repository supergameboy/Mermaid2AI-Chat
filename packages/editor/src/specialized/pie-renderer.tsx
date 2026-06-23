/**
 * PieRenderer — 饼图渲染器
 *
 * 单一职责：将 PieCanvasState 渲染为 SVG 饼图，提供完整编辑功能
 *
 * 功能:
 * - SVG 饼图渲染（复用 SliceArc/Legend 子组件）
 * - 点击切片：高亮 + 打开 PieSlicePanel
 * - 双击切片：打开 PieSlicePanel
 * - 右键切片：上下文菜单 → 删除切片
 * - 右键画布：上下文菜单 → 添加切片
 * - 点击配置按钮：打开 PieConfigPanel
 * - 图例：显示 label/颜色/数值/百分比，支持删除和 hover 高亮
 *
 * 数据流:
 *   PieCanvasState → PieRenderer → SVG 饼图 + 图例 + 编辑面板
 *   用户编辑 → onCanvasUpdate(PieCanvasState) → 外部同步
 */

import { useState, useCallback, useMemo } from 'react';
import type { MouseEvent, ReactElement } from 'react';
import type { PieCanvasState, PieSlice } from '@mermaid2aichat/serializer';
import { SpecializedShell } from './shared/specialized-shell.js';
import type { PieRendererProps } from './types.js';
import { SliceArc } from '../pie/slice-arc.js';
import { Legend } from '../pie/legend.js';
import { PieSlicePanel } from '../components/pie/pie-slice-panel.js';
import { PieConfigPanel } from '../components/pie/pie-config-panel.js';

/** 饼图配色（循环使用） */
const PIE_COLORS = [
  '#1890ff', '#52c41a', '#fa8c16', '#f5222d',
  '#722ed1', '#13c2c2', '#eb2f96', '#faad14',
];

const CENTER_X = 200;
const CENTER_Y = 200;
const RADIUS = 150;

/** 右键菜单状态 */
interface ContextMenuState {
  x: number;
  y: number;
  /** 切片索引（null 表示右键空白画布） */
  sliceIdx: number | null;
}

export function PieRenderer(props: PieRendererProps): ReactElement {
  const { syncCanvas, onCanvasUpdate, ...shellProps } = props;

  // 高亮切片索引（hover 或选中）
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  // 选中切片索引（打开编辑面板）
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  // 是否显示配置面板
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const slices = syncCanvas.slices;
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const showData = syncCanvas.showData ?? false;

  // 计算每个 slice 的角度范围（按声明顺序从 12 点钟方向顺时针）
  // total === 0 时无有效数据，提前返回空数组避免 NaN 计算
  const sliceData = useMemo(() => {
    if (total <= 0) return [];
    return slices.map((slice, idx) => {
      const startAngle = slices
        .slice(0, idx)
        .reduce((sum, s) => sum + (s.value / total) * 360, 0);
      const endAngle = startAngle + (slice.value / total) * 360;
      const color = PIE_COLORS[idx % PIE_COLORS.length];
      return { slice, startAngle, endAngle, color };
    });
  }, [slices, total]);

  // ============================================================
  // 编辑操作
  // ============================================================

  /** 更新切片 */
  const handleUpdateSlice = useCallback((updates: Partial<PieSlice>) => {
    if (selectedIdx === null) return;
    const newSlices = slices.map((s, i) =>
      i === selectedIdx ? { ...s, ...updates } : s
    );
    onCanvasUpdate({ ...syncCanvas, slices: newSlices });
  }, [selectedIdx, slices, syncCanvas, onCanvasUpdate]);

  /** 删除切片 */
  const handleRemoveSlice = useCallback((idx: number) => {
    if (slices.length <= 1) return;
    const newSlices = slices.filter((_, i) => i !== idx);
    onCanvasUpdate({ ...syncCanvas, slices: newSlices });
    // 如果删除的是当前选中的切片，关闭编辑面板
    if (selectedIdx === idx) {
      setSelectedIdx(null);
    } else if (selectedIdx !== null && idx < selectedIdx) {
      // 删除前面的切片后，选中索引前移
      setSelectedIdx(selectedIdx - 1);
    }
  }, [slices, syncCanvas, onCanvasUpdate, selectedIdx]);

  /** 添加切片 */
  const handleAddSlice = useCallback(() => {
    const newSlice: PieSlice = { label: `切片 ${slices.length + 1}`, value: 1 };
    onCanvasUpdate({ ...syncCanvas, slices: [...slices, newSlice] });
  }, [slices, syncCanvas, onCanvasUpdate]);

  /** 更新配置 */
  const handleUpdateConfig = useCallback((updates: Partial<PieCanvasState>) => {
    onCanvasUpdate({ ...syncCanvas, ...updates });
  }, [syncCanvas, onCanvasUpdate]);

  // ============================================================
  // 交互处理
  // ============================================================

  /** 切片点击：高亮 + 打开编辑面板 */
  const handleSliceClick = useCallback((idx: number) => {
    setSelectedIdx(idx);
    setShowConfigPanel(false);
    setContextMenu(null);
  }, []);

  /** 切片右键：打开上下文菜单 */
  const handleSliceContextMenu = useCallback((e: MouseEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, sliceIdx: idx });
  }, []);

  /** 画布右键：打开上下文菜单（添加切片） */
  const handleCanvasContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, sliceIdx: null });
  }, []);

  /** 关闭右键菜单 */
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  /** 右键菜单：删除切片 */
  const handleContextMenuDelete = useCallback(() => {
    if (contextMenu !== null && contextMenu.sliceIdx !== null) {
      handleRemoveSlice(contextMenu.sliceIdx);
    }
    setContextMenu(null);
  }, [contextMenu, handleRemoveSlice]);

  /** 右键菜单：添加切片 */
  const handleContextMenuAdd = useCallback(() => {
    handleAddSlice();
    setContextMenu(null);
  }, [handleAddSlice]);

  /** 图例 hover 高亮 */
  const handleLegendHover = useCallback((idx: number | null) => {
    setHoveredIdx(idx);
  }, []);

  // 当前高亮的切片索引（hover 优先于选中）
  const highlightedIdx = hoveredIdx ?? selectedIdx;

  // 当前选中的切片（用于编辑面板）
  const selectedSlice = selectedIdx !== null ? slices[selectedIdx] : null;

  return (
    <SpecializedShell
      syncCanvas={syncCanvas}
      onCanvasUpdate={onCanvasUpdate}
      {...shellProps}
    >
      <div className="specialized-chart-wrapper">
        <div className="specialized-header">
          <div className="specialized-title">{syncCanvas.title ?? '饼图'}</div>
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

        <div className="pie-container">
          <div
            className="pie-canvas"
            onContextMenu={handleCanvasContextMenu}
          >
            <svg
              width={400}
              height={400}
              className="pie-svg"
              role="img"
              aria-label={syncCanvas.title ?? '饼图'}
            >
              {total > 0 && sliceData.map(({ slice, startAngle, endAngle, color }, idx) => (
                <SliceArc
                  key={idx}
                  slice={slice}
                  startAngle={startAngle}
                  endAngle={endAngle}
                  radius={RADIUS}
                  centerX={CENTER_X}
                  centerY={CENTER_Y}
                  color={color}
                  isHighlighted={highlightedIdx === idx}
                  onClick={() => handleSliceClick(idx)}
                  onContextMenu={(e) => handleSliceContextMenu(e, idx)}
                  showData={showData}
                  total={total}
                />
              ))}
              {total === 0 && (
                <text
                  x={CENTER_X}
                  y={CENTER_Y}
                  fontSize={14}
                  fill="#999"
                  textAnchor="middle"
                >
                  无数据
                </text>
              )}
            </svg>
          </div>

          <div className="pie-sidebar">
            <Legend
              slices={slices}
              colors={sliceData.map((d) => d.color)}
              total={total}
              highlightedIdx={highlightedIdx}
              onRemoveSlice={handleRemoveSlice}
              onHoverSlice={handleLegendHover}
            />
            <button
              type="button"
              className="toolbar-btn pie-add-btn"
              onClick={handleAddSlice}
            >
              添加切片
            </button>
          </div>
        </div>

        {/* 编辑面板区域 */}
        {selectedSlice && !showConfigPanel && (
          <div className="specialized-edit-panel">
            <PieSlicePanel
              slice={selectedSlice}
              onChange={handleUpdateSlice}
              onDelete={() => selectedIdx !== null && handleRemoveSlice(selectedIdx)}
            />
          </div>
        )}

        {showConfigPanel && (
          <div className="specialized-edit-panel">
            <PieConfigPanel
              config={syncCanvas}
              onChange={handleUpdateConfig}
            />
          </div>
        )}
      </div>

      {/* 右键上下文菜单 */}
      {contextMenu && (
        <>
          {/* 透明遮罩，点击关闭菜单 */}
          <div
            className="context-menu-overlay"
            onClick={handleCloseContextMenu}
            onContextMenu={(e) => { e.preventDefault(); handleCloseContextMenu(); }}
          />
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.sliceIdx !== null ? (
              <button
                type="button"
                className="context-menu-item"
                onClick={handleContextMenuDelete}
                disabled={slices.length <= 1}
              >
                删除切片
              </button>
            ) : (
              <button
                type="button"
                className="context-menu-item"
                onClick={handleContextMenuAdd}
              >
                添加切片
              </button>
            )}
          </div>
        </>
      )}
    </SpecializedShell>
  );
}

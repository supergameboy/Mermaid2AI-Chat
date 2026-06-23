/**
 * QuadrantRenderer — 四象限图渲染器
 *
 * 单一职责：将 QuadrantCanvasState 渲染为 SVG 四象限图，提供完整编辑功能
 *
 * 功能:
 * - SVG 四象限网格渲染（2x2 网格 + 象限标题 + 坐标轴标签）
 * - 数据点按 x/y 归一化坐标（0-1）定位
 * - 支持 point 样式（radius/color/strokeColor/strokeWidth）
 * - 支持 classDef 样式合并（point 自身样式覆盖 classDef 基础样式）
 * - 拖拽数据点 → 更新 x/y（归一化坐标 0-1）→ onCanvasUpdate
 * - 双击数据点 → 打开 QuadrantPointPanel
 * - 右键数据点 → 上下文菜单 → 删除
 * - 右键画布 → 上下文菜单 → 添加数据点（默认 [0.5, 0.5]）
 * - 点击配置按钮 → 打开 QuadrantConfigPanel
 *
 * 数据流:
 *   QuadrantCanvasState → QuadrantRenderer → SVG 四象限图 + 编辑面板
 *   用户编辑 → onCanvasUpdate(QuadrantCanvasState) → 外部同步
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { MouseEvent, ReactElement } from 'react';
import type {
  QuadrantCanvasState,
  QuadrantPoint,
  StateClassDefInfo,
} from '@mermaid2aichat/serializer';
import { mergeClassDefStyle } from '@mermaid2aichat/serializer';
import { SpecializedShell } from './shared/specialized-shell.js';
import type { QuadrantRendererProps } from './types.js';
import { QuadrantPointPanel } from '../components/quadrant/quadrant-point-panel.js';
import { QuadrantConfigPanel } from '../components/quadrant/quadrant-config-panel.js';

// ============================================================
// 常量
// ============================================================

const SVG_SIZE = 500;
const PADDING = 60;
const CHART_SIZE = SVG_SIZE - PADDING * 2;
const DEFAULT_POINT_RADIUS = 6;
const DEFAULT_POINT_FILL = '#1890ff';
const DEFAULT_POINT_STROKE = '#ffffff';
const DEFAULT_POINT_STROKE_WIDTH = 2;

/** 象限背景色（与官方 quadrant 默认配色接近） */
const QUADRANT_COLORS = {
  '1': '#e6f7ff', // 右上
  '2': '#f6ffed', // 左上
  '3': '#fff7e6', // 左下
  '4': '#fff1f0', // 右下
} as const;

// ============================================================
// 坐标转换（0-1 归一化 ↔ SVG 像素）
// ============================================================

/** 将归一化坐标 (0-1) 转换为 SVG 像素坐标 */
function dataToSvg(x: number, y: number): { sx: number; sy: number } {
  const sx = PADDING + x * CHART_SIZE;
  // Y 轴反转：数据 y=0 在底部，y=1 在顶部
  const sy = PADDING + CHART_SIZE - y * CHART_SIZE;
  return { sx, sy };
}

/** 将 SVG 像素坐标转换为归一化坐标 (0-1)，自动夹紧到 [0, 1] */
function svgToData(sx: number, sy: number): { x: number; y: number } {
  const x = (sx - PADDING) / CHART_SIZE;
  const y = (PADDING + CHART_SIZE - sy) / CHART_SIZE;
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
  };
}

// ============================================================
// 右键菜单状态
// ============================================================

interface ContextMenuState {
  x: number;
  y: number;
  /** 数据点索引（null 表示右键空白画布） */
  pointIdx: number | null;
}

// ============================================================
// 组件
// ============================================================

export function QuadrantRenderer(props: QuadrantRendererProps): ReactElement {
  const { syncCanvas, onCanvasUpdate, ...shellProps } = props;

  // 选中数据点索引（打开编辑面板）
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  // 是否显示配置面板
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  // 拖拽数据点索引
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  // SVG 引用（用于拖拽坐标计算）
  const svgRef = useRef<SVGSVGElement>(null);

  const points = syncCanvas.points;
  const classDefs = syncCanvas.classDefs;

  // 外部更新 points 后，selectedIdx 可能越界（例如其他用户通过 WebSocket 删除了点）
  // 监听 points.length 变化，越界时重置为 null
  useEffect(() => {
    if (selectedIdx !== null && selectedIdx >= points.length) {
      setSelectedIdx(null);
    }
  }, [points.length, selectedIdx]);

  // 预计算每个数据点的合并样式（point 自身样式 + classDef 样式）
  const renderedPoints = useMemo(() => {
    return points.map((point) => {
      const { style, radius } = mergeClassDefStyle(point, classDefs);
      return {
        point,
        mergedStyle: style,
        mergedRadius: radius,
      };
    });
  }, [points, classDefs]);

  // ============================================================
  // 编辑操作
  // ============================================================

  /** 更新数据点 */
  const handleUpdatePoint = useCallback((updates: Partial<QuadrantPoint>) => {
    if (selectedIdx === null) return;
    const newPoints = points.map((p, i) =>
      i === selectedIdx ? { ...p, ...updates } : p
    );
    onCanvasUpdate({ ...syncCanvas, points: newPoints });
  }, [selectedIdx, points, syncCanvas, onCanvasUpdate]);

  /** 删除数据点 */
  const handleRemovePoint = useCallback((idx: number) => {
    const newPoints = points.filter((_, i) => i !== idx);
    onCanvasUpdate({ ...syncCanvas, points: newPoints });
    // 如果删除的是当前选中的数据点，关闭编辑面板
    if (selectedIdx === idx) {
      setSelectedIdx(null);
    } else if (selectedIdx !== null && idx < selectedIdx) {
      // 删除前面的数据点后，选中索引前移
      setSelectedIdx(selectedIdx - 1);
    }
  }, [points, syncCanvas, onCanvasUpdate, selectedIdx]);

  /** 添加数据点（默认 [0.5, 0.5]） */
  const handleAddPoint = useCallback(() => {
    const newPoint: QuadrantPoint = {
      label: `点 ${points.length + 1}`,
      x: 0.5,
      y: 0.5,
    };
    onCanvasUpdate({ ...syncCanvas, points: [...points, newPoint] });
  }, [points, syncCanvas, onCanvasUpdate]);

  /** 更新配置 */
  const handleUpdateConfig = useCallback((updates: Partial<QuadrantCanvasState>) => {
    onCanvasUpdate({ ...syncCanvas, ...updates });
  }, [syncCanvas, onCanvasUpdate]);

  // ============================================================
  // 交互处理
  // ============================================================

  /** 数据点点击：选中并打开编辑面板 */
  const handlePointClick = useCallback((idx: number) => {
    setSelectedIdx(idx);
    setShowConfigPanel(false);
    setContextMenu(null);
  }, []);

  /** 数据点右键：打开上下文菜单 */
  const handlePointContextMenu = useCallback((e: MouseEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, pointIdx: idx });
  }, []);

  /** 画布右键：打开上下文菜单（添加数据点） */
  const handleCanvasContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, pointIdx: null });
  }, []);

  /** 关闭右键菜单 */
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  /** 右键菜单：删除数据点 */
  const handleContextMenuDelete = useCallback(() => {
    if (contextMenu !== null && contextMenu.pointIdx !== null) {
      handleRemovePoint(contextMenu.pointIdx);
    }
    setContextMenu(null);
  }, [contextMenu, handleRemovePoint]);

  /** 右键菜单：添加数据点 */
  const handleContextMenuAdd = useCallback(() => {
    handleAddPoint();
    setContextMenu(null);
  }, [handleAddPoint]);

  /** 数据点拖拽开始 */
  const handlePointMouseDown = useCallback((idx: number, e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingIdx(idx);
  }, []);

  /** 拖拽中：更新数据点坐标 */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (draggingIdx === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    // 计算缩放比例：SVG 逻辑尺寸（SVG_SIZE）与 CSS 渲染尺寸（rect.width/height）可能不同
    // getBoundingClientRect 返回 CSS 像素，需转换为 SVG 逻辑像素
    const scaleX = SVG_SIZE / rect.width;
    const scaleY = SVG_SIZE / rect.height;
    const sx = (e.clientX - rect.left) * scaleX;
    const sy = (e.clientY - rect.top) * scaleY;
    const { x, y } = svgToData(sx, sy);
    const newPoints = points.map((p, i) =>
      i === draggingIdx ? { ...p, x, y } : p
    );
    onCanvasUpdate({ ...syncCanvas, points: newPoints });
  }, [draggingIdx, points, syncCanvas, onCanvasUpdate]);

  /** 拖拽结束 */
  const handleMouseUp = useCallback(() => {
    setDraggingIdx(null);
  }, []);

  // 当前选中的数据点（用于编辑面板）
  const selectedPoint = selectedIdx !== null ? points[selectedIdx] : null;

  const midX = PADDING + CHART_SIZE / 2;
  const midY = PADDING + CHART_SIZE / 2;

  return (
    <SpecializedShell
      syncCanvas={syncCanvas}
      onCanvasUpdate={onCanvasUpdate}
      {...shellProps}
    >
      <div className="specialized-chart-wrapper">
        <div className="specialized-header">
          <div className="specialized-title">{syncCanvas.title ?? '四象限图'}</div>
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

        <div className="quadrant-container">
          <div
            className="quadrant-canvas"
            onContextMenu={handleCanvasContextMenu}
          >
            <svg
              ref={svgRef}
              width={SVG_SIZE}
              height={SVG_SIZE}
              className="quadrant-svg"
              role="img"
              aria-label={syncCanvas.title ?? '四象限图'}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* 四象限背景（2x2 网格） */}
              <rect x={PADDING} y={PADDING} width={CHART_SIZE / 2} height={CHART_SIZE / 2} fill={QUADRANT_COLORS['2']} />
              <rect x={midX} y={PADDING} width={CHART_SIZE / 2} height={CHART_SIZE / 2} fill={QUADRANT_COLORS['1']} />
              <rect x={PADDING} y={midY} width={CHART_SIZE / 2} height={CHART_SIZE / 2} fill={QUADRANT_COLORS['3']} />
              <rect x={midX} y={midY} width={CHART_SIZE / 2} height={CHART_SIZE / 2} fill={QUADRANT_COLORS['4']} />

              {/* 网格线 */}
              <line x1={midX} y1={PADDING} x2={midX} y2={PADDING + CHART_SIZE} stroke="#999" strokeWidth={1} />
              <line x1={PADDING} y1={midY} x2={PADDING + CHART_SIZE} y2={midY} stroke="#999" strokeWidth={1} />
              {/* 外边框 */}
              <rect x={PADDING} y={PADDING} width={CHART_SIZE} height={CHART_SIZE} fill="none" stroke="#666" strokeWidth={1.5} />

              {/* 象限标题 */}
              <text x={midX + CHART_SIZE / 4} y={PADDING + 20} fontSize={13} fontWeight={600} fill="#333" textAnchor="middle">
                {syncCanvas.quadrants['1']}
              </text>
              <text x={PADDING + CHART_SIZE / 4} y={PADDING + 20} fontSize={13} fontWeight={600} fill="#333" textAnchor="middle">
                {syncCanvas.quadrants['2']}
              </text>
              <text x={PADDING + CHART_SIZE / 4} y={PADDING + CHART_SIZE - 10} fontSize={13} fontWeight={600} fill="#333" textAnchor="middle">
                {syncCanvas.quadrants['3']}
              </text>
              <text x={midX + CHART_SIZE / 4} y={PADDING + CHART_SIZE - 10} fontSize={13} fontWeight={600} fill="#333" textAnchor="middle">
                {syncCanvas.quadrants['4']}
              </text>

              {/* 坐标轴标签 */}
              <text x={PADDING + CHART_SIZE / 2} y={SVG_SIZE - 15} fontSize={12} fill="#666" textAnchor="middle">
                {`${syncCanvas.xAxis.leftText} / ${syncCanvas.xAxis.rightText}`}
              </text>
              <text x={20} y={PADDING + CHART_SIZE / 2} fontSize={12} fill="#666" textAnchor="middle" transform={`rotate(-90 20 ${PADDING + CHART_SIZE / 2})`}>
                {`${syncCanvas.yAxis.bottomText} / ${syncCanvas.yAxis.topText}`}
              </text>

              {/* 数据点 */}
              {renderedPoints.map(({ point, mergedStyle, mergedRadius }, idx) => {
                const { sx, sy } = dataToSvg(point.x, point.y);
                const r = mergedRadius ?? DEFAULT_POINT_RADIUS;
                const fill = mergedStyle.fill ?? DEFAULT_POINT_FILL;
                const stroke = mergedStyle.stroke ?? DEFAULT_POINT_STROKE;
                const strokeWidth = mergedStyle.strokeWidth ?? DEFAULT_POINT_STROKE_WIDTH;
                const isSelected = selectedIdx === idx;
                return (
                  <g
                    key={idx}
                    onClick={() => handlePointClick(idx)}
                    onContextMenu={(e) => handlePointContextMenu(e, idx)}
                    onMouseDown={(e) => handlePointMouseDown(idx, e)}
                    style={{ cursor: draggingIdx === idx ? 'grabbing' : 'grab' }}
                  >
                    {/* 选中高亮环 */}
                    {isSelected && (
                      <circle
                        cx={sx}
                        cy={sy}
                        r={r + 4}
                        fill="none"
                        stroke="#fa8c16"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                      />
                    )}
                    <circle
                      cx={sx}
                      cy={sy}
                      r={r}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                    />
                    <text
                      x={sx + r + 4}
                      y={sy + 4}
                      fontSize={11}
                      fill="#333"
                    >
                      {point.label}
                    </text>
                  </g>
                );
              })}

              {/* 空状态提示 */}
              {points.length === 0 && (
                <text
                  x={PADDING + CHART_SIZE / 2}
                  y={PADDING + CHART_SIZE / 2}
                  fontSize={14}
                  fill="#999"
                  textAnchor="middle"
                >
                  右键画布添加数据点
                </text>
              )}
            </svg>
          </div>

          <div className="quadrant-sidebar">
            <button
              type="button"
              className="toolbar-btn quadrant-add-btn"
              onClick={handleAddPoint}
            >
              添加数据点
            </button>
            <div className="quadrant-hint">
              提示：拖拽数据点调整位置，双击编辑属性，右键删除
            </div>
          </div>
        </div>

        {/* 编辑面板区域 */}
        {selectedPoint && !showConfigPanel && (
          <div className="specialized-edit-panel">
            <QuadrantPointPanel
              point={selectedPoint}
              classes={classDefs ?? []}
              onChange={handleUpdatePoint}
              onDelete={() => selectedIdx !== null && handleRemovePoint(selectedIdx)}
            />
          </div>
        )}

        {showConfigPanel && (
          <div className="specialized-edit-panel">
            <QuadrantConfigPanel
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
            {contextMenu.pointIdx !== null ? (
              <button
                type="button"
                className="context-menu-item"
                onClick={handleContextMenuDelete}
              >
                删除数据点
              </button>
            ) : (
              <button
                type="button"
                className="context-menu-item"
                onClick={handleContextMenuAdd}
              >
                添加数据点
              </button>
            )}
          </div>
        </>
      )}
    </SpecializedShell>
  );
}

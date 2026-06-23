/**
 * QuadrantPointPanel — 四象限图数据点属性编辑面板
 *
 * 单一职责：编辑 QuadrantPoint 的 label/x/y/className/radius/color/strokeColor/strokeWidth
 *
 * 数据流:
 *   QuadrantPoint → QuadrantPointPanel → onChange(Partial<QuadrantPoint>) → 更新 CanvasState.points[]
 */

import { memo, useState, useEffect } from 'react';
import type { QuadrantPoint, StateClassDefInfo } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

export interface QuadrantPointPanelProps {
  /** 当前编辑的数据点 */
  point: QuadrantPoint;
  /** 可用的 classDef 列表（用于 className 下拉选择） */
  classes: StateClassDefInfo[];
  /** 更新回调，传入部分字段 */
  onChange: (updates: Partial<QuadrantPoint>) => void;
  /** 删除当前数据点 */
  onDelete: () => void;
}

// ============================================================
// 组件
// ============================================================

/** 四象限图数据点属性编辑面板组件 */
export const QuadrantPointPanel = memo(function QuadrantPointPanel({
  point,
  classes,
  onChange,
  onDelete,
}: QuadrantPointPanelProps) {
  // 本地状态用于受控输入，避免每次按键都触发 CanvasState 更新
  const [label, setLabel] = useState(point.label);
  const [x, setX] = useState(String(point.x));
  const [y, setY] = useState(String(point.y));
  const [className, setClassName] = useState(point.className ?? '');
  const [radius, setRadius] = useState(point.radius !== undefined ? String(point.radius) : '');
  const [color, setColor] = useState(point.style?.fill ?? '');
  const [strokeColor, setStrokeColor] = useState(point.style?.stroke ?? '');
  const [strokeWidth, setStrokeWidth] = useState(
    point.style?.strokeWidth !== undefined ? String(point.style.strokeWidth) : ''
  );

  // 数据点切换时同步本地状态
  useEffect(() => {
    setLabel(point.label);
    setX(String(point.x));
    setY(String(point.y));
    setClassName(point.className ?? '');
    setRadius(point.radius !== undefined ? String(point.radius) : '');
    setColor(point.style?.fill ?? '');
    setStrokeColor(point.style?.stroke ?? '');
    setStrokeWidth(point.style?.strokeWidth !== undefined ? String(point.style.strokeWidth) : '');
  }, [point]);

  /** 确认编辑：将本地状态提交到 CanvasState */
  const handleConfirm = () => {
    const updates: Partial<QuadrantPoint> = { label };

    // x/y 坐标（0-1 归一化）
    const xNum = parseFloat(x);
    if (!isNaN(xNum)) {
      updates.x = Math.max(0, Math.min(1, xNum));
    }
    const yNum = parseFloat(y);
    if (!isNaN(yNum)) {
      updates.y = Math.max(0, Math.min(1, yNum));
    }

    // className（空字符串 → undefined）
    updates.className = className || undefined;

    // radius
    const radiusNum = parseInt(radius, 10);
    if (!isNaN(radiusNum) && radiusNum >= 0) {
      updates.radius = radiusNum;
    } else {
      updates.radius = undefined;
    }

    // style（color/strokeColor/strokeWidth → NodeStyle）
    const style: NonNullable<QuadrantPoint['style']> = {};
    if (color) style.fill = color;
    if (strokeColor) style.stroke = strokeColor;
    const strokeWidthNum = parseInt(strokeWidth, 10);
    if (!isNaN(strokeWidthNum) && strokeWidthNum >= 0) {
      style.strokeWidth = strokeWidthNum;
    }
    updates.style = Object.keys(style).length > 0 ? style : undefined;

    onChange(updates);
  };

  return (
    <div className="quadrant-point-panel">
      <div className="panel-header">
        <h3 className="panel-title">数据点属性</h3>
      </div>

      <div className="panel-body">
        <label className="panel-label">
          标签
          <input
            className="panel-input"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="数据点标签"
          />
        </label>

        <div className="panel-row">
          <label className="panel-label">
            X 坐标（0-1）
            <input
              className="panel-input"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={x}
              onChange={(e) => setX(e.target.value)}
              placeholder="0.5"
            />
          </label>
          <label className="panel-label">
            Y 坐标（0-1）
            <input
              className="panel-input"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={y}
              onChange={(e) => setY(e.target.value)}
              placeholder="0.5"
            />
          </label>
        </div>

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

        <label className="panel-label">
          半径（radius）
          <input
            className="panel-input"
            type="number"
            min="0"
            step="1"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            placeholder="数据点半径"
          />
        </label>

        <div className="panel-row">
          <label className="panel-label">
            填充色（color）
            <input
              className="panel-input"
              type="color"
              value={color || '#1890ff'}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
          <label className="panel-label">
            边框色（stroke-color）
            <input
              className="panel-input"
              type="color"
              value={strokeColor || '#ffffff'}
              onChange={(e) => setStrokeColor(e.target.value)}
            />
          </label>
        </div>

        <label className="panel-label">
          边框宽度（stroke-width，px）
          <input
            className="panel-input"
            type="number"
            min="0"
            step="1"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(e.target.value)}
            placeholder="边框宽度"
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
          删除数据点
        </button>
      </div>
    </div>
  );
});

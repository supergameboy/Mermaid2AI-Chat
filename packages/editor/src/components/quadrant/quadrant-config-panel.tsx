/**
 * QuadrantConfigPanel — 四象限图配置面板
 *
 * 单一职责：编辑 QuadrantCanvasState 的图表级配置
 *   - title/accTitle/accDescription
 *   - xAxis（leftText/rightText）
 *   - yAxis（topText/bottomText）
 *   - quadrant-1~4
 *   - classDefs（样式类定义）
 *
 * 数据流:
 *   QuadrantCanvasState → QuadrantConfigPanel → onChange(Partial<QuadrantCanvasState>) → 更新 CanvasState
 */

import { memo, useState, useEffect } from 'react';
import type { QuadrantCanvasState, StateClassDefInfo } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

export interface QuadrantConfigPanelProps {
  /** 当前画布配置 */
  config: QuadrantCanvasState;
  /** 更新回调，传入部分字段 */
  onChange: (updates: Partial<QuadrantCanvasState>) => void;
}

// ============================================================
// 组件
// ============================================================

/** 四象限图配置面板组件 */
export const QuadrantConfigPanel = memo(function QuadrantConfigPanel({
  config,
  onChange,
}: QuadrantConfigPanelProps) {
  // 本地状态用于受控输入
  const [title, setTitle] = useState(config.title ?? '');
  const [accTitle, setAccTitle] = useState(config.accTitle ?? '');
  const [accDescription, setAccDescription] = useState(config.accDescription ?? '');
  const [xAxisLeft, setXAxisLeft] = useState(config.xAxis.leftText);
  const [xAxisRight, setXAxisRight] = useState(config.xAxis.rightText);
  const [yAxisTop, setYAxisTop] = useState(config.yAxis.topText);
  const [yAxisBottom, setYAxisBottom] = useState(config.yAxis.bottomText);
  const [quadrant1, setQuadrant1] = useState(config.quadrants['1']);
  const [quadrant2, setQuadrant2] = useState(config.quadrants['2']);
  const [quadrant3, setQuadrant3] = useState(config.quadrants['3']);
  const [quadrant4, setQuadrant4] = useState(config.quadrants['4']);
  const [classDefs, setClassDefs] = useState<StateClassDefInfo[]>(config.classDefs ?? []);

  // 配置变化时同步本地状态
  useEffect(() => {
    setTitle(config.title ?? '');
    setAccTitle(config.accTitle ?? '');
    setAccDescription(config.accDescription ?? '');
    setXAxisLeft(config.xAxis.leftText);
    setXAxisRight(config.xAxis.rightText);
    setYAxisTop(config.yAxis.topText);
    setYAxisBottom(config.yAxis.bottomText);
    setQuadrant1(config.quadrants['1']);
    setQuadrant2(config.quadrants['2']);
    setQuadrant3(config.quadrants['3']);
    setQuadrant4(config.quadrants['4']);
    setClassDefs(config.classDefs ?? []);
  }, [config]);

  /** 确认编辑：将本地状态提交到 CanvasState */
  const handleConfirm = () => {
    onChange({
      title: title || undefined,
      accTitle: accTitle || undefined,
      accDescription: accDescription || undefined,
      xAxis: { leftText: xAxisLeft, rightText: xAxisRight },
      yAxis: { topText: yAxisTop, bottomText: yAxisBottom },
      quadrants: {
        '1': quadrant1,
        '2': quadrant2,
        '3': quadrant3,
        '4': quadrant4,
      },
      classDefs: classDefs.length > 0 ? classDefs : undefined,
    });
  };

  /** 添加 classDef */
  const handleAddClassDef = () => {
    const newName = `class${classDefs.length + 1}`;
    setClassDefs([...classDefs, { name: newName, style: 'color: #1890ff' }]);
  };

  /** 删除 classDef */
  const handleDeleteClassDef = (idx: number) => {
    setClassDefs(classDefs.filter((_, i) => i !== idx));
  };

  /** 更新 classDef 名称 */
  const handleClassDefNameChange = (idx: number, name: string) => {
    setClassDefs(classDefs.map((cd, i) => i === idx ? { ...cd, name } : cd));
  };

  /** 更新 classDef 样式 */
  const handleClassDefStyleChange = (idx: number, style: string) => {
    setClassDefs(classDefs.map((cd, i) => i === idx ? { ...cd, style } : cd));
  };

  return (
    <div className="quadrant-config-panel">
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

        <div className="panel-section-title">X 轴</div>
        <div className="panel-row">
          <label className="panel-label">
            左标签
            <input
              className="panel-input"
              type="text"
              value={xAxisLeft}
              onChange={(e) => setXAxisLeft(e.target.value)}
              placeholder="如 Low Reach"
            />
          </label>
          <label className="panel-label">
            右标签
            <input
              className="panel-input"
              type="text"
              value={xAxisRight}
              onChange={(e) => setXAxisRight(e.target.value)}
              placeholder="如 High Reach"
            />
          </label>
        </div>

        <div className="panel-section-title">Y 轴</div>
        <div className="panel-row">
          <label className="panel-label">
            下标签
            <input
              className="panel-input"
              type="text"
              value={yAxisBottom}
              onChange={(e) => setYAxisBottom(e.target.value)}
              placeholder="如 Low Engagement"
            />
          </label>
          <label className="panel-label">
            上标签
            <input
              className="panel-input"
              type="text"
              value={yAxisTop}
              onChange={(e) => setYAxisTop(e.target.value)}
              placeholder="如 High Engagement"
            />
          </label>
        </div>

        <div className="panel-section-title">象限标题</div>
        <label className="panel-label">
          象限 1（右上）
          <input
            className="panel-input"
            type="text"
            value={quadrant1}
            onChange={(e) => setQuadrant1(e.target.value)}
            placeholder="如 We should expand"
          />
        </label>
        <label className="panel-label">
          象限 2（左上）
          <input
            className="panel-input"
            type="text"
            value={quadrant2}
            onChange={(e) => setQuadrant2(e.target.value)}
            placeholder="如 Need to promote"
          />
        </label>
        <label className="panel-label">
          象限 3（左下）
          <input
            className="panel-input"
            type="text"
            value={quadrant3}
            onChange={(e) => setQuadrant3(e.target.value)}
            placeholder="如 Re-evaluate"
          />
        </label>
        <label className="panel-label">
          象限 4（右下）
          <input
            className="panel-input"
            type="text"
            value={quadrant4}
            onChange={(e) => setQuadrant4(e.target.value)}
            placeholder="如 May be improved"
          />
        </label>

        <div className="panel-section-title">
          样式类（classDef）
          <button
            type="button"
            className="toolbar-btn panel-add-btn"
            onClick={handleAddClassDef}
          >
            添加
          </button>
        </div>
        {classDefs.map((cd, idx) => (
          <div key={idx} className="panel-classdef-row">
            <input
              className="panel-input panel-classdef-name"
              type="text"
              value={cd.name}
              onChange={(e) => handleClassDefNameChange(idx, e.target.value)}
              placeholder="类名"
            />
            <input
              className="panel-input panel-classdef-style"
              type="text"
              value={cd.style}
              onChange={(e) => handleClassDefStyleChange(idx, e.target.value)}
              placeholder="如 color: #ff3300, radius: 9"
            />
            <button
              type="button"
              className="toolbar-btn panel-delete-btn"
              onClick={() => handleDeleteClassDef(idx)}
            >
              删除
            </button>
          </div>
        ))}
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

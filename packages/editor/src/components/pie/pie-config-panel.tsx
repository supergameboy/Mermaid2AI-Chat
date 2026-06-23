/**
 * PieConfigPanel — 饼图配置面板
 *
 * 单一职责：编辑 PieCanvasState 的图表级配置（title/showData/accTitle/accDescription）
 *
 * 数据流:
 *   PieCanvasState → PieConfigPanel → onChange(Partial<PieCanvasState>) → 更新 CanvasState
 */

import { memo, useState, useEffect } from 'react';
import type { PieCanvasState } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

export interface PieConfigPanelProps {
  /** 当前画布配置 */
  config: PieCanvasState;
  /** 更新回调，传入部分字段 */
  onChange: (updates: Partial<PieCanvasState>) => void;
}

// ============================================================
// 组件
// ============================================================

/** 饼图配置面板组件 */
export const PieConfigPanel = memo(function PieConfigPanel({
  config,
  onChange,
}: PieConfigPanelProps) {
  // 本地状态用于受控输入
  const [title, setTitle] = useState(config.title ?? '');
  const [accTitle, setAccTitle] = useState(config.accTitle ?? '');
  const [accDescription, setAccDescription] = useState(config.accDescription ?? '');
  const [showData, setShowData] = useState(config.showData ?? false);

  // 配置变化时同步本地状态
  useEffect(() => {
    setTitle(config.title ?? '');
    setAccTitle(config.accTitle ?? '');
    setAccDescription(config.accDescription ?? '');
    setShowData(config.showData ?? false);
  }, [config]);

  /** 确认编辑：将本地状态提交到 CanvasState */
  const handleConfirm = () => {
    onChange({
      title: title || undefined,
      accTitle: accTitle || undefined,
      accDescription: accDescription || undefined,
      showData,
    });
  };

  return (
    <div className="pie-config-panel">
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

        <label className="panel-checkbox-label">
          <input
            type="checkbox"
            checked={showData}
            onChange={(e) => setShowData(e.target.checked)}
          />
          显示数值（showData）
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
            rows={3}
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
      </div>
    </div>
  );
});

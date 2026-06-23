/**
 * StateRelationEditor — stateDiagram 转换关系（边）属性编辑面板
 *
 * 单一职责：编辑转换关系边的标签（event[guard]/action 格式）
 *
 * 数据流:
 *   MermaidEdge → StateRelationEditor → onUpdate(Partial<MermaidEdgeData>) → 更新 CanvasState
 *
 * 字段约定（通过 MermaidEdgeData 承载）:
 *   - transitionLabel?: string — 转换标签（M0 定义，格式: event[guard]/action）
 *
 * 转换标签格式说明（对齐官方 mermaid stateDiagram-v2 语法）:
 *   - event                  — 触发事件（如: click）
 *   - event[guard]           — 带守卫条件（如: click[isValid]）
 *   - event/action           — 触发动作（如: click/handleClick）
 *   - event[guard]/action    — 完整格式（如: click[isValid]/handleClick）
 */

import { memo } from 'react';
import type { MermaidEdge } from '@mermaid2aichat/serializer';

export interface StateRelationEditorProps {
  /** 当前编辑的转换关系边 */
  relationEdge: MermaidEdge;
  /** 更新回调 */
  onUpdate: (data: Partial<MermaidEdge['data']>) => void;
}

/** 转换关系编辑面板组件 */
export const StateRelationEditor = memo(function StateRelationEditor({
  relationEdge,
  onUpdate,
}: StateRelationEditorProps) {
  const data = relationEdge.data;
  const transitionLabel = data.transitionLabel ?? '';

  return (
    <div className="panel-content">
      {/* source 状态（只读） */}
      <div className="panel-info">
        <span className="info-label">起始状态:</span>
        <span className="info-value">{relationEdge.source}</span>
      </div>

      {/* target 状态（只读） */}
      <div className="panel-info">
        <span className="info-label">目标状态:</span>
        <span className="info-value">{relationEdge.target}</span>
      </div>

      {/* 转换标签（event[guard]/action 格式） */}
      <label className="panel-label">
        转换标签
        <input
          className="panel-input"
          type="text"
          value={transitionLabel}
          placeholder="如: click[isValid]/handleClick"
          onChange={(e) => {
            const value = e.target.value;
            // 同步更新 transitionLabel 和 label（label 用于边上的显示文本）
            onUpdate({
              transitionLabel: value || undefined,
              label: value || undefined,
            });
          }}
        />
      </label>

      {/* 格式说明 */}
      <div className="panel-hint" style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
        格式: event[guard]/action（各部分可选）
      </div>

      <div className="panel-info">
        <span className="info-label">ID:</span>
        <span className="info-value">{relationEdge.id}</span>
      </div>
    </div>
  );
});

StateRelationEditor.displayName = 'StateRelationEditor';

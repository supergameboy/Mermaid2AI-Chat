/**
 * StatePropertyEditor — stateDiagram 状态节点属性编辑面板
 *
 * 单一职责：编辑状态节点的名称、状态类型、描述、样式
 *
 * 数据流:
 *   MermaidNode → StatePropertyEditor → onUpdate(Partial<MermaidNodeData>) → 更新 CanvasState
 *
 * 字段约定（通过 MermaidNodeData 承载）:
 *   - label: string                  — 状态名（M0 定义）
 *   - stateType?: StateNodeType      — 状态类型（M0 定义，default/fork/join/choice/divider/start/end）
 *   - stateDescription?: string      — 状态描述（M0 定义，仅 default 类型可用）
 *   - style?: NodeStyle              — 节点样式（M0 定义）
 */

import { memo } from 'react';
import type { MermaidNode, StateNodeType, NodeStyle } from '@mermaid2aichat/serializer';

export interface StatePropertyEditorProps {
  /** 当前编辑的状态节点 */
  stateNode: MermaidNode;
  /** 更新回调 */
  onUpdate: (data: Partial<MermaidNode['data']>) => void;
}

/** 状态类型选项（7 种，对齐 StateNodeType） */
const STATE_TYPE_OPTIONS: { value: StateNodeType; label: string }[] = [
  { value: 'default', label: '普通状态' },
  { value: 'start', label: '起始状态' },
  { value: 'end', label: '结束状态' },
  { value: 'fork', label: '分叉' },
  { value: 'join', label: '汇合' },
  { value: 'choice', label: '选择' },
  { value: 'divider', label: '分隔' },
];

/** 状态属性编辑面板组件 */
export const StatePropertyEditor = memo(function StatePropertyEditor({
  stateNode,
  onUpdate,
}: StatePropertyEditorProps) {
  const data = stateNode.data;
  const stateType = data.stateType ?? 'default';
  const stateDescription = data.stateDescription ?? '';
  const style = data.style;

  // 仅 default 类型可编辑 label 和 description
  const isDefaultType = stateType === 'default';

  return (
    <div className="panel-content">
      {/* 状态类型 */}
      <label className="panel-label">
        状态类型
        <select
          className="panel-select"
          value={stateType}
          onChange={(e) => {
            const newType = e.target.value as StateNodeType;
            // 切换到非 default 类型时清除描述（描述仅 default 可用）
            const patch: Partial<MermaidNode['data']> = { stateType: newType };
            if (newType !== 'default') {
              patch.stateDescription = undefined;
            }
            onUpdate(patch);
          }}
        >
          {STATE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      {/* 状态名（仅 default 类型可编辑） */}
      {isDefaultType && (
        <label className="panel-label">
          状态名
          <input
            className="panel-input"
            type="text"
            value={data.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
          />
        </label>
      )}

      {/* 状态描述（仅 default 类型可用） */}
      {isDefaultType && (
        <label className="panel-label">
          状态描述
          <input
            className="panel-input"
            type="text"
            value={stateDescription}
            placeholder="如: 进入此状态时执行的操作"
            onChange={(e) => onUpdate({ stateDescription: e.target.value || undefined })}
          />
        </label>
      )}

      {/* 样式编辑 */}
      <div className="panel-section-title">样式</div>
      <label className="panel-label panel-color-row">
        填充色
        <input
          className="panel-color"
          type="color"
          value={style?.fill ?? '#ffffff'}
          onChange={(e) =>
            onUpdate({
              style: { ...style, fill: e.target.value } as NodeStyle,
            })
          }
        />
      </label>
      <label className="panel-label panel-color-row">
        边框色
        <input
          className="panel-color"
          type="color"
          value={style?.stroke ?? '#333333'}
          onChange={(e) =>
            onUpdate({
              style: { ...style, stroke: e.target.value } as NodeStyle,
            })
          }
        />
      </label>
      <label className="panel-label panel-color-row">
        文字色
        <input
          className="panel-color"
          type="color"
          value={style?.color ?? '#333333'}
          onChange={(e) =>
            onUpdate({
              style: { ...style, color: e.target.value } as NodeStyle,
            })
          }
        />
      </label>
      <button
        className="panel-reset-btn"
        type="button"
        onClick={() => onUpdate({ style: undefined })}
      >
        重置样式
      </button>

      <div className="panel-info">
        <span className="info-label">ID:</span>
        <span className="info-value">{stateNode.id}</span>
      </div>
    </div>
  );
});

StatePropertyEditor.displayName = 'StatePropertyEditor';

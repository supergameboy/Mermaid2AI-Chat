/**
 * MindmapPropertyEditor — mindmap 节点属性编辑面板
 *
 * 单一职责：编辑 mindmap 节点的文本、形状、图标、CSS 类、样式
 *
 * 数据流:
 *   MermaidNode → MindmapPropertyEditor → onUpdate(Partial<MermaidNodeData>) → 更新 CanvasState
 *
 * 字段约定（通过 MermaidNodeData 承载）:
 *   - label: string                  — 节点文本（M0 定义）
 *   - mindmapType?: MindmapNodeType  — 节点形状（M0 定义，7 种）
 *   - mindmapIcon?: string           — 节点图标（M0 定义）
 *   - mindmapClass?: string          — 节点 CSS 类（M0 定义）
 *   - style?: NodeStyle              — 节点样式（M0 定义）
 */

import { memo } from 'react';
import type { MermaidNode, MindmapNodeType, NodeStyle } from '@mermaid2aichat/serializer';

export interface MindmapPropertyEditorProps {
  /** 当前编辑的 mindmap 节点 */
  mindmapNode: MermaidNode;
  /** 更新回调 */
  onUpdate: (data: Partial<MermaidNode['data']>) => void;
}

/** mindmap 节点形状选项（7 种，对齐 MindmapNodeType） */
const MINDMAP_TYPE_OPTIONS: { value: MindmapNodeType; label: string }[] = [
  { value: 'default', label: '默认（无边框）' },
  { value: 'rect', label: '矩形 [文本]' },
  { value: 'rounded', label: '圆角矩形 (文本)' },
  { value: 'circle', label: '圆形 ((文本))' },
  { value: 'cloud', label: '云形 )文本)' },
  { value: 'bang', label: '爆炸形 ))文本))' },
  { value: 'hexagon', label: '六边形 {{文本}}' },
];

/** mindmap 节点属性编辑面板组件 */
export const MindmapPropertyEditor = memo(function MindmapPropertyEditor({
  mindmapNode,
  onUpdate,
}: MindmapPropertyEditorProps) {
  const data = mindmapNode.data;
  const mindmapType = data.mindmapType ?? 'default';
  const mindmapIcon = data.mindmapIcon ?? '';
  const mindmapClass = data.mindmapClass ?? '';
  const style = data.style;

  return (
    <div className="panel-content">
      {/* 节点文本 */}
      <label className="panel-label">
        文本
        <input
          className="panel-input"
          type="text"
          value={data.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
        />
      </label>

      {/* 节点形状 */}
      <label className="panel-label">
        形状
        <select
          className="panel-select"
          value={mindmapType}
          onChange={(e) => {
            const newType = e.target.value as MindmapNodeType;
            // 同步更新 shape 字段（mindmap-${type}）
            onUpdate({
              mindmapType: newType,
              shape: `mindmap-${newType}` as MermaidNode['data']['shape'],
            });
          }}
        >
          {MINDMAP_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      {/* 图标（::icon(name)） */}
      <label className="panel-label">
        图标
        <input
          className="panel-input"
          type="text"
          value={mindmapIcon}
          placeholder="如: fa fa-book"
          onChange={(e) => onUpdate({ mindmapIcon: e.target.value || undefined })}
        />
      </label>

      {/* CSS 类（:::className） */}
      <label className="panel-label">
        CSS 类
        <input
          className="panel-input"
          type="text"
          value={mindmapClass}
          placeholder="如: highlight"
          onChange={(e) => onUpdate({ mindmapClass: e.target.value || undefined })}
        />
      </label>

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
        <span className="info-value">{mindmapNode.id}</span>
      </div>
      {mindmapNode.parentId && (
        <div className="panel-info">
          <span className="info-label">父节点:</span>
          <span className="info-value">{mindmapNode.parentId}</span>
        </div>
      )}
    </div>
  );
});

MindmapPropertyEditor.displayName = 'MindmapPropertyEditor';

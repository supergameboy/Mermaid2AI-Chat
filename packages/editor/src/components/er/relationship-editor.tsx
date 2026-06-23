/**
 * RelationshipEditor — erDiagram 关系属性编辑面板
 *
 * 单一职责：编辑关系边的基数、关系类型、角色标签
 *
 * 数据流:
 *   MermaidEdge → RelationshipEditor → onUpdate(Partial<MermaidEdgeData>) → 更新 CanvasState
 *
 * 字段约定:
 *   - cardinality?: { from: ERCardinality; to: ERCardinality }  — 基数（M0 定义）
 *   - erIdentification?: ERIdentification                       — 关系类型（er 专用）
 *   - erRole?: string                                           — 角色标签（er 专用）
 */

import { memo } from 'react';
import type { MermaidEdge, ERCardinality, ERIdentification } from '@mermaid2aichat/serializer';

export interface RelationshipEditorProps {
  /** 当前编辑的关系边 */
  relationshipEdge: MermaidEdge;
  /** 更新回调 */
  onUpdate: (data: Partial<MermaidEdge['data']>) => void;
}

/** 基数选项（5 种，source 端）
 *
 * 注意：MD_PARENT 使用 'u' 符号，仅 source 端（from）有效
 */
const CARDINALITY_OPTIONS: { value: ERCardinality; label: string }[] = [
  { value: 'zero-or-one', label: '|o 零或一' },
  { value: 'zero-or-more', label: 'o{ 零或多' },
  { value: 'one-or-more', label: '|{ 一或多' },
  { value: 'only-one', label: '|| 仅一' },
  { value: 'md-parent', label: 'u 多对多父节点 (仅 from 端)' },
];

/** target 端基数选项（4 种，排除 md-parent）
 *
 * md-parent 在 target 端无效：jison 语法 u(?=[.\\-|]) 只匹配后跟 -/./| 的 u，
 * 在 target 端 u 后跟空格，会被解析为 UNICODE_TEXT 而非 MD_PARENT。
 */
const TARGET_CARDINALITY_OPTIONS: { value: ERCardinality; label: string }[] = [
  { value: 'zero-or-one', label: '|o 零或一' },
  { value: 'zero-or-more', label: 'o{ 零或多' },
  { value: 'one-or-more', label: '|{ 一或多' },
  { value: 'only-one', label: '|| 仅一' },
];

/** 关系类型选项（2 种） */
const IDENTIFICATION_OPTIONS: { value: ERIdentification; label: string }[] = [
  { value: 'identifying', label: '标识关系 (-- 实线)' },
  { value: 'non-identifying', label: '非标识关系 (.. 虚线)' },
];

/** 安全读取 MermaidEdgeData 的扩展字段 */
function readField<T>(data: MermaidEdge['data'], key: string): T | undefined {
  const value = (data as Record<string, unknown>)[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as T;
}

/** 关系编辑面板组件 */
export const RelationshipEditor = memo(function RelationshipEditor({
  relationshipEdge,
  onUpdate,
}: RelationshipEditorProps) {
  const data = relationshipEdge.data;
  const cardinality = data.cardinality ?? { from: 'only-one' as ERCardinality, to: 'only-one' as ERCardinality };
  const fromCardinality = cardinality.from;
  const toCardinality = cardinality.to;
  const identification = readField<ERIdentification>(data, 'erIdentification') ?? 'identifying';
  const role = readField<string>(data, 'erRole') ?? '';

  return (
    <div className="panel-content">
      {/* source 实体（只读） */}
      <div className="panel-info">
        <span className="info-label">起始实体:</span>
        <span className="info-value">{relationshipEdge.source}</span>
      </div>

      {/* target 实体（只读） */}
      <div className="panel-info">
        <span className="info-label">目标实体:</span>
        <span className="info-value">{relationshipEdge.target}</span>
      </div>

      {/* from 基数 */}
      <label className="panel-label">
        基数（起始端）
        <select
          className="panel-select"
          value={fromCardinality}
          onChange={(e) => {
            const from = e.target.value as ERCardinality;
            onUpdate({ cardinality: { from, to: toCardinality } });
          }}
        >
          {CARDINALITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      {/* to 基数（排除 md-parent，target 端无效） */}
      <label className="panel-label">
        基数（目标端）
        <select
          className="panel-select"
          value={toCardinality}
          onChange={(e) => {
            const to = e.target.value as ERCardinality;
            onUpdate({ cardinality: { from: fromCardinality, to } });
          }}
        >
          {TARGET_CARDINALITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      {/* 关系类型 */}
      <label className="panel-label">
        关系类型
        <select
          className="panel-select"
          value={identification}
          onChange={(e) => {
            const value = e.target.value as ERIdentification;
            onUpdate({ erIdentification: value });
          }}
        >
          {IDENTIFICATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      {/* 角色标签 */}
      <label className="panel-label">
        角色标签
        <input
          className="panel-input"
          type="text"
          value={role}
          placeholder="如: contains, owns"
          onChange={(e) => {
            const value = e.target.value;
            onUpdate({
              erRole: value || undefined,
              label: value || undefined,
            });
          }}
        />
      </label>

      <div className="panel-info">
        <span className="info-label">ID:</span>
        <span className="info-value">{relationshipEdge.id}</span>
      </div>
    </div>
  );
});

RelationshipEditor.displayName = 'RelationshipEditor';

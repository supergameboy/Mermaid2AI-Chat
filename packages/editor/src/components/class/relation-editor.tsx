/**
 * RelationEditor — classDiagram 关系属性编辑面板
 *
 * 单一职责：编辑关系边的类型、基数、标签
 *
 * 数据流:
 *   MermaidEdge → RelationEditor → onUpdate(Partial<MermaidEdgeData>) → 更新 CanvasState
 */

import { memo } from 'react';
import type { MermaidEdge, ClassRelationType } from '@mermaid2aichat/serializer';

export interface RelationEditorProps {
  /** 当前编辑的关系边 */
  relation: MermaidEdge;
  /** 更新回调 */
  onUpdate: (data: Partial<MermaidEdge['data']>) => void;
}

/** 关系类型选项（7 种） */
const RELATION_TYPE_OPTIONS: { value: ClassRelationType; label: string }[] = [
  { value: 'extension', label: '继承 (<|--)' },
  { value: 'composition', label: '组合 (*--)' },
  { value: 'aggregation', label: '聚合 (o--)' },
  { value: 'association', label: '关联 (-->)' },
  { value: 'dependency', label: '依赖 (<..)' },
  { value: 'realization', label: '实现 (<|..)' },
  { value: 'lollipop', label: '棒棒糖 (--o)' },
];

/** class 关系基数（class 专用，通过索引签名承载） */
interface ClassCardinality {
  from: string;
  to: string;
}

/** 安全读取扩展字段 */
function readField<T>(data: MermaidEdge['data'], key: string): T | undefined {
  const value = (data as Record<string, unknown>)[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as T;
}

/** 关系编辑面板组件 */
export const RelationEditor = memo(function RelationEditor({
  relation,
  onUpdate,
}: RelationEditorProps) {
  const data = relation.data;
  const cardinality = readField<ClassCardinality>(data, 'classCardinality');
  const fromCardinality = cardinality?.from ?? '';
  const toCardinality = cardinality?.to ?? '';
  const relationLabel = data.relationLabel ?? data.label ?? '';

  return (
    <div className="panel-content">
      {/* 关系类型 */}
      <label className="panel-label">
        关系类型
        <select
          className="panel-select"
          value={data.relationType ?? 'association'}
          onChange={(e) =>
            onUpdate({ relationType: e.target.value as ClassRelationType })
          }
        >
          {RELATION_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      {/* 基数 from */}
      <label className="panel-label">
        基数（起始端）
        <input
          className="panel-input"
          type="text"
          value={fromCardinality}
          placeholder="如: 1, 0..*, 1..1"
          onChange={(e) => {
            const from = e.target.value;
            onUpdate({
              classCardinality: { from, to: toCardinality },
            });
          }}
        />
      </label>

      {/* 基数 to */}
      <label className="panel-label">
        基数（目标端）
        <input
          className="panel-input"
          type="text"
          value={toCardinality}
          placeholder="如: 0..*, 1, 1..n"
          onChange={(e) => {
            const to = e.target.value;
            onUpdate({
              classCardinality: { from: fromCardinality, to },
            });
          }}
        />
      </label>

      {/* 关系标签 */}
      <label className="panel-label">
        关系标签
        <input
          className="panel-input"
          type="text"
          value={relationLabel}
          placeholder="如: places, owns"
          onChange={(e) => {
            const value = e.target.value;
            onUpdate({
              relationLabel: value || undefined,
              label: value || undefined,
            });
          }}
        />
      </label>

      <div className="panel-info">
        <span className="info-label">ID:</span>
        <span className="info-value">{relation.id}</span>
      </div>
      <div className="panel-info">
        <span className="info-label">连接:</span>
        <span className="info-value">{relation.source} → {relation.target}</span>
      </div>
    </div>
  );
});

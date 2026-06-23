/**
 * BlockEditor — 时序图块结构属性编辑面板
 *
 * 单一职责：编辑块类型（alt/opt/loop/par/critical/break）和标签
 */
import { memo } from 'react';
import type { SequenceBlockInfo, SequenceBlockType } from '@mermaid2aichat/serializer';

export interface BlockEditorProps {
  /** 当前编辑的块信息 */
  block: SequenceBlockInfo;
  /** 块在 blocks 数组中的索引 */
  blockIndex: number;
  /** 更新回调 */
  onUpdate: (data: Partial<SequenceBlockInfo>) => void;
}

/** 块类型选项 */
const BLOCK_TYPE_OPTIONS: { value: SequenceBlockType; label: string }[] = [
  { value: 'alt', label: 'alt (条件分支)' },
  { value: 'opt', label: 'opt (可选)' },
  { value: 'loop', label: 'loop (循环)' },
  { value: 'par', label: 'par (并行)' },
  { value: 'par-over', label: 'par_over (并行覆盖)' },
  { value: 'critical', label: 'critical (关键)' },
  { value: 'break', label: 'break (中断)' },
  { value: 'rect', label: 'rect (矩形)' },
  { value: 'autonumber', label: 'autonumber (自动编号)' },
];

/** 块编辑面板组件 */
export const BlockEditor = memo(function BlockEditor({
  block,
  blockIndex,
  onUpdate,
}: BlockEditorProps) {
  void blockIndex;

  return (
    <div className="panel-content">
      {/* 块类型 */}
      <label className="panel-label">
        类型
        <select
          className="panel-select"
          value={block.type}
          onChange={(e) =>
            onUpdate({ type: e.target.value as SequenceBlockType })
          }
        >
          {BLOCK_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      {/* 标签 */}
      <label className="panel-label">
        标签
        <input
          className="panel-input"
          type="text"
          value={block.label ?? ''}
          placeholder="（可选标签）"
          onChange={(e) => onUpdate({ label: e.target.value })}
        />
      </label>

      <div className="panel-info">
        <span className="info-label">起始消息:</span>
        <span className="info-value">{block.startMessage}</span>
      </div>
      <div className="panel-info">
        <span className="info-label">结束消息:</span>
        <span className="info-value">{block.endMessage ?? '未指定'}</span>
      </div>
    </div>
  );
});

/**
 * NoteEditor — classDiagram 注释编辑面板
 *
 * 单一职责：添加/编辑/删除注释，选择关联类
 *
 * 数据流:
 *   ClassNoteInfo[] → NoteEditor → onCreate/onUpdate/onDelete → 更新 CanvasState.metadata.classNotes
 */

import { memo } from 'react';
import type { ClassNoteInfo, MermaidNode } from '@mermaid2aichat/serializer';

export interface NoteEditorProps {
  /** 当前所有注释 */
  notes: ClassNoteInfo[];
  /** 可用的类节点列表（用于关联选择） */
  classes: MermaidNode[];
  /** 创建注释 */
  onCreate: (note: ClassNoteInfo) => void;
  /** 更新注释 */
  onUpdate: (index: number, note: ClassNoteInfo) => void;
  /** 删除注释 */
  onDelete: (index: number) => void;
}

/** 注释位置选项 */
const NOTE_POSITION_OPTIONS: { value: ClassNoteInfo['position']; label: string }[] = [
  { value: 'top', label: '上方' },
  { value: 'bottom', label: '下方' },
  { value: 'left', label: '左侧' },
  { value: 'right', label: '右侧' },
];

/** 注释编辑面板组件 */
export const NoteEditor = memo(function NoteEditor({
  notes,
  classes,
  onCreate,
  onUpdate,
  onDelete,
}: NoteEditorProps) {
  const handleCreate = () => {
    const firstClass = classes[0];
    if (!firstClass) return;
    onCreate({
      classId: firstClass.id,
      position: 'top',
      label: '新注释',
    });
  };

  return (
    <div className="panel-content">
      <div className="panel-section-title">注释</div>

      {/* 添加按钮 */}
      <button
        type="button"
        className="panel-reset-btn"
        onClick={handleCreate}
        disabled={classes.length === 0}
        style={{ marginBottom: '8px' }}
      >
        添加注释
      </button>

      {classes.length === 0 && (
        <span style={{ fontSize: 12, color: '#999' }}>（需要先创建类节点）</span>
      )}

      {/* 注释列表 */}
      {notes.map((note, index) => (
        <div
          key={index}
          className="panel-member"
          style={{ border: '1px solid #e8e8e8', padding: '8px', marginBottom: '8px', borderRadius: '4px' }}
        >
          {/* 关联类 */}
          <label className="panel-label">
            关联类
            <select
              className="panel-select"
              value={note.classId}
              onChange={(e) => onUpdate(index, { ...note, classId: e.target.value })}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.data.label}</option>
              ))}
            </select>
          </label>

          {/* 位置 */}
          <label className="panel-label">
            位置
            <select
              className="panel-select"
              value={note.position}
              onChange={(e) =>
                onUpdate(index, {
                  ...note,
                  position: e.target.value as ClassNoteInfo['position'],
                })
              }
            >
              {NOTE_POSITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          {/* 注释文本 */}
          <label className="panel-label">
            注释文本
            <textarea
              className="panel-input"
              rows={3}
              value={note.label}
              onChange={(e) => onUpdate(index, { ...note, label: e.target.value })}
            />
          </label>

          {/* 删除按钮 */}
          <button
            type="button"
            className="panel-reset-btn"
            onClick={() => onDelete(index)}
            style={{ color: '#ff4d4f', borderColor: '#ff4d4f' }}
          >
            删除注释
          </button>
        </div>
      ))}
    </div>
  );
});

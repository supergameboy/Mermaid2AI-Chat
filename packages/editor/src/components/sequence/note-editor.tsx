/**
 * NoteEditor — 时序图注释属性编辑面板
 *
 * 单一职责：编辑注释的关联参与者、位置、文本
 */
import { memo } from 'react';
import type {
  SequenceNoteInfo,
  SequenceParticipantInfo,
} from '@mermaid2aichat/serializer';

export interface NoteEditorProps {
  /** 当前编辑的注释信息 */
  note: SequenceNoteInfo;
  /** 注释在 notes 数组中的索引 */
  noteIndex: number;
  /** 可用的参与者列表 */
  participants: SequenceParticipantInfo[];
  /** 更新回调 */
  onUpdate: (data: Partial<SequenceNoteInfo>) => void;
}

/** 注释位置选项 */
const NOTE_POSITION_OPTIONS: { value: 'left' | 'right' | 'over'; label: string }[] = [
  { value: 'left', label: 'Left of' },
  { value: 'right', label: 'Right of' },
  { value: 'over', label: 'Over' },
];

/** 注释编辑面板组件 */
export const NoteEditor = memo(function NoteEditor({
  note,
  noteIndex,
  participants,
  onUpdate,
}: NoteEditorProps) {
  void noteIndex;

  return (
    <div className="panel-content">
      {/* 关联参与者 */}
      <label className="panel-label">
        参与者
        <select
          className="panel-select"
          value={note.participantId}
          onChange={(e) => onUpdate({ participantId: e.target.value })}
        >
          {participants.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
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
            onUpdate({ position: e.target.value as 'left' | 'right' | 'over' })
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
          onChange={(e) => onUpdate({ label: e.target.value })}
        />
      </label>

      <div className="panel-info">
        <span className="info-label">消息索引:</span>
        <span className="info-value">{note.messageIndex}</span>
      </div>
    </div>
  );
});

/**
 * ParticipantEditor — 时序图参与者属性编辑面板
 *
 * 单一职责：编辑参与者名称、类型、所属 Box、links、properties
 */
import { memo } from 'react';
import type { MermaidNode, SequenceBoxInfo } from '@mermaid2aichat/serializer';

export interface ParticipantEditorProps {
  /** 当前编辑的参与者节点 */
  participant: MermaidNode;
  /** 可用的 Box 列表 */
  boxes: SequenceBoxInfo[];
  /** 更新回调 */
  onUpdate: (data: Partial<MermaidNode['data']>) => void;
}

/** 参与者类型选项 */
const PARTICIPANT_TYPE_OPTIONS: { value: 'participant' | 'actor'; label: string }[] = [
  { value: 'participant', label: 'Participant' },
  { value: 'actor', label: 'Actor' },
];

/** 参与者编辑面板组件 */
export const ParticipantEditor = memo(function ParticipantEditor({
  participant,
  boxes,
  onUpdate,
}: ParticipantEditorProps) {
  const data = participant.data;
  const currentBoxName = typeof data.sequenceBoxName === 'string' ? data.sequenceBoxName : '';
  const links = data.sequenceLinks as Record<string, string> | undefined;
  const properties = data.sequenceProperties as Record<string, string> | undefined;

  return (
    <div className="panel-content">
      {/* 名称 */}
      <label className="panel-label">
        名称
        <input
          className="panel-input"
          type="text"
          value={data.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
        />
      </label>

      {/* 参与者类型 */}
      <label className="panel-label">
        类型
        <select
          className="panel-select"
          value={data.participantType ?? 'participant'}
          onChange={(e) =>
            onUpdate({ participantType: e.target.value as 'participant' | 'actor' })
          }
        >
          {PARTICIPANT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      {/* 所属 Box */}
      <label className="panel-label">
        所属 Box
        <select
          className="panel-select"
          value={currentBoxName}
          onChange={(e) =>
            onUpdate({ sequenceBoxName: e.target.value || undefined })
          }
        >
          <option value="">（无）</option>
          {boxes.map((box, idx) => (
            <option key={box.id ?? idx} value={box.name}>
              {box.name}
            </option>
          ))}
        </select>
      </label>

      {/* Links（JSON 编辑） */}
      <label className="panel-label">
        Links (JSON)
        <textarea
          className="panel-input"
          rows={3}
          value={links ? JSON.stringify(links, null, 2) : '{}'}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onUpdate({ sequenceLinks: parsed });
            } catch {
              // JSON 解析失败时不更新，等待用户修正
            }
          }}
          style={{ fontFamily: 'Consolas, Monaco, monospace', fontSize: 12 }}
        />
      </label>

      {/* Properties（JSON 编辑） */}
      <label className="panel-label">
        Properties (JSON)
        <textarea
          className="panel-input"
          rows={3}
          value={properties ? JSON.stringify(properties, null, 2) : '{}'}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onUpdate({ sequenceProperties: parsed });
            } catch {
              // JSON 解析失败时不更新
            }
          }}
          style={{ fontFamily: 'Consolas, Monaco, monospace', fontSize: 12 }}
        />
      </label>

      <div className="panel-info">
        <span className="info-label">ID:</span>
        <span className="info-value">{participant.id}</span>
      </div>
    </div>
  );
});

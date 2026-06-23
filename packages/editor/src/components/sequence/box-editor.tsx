/**
 * BoxEditor — 时序图 Box 分组属性编辑面板
 *
 * 单一职责：编辑 Box 名称、颜色、包含的参与者
 */
import { memo } from 'react';
import type {
  SequenceBoxInfo,
  SequenceParticipantInfo,
} from '@mermaid2aichat/serializer';

export interface BoxEditorProps {
  /** 当前编辑的 Box 信息 */
  box: SequenceBoxInfo;
  /** Box 在 sequenceBoxes 数组中的索引 */
  boxIndex: number;
  /** 可用的参与者列表 */
  participants: SequenceParticipantInfo[];
  /** 更新回调 */
  onUpdate: (data: Partial<SequenceBoxInfo>) => void;
}

/** Box 编辑面板组件 */
export const BoxEditor = memo(function BoxEditor({
  box,
  boxIndex,
  participants,
  onUpdate,
}: BoxEditorProps) {
  void boxIndex;

  const toggleActor = (actorId: string) => {
    const current = box.actorKeys;
    const next = current.includes(actorId)
      ? current.filter((k) => k !== actorId)
      : [...current, actorId];
    onUpdate({ actorKeys: next });
  };

  return (
    <div className="panel-content">
      {/* 名称 */}
      <label className="panel-label">
        名称
        <input
          className="panel-input"
          type="text"
          value={box.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
      </label>

      {/* 颜色 */}
      <label className="panel-label panel-color-row">
        颜色
        <input
          className="panel-color"
          type="color"
          value={box.color || '#1890ff'}
          onChange={(e) => onUpdate({ color: e.target.value })}
        />
      </label>

      {/* 参与者多选 */}
      <div className="panel-label">
        包含参与者
        <div className="panel-checkbox-group" style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
          {participants.map((p) => (
            <label key={p.id} className="panel-checkbox-row">
              <input
                type="checkbox"
                checked={box.actorKeys.includes(p.id)}
                onChange={() => toggleActor(p.id)}
              />
              {p.label}
            </label>
          ))}
          {participants.length === 0 && (
            <span style={{ color: '#999', fontSize: 12 }}>无可用参与者</span>
          )}
        </div>
      </div>

      <div className="panel-info">
        <span className="info-label">ID:</span>
        <span className="info-value">{box.id}</span>
      </div>
    </div>
  );
});

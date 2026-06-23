/**
 * MessageEditor — 时序图消息属性编辑面板
 *
 * 单一职责：编辑消息的 from/to/文本/箭头类型/激活/停用
 */
import { memo } from 'react';
import type {
  MermaidEdge,
  SequenceArrowType,
  SequenceParticipantInfo,
} from '@mermaid2aichat/serializer';

export interface MessageEditorProps {
  /** 当前编辑的消息边 */
  message: MermaidEdge;
  /** 可用的参与者列表 */
  participants: SequenceParticipantInfo[];
  /** 更新 data 字段回调 */
  onUpdate: (data: Partial<MermaidEdge['data']>) => void;
  /** 更新 source 字段回调 */
  onUpdateSource: (source: string) => void;
  /** 更新 target 字段回调 */
  onUpdateTarget: (target: string) => void;
}

/** 箭头类型选项（对齐 SequenceArrowType） */
const ARROW_TYPE_OPTIONS: { value: SequenceArrowType; label: string }[] = [
  { value: 'solid-arrow', label: '实线箭头 (->>)' },
  { value: 'dotted-arrow', label: '虚线箭头 (-->>) ' },
  { value: 'solid-open', label: '实线开口 (->)' },
  { value: 'dotted-open', label: '虚线开口 (-->)' },
  { value: 'solid-cross', label: '实线十字 (-x)' },
  { value: 'dotted-cross', label: '虚线十字 (--x)' },
  { value: 'solid-point', label: '实线圆点 (-))' },
  { value: 'dotted-point', label: '虚线圆点 (--))' },
  { value: 'bidirectional-solid', label: '双向实线 (<<->>)' },
  { value: 'bidirectional-dotted', label: '双向虚线 (<<-->>) ' },
  { value: 'solid-top', label: '实线顶部 (-|\\)' },
  { value: 'solid-bottom', label: '实线底部 (-|/)' },
  { value: 'stick-top', label: '实线顶部细线 (-\\\\)' },
  { value: 'stick-bottom', label: '实线底部细线 (-/\\)' },
  { value: 'solid-top-dotted', label: '虚线顶部 (--|\\)' },
  { value: 'solid-bottom-dotted', label: '虚线底部 (--|/)' },
  { value: 'stick-top-dotted', label: '虚线顶部细线 (--\\\\)' },
  { value: 'stick-bottom-dotted', label: '虚线底部细线 (--/\\)' },
  { value: 'solid-arrow-top-reverse', label: '反向顶部实心 (/|-)' },
  { value: 'solid-arrow-bottom-reverse', label: '反向底部实心 (\\|-)' },
  { value: 'stick-arrow-top-reverse', label: '反向顶部细线 (/\\-)' },
  { value: 'stick-arrow-bottom-reverse', label: '反向底部细线 (\\\\-)' },
  { value: 'solid-arrow-top-reverse-dotted', label: '反向顶部实心点线 (/|--)' },
  { value: 'solid-arrow-bottom-reverse-dotted', label: '反向底部实心点线 (\\|--)' },
  { value: 'stick-arrow-top-reverse-dotted', label: '反向顶部细线点线 (/\\--)' },
  { value: 'stick-arrow-bottom-reverse-dotted', label: '反向底部细线点线 (\\\\--)' },
  { value: 'central-connection', label: '中心连接 (--)' },
  { value: 'central-connection-reverse', label: '中心反向连接 (--)' },
  { value: 'central-connection-dual', label: '中心双向连接 (--)' },
];

/** 消息编辑面板组件 */
export const MessageEditor = memo(function MessageEditor({
  message,
  participants,
  onUpdate,
  onUpdateSource,
  onUpdateTarget,
}: MessageEditorProps) {
  const data = message.data;

  return (
    <div className="panel-content">
      {/* From */}
      <label className="panel-label">
        From
        <select
          className="panel-select"
          value={message.source}
          onChange={(e) => onUpdateSource(e.target.value)}
        >
          {participants.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </label>

      {/* To */}
      <label className="panel-label">
        To
        <select
          className="panel-select"
          value={message.target}
          onChange={(e) => onUpdateTarget(e.target.value)}
        >
          {participants.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </label>

      {/* 消息文本 */}
      <label className="panel-label">
        消息文本
        <input
          className="panel-input"
          type="text"
          value={data.label ?? ''}
          placeholder="（无消息文本）"
          onChange={(e) => onUpdate({ label: e.target.value })}
        />
      </label>

      {/* 箭头类型 */}
      <label className="panel-label">
        箭头类型
        <select
          className="panel-select"
          value={data.messageType ?? 'solid-arrow'}
          onChange={(e) =>
            onUpdate({ messageType: e.target.value as SequenceArrowType })
          }
        >
          {ARROW_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      {/* 激活 */}
      <label className="panel-label panel-checkbox-row">
        <input
          type="checkbox"
          checked={data.activate === true}
          onChange={(e) => onUpdate({ activate: e.target.checked })}
        />
        激活目标 (+)
      </label>

      {/* 停用 */}
      <label className="panel-label panel-checkbox-row">
        <input
          type="checkbox"
          checked={data.deactivate === true}
          onChange={(e) => onUpdate({ deactivate: e.target.checked })}
        />
        停用目标 (-)
      </label>

      <div className="panel-info">
        <span className="info-label">ID:</span>
        <span className="info-value">{message.id}</span>
      </div>
      <div className="panel-info">
        <span className="info-label">顺序:</span>
        <span className="info-value">
          {typeof data.sequence === 'number' ? data.sequence + 1 : '未知'}
        </span>
      </div>
    </div>
  );
});

/** 消费状态徽章 — 显示画布消费状态和重新启用按钮 */
import type { CanvasSource } from '@mermaid2aichat/serializer';

interface ConsumedBadgeProps {
  consumed: boolean;
  canvasSource: CanvasSource;
  lastConsumedAt: number | null;
  onReset: () => void;
}

export function ConsumedBadge({ consumed, canvasSource, lastConsumedAt, onReset }: ConsumedBadgeProps) {
  let statusText = '';
  let statusClass = '';

  if (canvasSource === null) {
    statusText = '空画布';
    statusClass = 'status-empty';
  } else if (!consumed && canvasSource === 'user') {
    statusText = '待消费（用户绘制）';
    statusClass = 'status-pending';
  } else if (consumed && canvasSource === 'user') {
    statusText = '已消费';
    statusClass = 'status-consumed';
  } else if (consumed && canvasSource === 'ai') {
    statusText = 'AI生成内容（已消费）';
    statusClass = 'status-ai';
  }

  const timeText = lastConsumedAt
    ? new Date(lastConsumedAt).toLocaleTimeString('zh-CN')
    : '';

  return (
    <div className={`consumed-badge ${statusClass}`}>
      <span className="status-text">{statusText}</span>
      {timeText && <span className="status-time">{timeText}</span>}
      {consumed && (
        <button className="reset-button" onClick={onReset}>
          重新启用
        </button>
      )}
    </div>
  );
}

/** 连接状态指示器 */
import type { ConnectionStatusType } from '../types.js';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
}

const STATUS_CONFIG: Record<ConnectionStatusType, { color: string; text: string }> = {
  connected:    { color: '#52c41a', text: '已连接' },
  reconnecting: { color: '#faad14', text: '重连中...' },
  disconnected: { color: '#ff4d4f', text: '已断开' },
};

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const config = STATUS_CONFIG[status];
  return (
    <div className="connection-status">
      <span className="status-dot" style={{ backgroundColor: config.color }} />
      <span className="status-label">{config.text}</span>
    </div>
  );
}

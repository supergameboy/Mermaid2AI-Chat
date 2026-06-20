/** 工具栏 — 方向切换 + 连接模式 + 导出 */
import type { FlowchartDirection } from '@mermaid2aichat/serializer';
import type { ConnectionMode } from '../nodes/mermaid-nodes.js';

interface ToolbarProps {
  direction: FlowchartDirection;
  onDirectionChange: (dir: FlowchartDirection) => void;
  mermaidCode: string;
  connectionMode: ConnectionMode;
  onConnectionModeChange: (mode: ConnectionMode) => void;
}

const DIRECTIONS: FlowchartDirection[] = ['TB', 'TD', 'BT', 'RL', 'LR'];

export function Toolbar({ direction, onDirectionChange, mermaidCode, connectionMode, onConnectionModeChange }: ToolbarProps) {
  // 导出 mermaid 代码为 .mmd 文件
  const handleExport = () => {
    const blob = new Blob([mermaidCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowchart-${Date.now()}.mmd`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 复制 mermaid 代码到剪贴板
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mermaidCode);
    } catch {
      // 剪贴板 API 不可用时静默失败（如非 HTTPS 环境）
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <span className="toolbar-label">方向:</span>
        <select
          value={direction}
          onChange={(e) => onDirectionChange(e.target.value as FlowchartDirection)}
          className="toolbar-select"
          title="切换流程图方向并重新布局"
        >
          {DIRECTIONS.map((dir) => (
            <option key={dir} value={dir}>{dir}</option>
          ))}
        </select>
      </div>
      <div className="toolbar-section">
        <span className="toolbar-label">连线:</span>
        <select
          value={connectionMode}
          onChange={(e) => onConnectionModeChange(e.target.value as ConnectionMode)}
          className="toolbar-select"
          title="选择节点连线模式：按方向连接或就近连接"
        >
          <option value="direction">按方向</option>
          <option value="nearest">就近</option>
        </select>
      </div>
      <div className="toolbar-section">
        <h1 className="toolbar-title">Mermaid2AIChat</h1>
      </div>
      <div className="toolbar-section toolbar-actions">
        <button type="button" className="toolbar-btn" onClick={handleCopy} title="复制 Mermaid 代码到剪贴板">
          复制代码
        </button>
        <button type="button" className="toolbar-btn" onClick={handleExport} title="导出为 .mmd 文件">
          导出
        </button>
      </div>
    </div>
  );
}

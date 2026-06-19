/** 工具栏 — 方向切换 + 导出 */
import type { FlowchartDirection } from '@mermaid-editor/serializer';

interface ToolbarProps {
  direction: FlowchartDirection;
  onDirectionChange: (dir: FlowchartDirection) => void;
  mermaidCode: string;
}

const DIRECTIONS: FlowchartDirection[] = ['TB', 'TD', 'BT', 'RL', 'LR'];

export function Toolbar({ direction, onDirectionChange, mermaidCode }: ToolbarProps) {
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
        >
          {DIRECTIONS.map((dir) => (
            <option key={dir} value={dir}>{dir}</option>
          ))}
        </select>
      </div>
      <div className="toolbar-section">
        <h1 className="toolbar-title">Mermaid 反向编辑器</h1>
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

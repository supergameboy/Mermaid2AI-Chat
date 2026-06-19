/** 工具栏 — 方向切换 */
import type { FlowchartDirection } from '@mermaid-editor/serializer';

interface ToolbarProps {
  direction: FlowchartDirection;
  onDirectionChange: (dir: FlowchartDirection) => void;
}

const DIRECTIONS: FlowchartDirection[] = ['TB', 'TD', 'BT', 'RL', 'LR'];

export function Toolbar({ direction, onDirectionChange }: ToolbarProps) {
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
    </div>
  );
}

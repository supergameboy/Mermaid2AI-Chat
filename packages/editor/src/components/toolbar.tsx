/**
 * 工具栏 — 图表类型显示 + 方向切换（仅 flowchart）+ 连线模式 + 复制代码
 *
 * 单一职责：工具栏 UI，根据 diagramType 动态显示控件
 */
import type {
  DiagramType,
  FlowchartDirection,
  GraphDiagramType,
} from '@mermaid2aichat/serializer';
import { isGraphDiagramType } from '@mermaid2aichat/serializer';
import type { ConnectionMode } from '../nodes/flowchart/index.js';

interface ToolbarProps {
  /** 当前图表类型 */
  diagramType: DiagramType;
  /** 方向（仅 flowchart 使用） */
  direction: FlowchartDirection;
  onDirectionChange: (dir: FlowchartDirection) => void;
  mermaidCode: string;
  connectionMode: ConnectionMode;
  onConnectionModeChange: (mode: ConnectionMode) => void;
  /** 图表类型切换回调（用户选择新类型时触发） */
  onDiagramTypeChange?: (newType: DiagramType) => void;
}

const DIRECTIONS: FlowchartDirection[] = ['TB', 'TD', 'BT', 'RL', 'LR'];

/** 图表类型中文标签 */
const DIAGRAM_TYPE_LABELS: Record<DiagramType, string> = {
  flowchart: '流程图',
  sequenceDiagram: '时序图',
  classDiagram: '类图',
  erDiagram: 'ER图',
  mindmap: '思维导图',
  stateDiagram: '状态图',
  architecture: '架构图',
  gantt: '甘特图',
  pie: '饼图',
  timeline: '时间线',
  quadrantChart: '四象限图',
  xychart: '坐标图',
};

/** 所有图表类型（用于下拉选择器） */
const ALL_DIAGRAM_TYPES = Object.keys(DIAGRAM_TYPE_LABELS) as DiagramType[];

export function Toolbar({
  diagramType,
  direction,
  onDirectionChange,
  mermaidCode,
  connectionMode,
  onConnectionModeChange,
  onDiagramTypeChange,
}: ToolbarProps) {
  // 复制 mermaid 代码到剪贴板
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mermaidCode);
    } catch {
      // 剪贴板 API 不可用时静默失败（如非 HTTPS 环境）
    }
  };

  const isGraphType = isGraphDiagramType(diagramType);

  return (
    <div className="toolbar">
      {/* 图表类型选择器（可切换） */}
      <div className="toolbar-section">
        <span className="toolbar-label">类型:</span>
        {onDiagramTypeChange ? (
          <select
            value={diagramType}
            onChange={(e) => onDiagramTypeChange(e.target.value as DiagramType)}
            className="toolbar-select toolbar-type-select"
            title="切换图表类型"
          >
            {ALL_DIAGRAM_TYPES.map((t) => (
              <option key={t} value={t}>{DIAGRAM_TYPE_LABELS[t]}</option>
            ))}
          </select>
        ) : (
          <span className="diagram-type-badge">{DIAGRAM_TYPE_LABELS[diagramType]}</span>
        )}
      </div>

      {/* 方向选择 — 仅 flowchart 显示 */}
      {diagramType === 'flowchart' && (
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
      )}

      {/* 连线模式 — 仅图结构类型显示 */}
      {isGraphType && (
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
      )}

      <div className="toolbar-section">
        <h1 className="toolbar-title">Mermaid2AIChat</h1>
      </div>

      <div className="toolbar-section toolbar-actions">
        <button type="button" className="toolbar-btn" onClick={handleCopy} title="复制 Mermaid 代码到剪贴板">
          复制代码
        </button>
        {/* 导出按钮已移除（按用户要求） */}
      </div>
    </div>
  );
}

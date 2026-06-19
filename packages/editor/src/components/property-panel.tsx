/** 属性面板 — 选中节点/边时显示属性编辑 */
import type { MermaidNode, MermaidEdge, MermaidShapeType, MermaidEdgeStyle } from '@mermaid-editor/serializer';

interface PropertyPanelProps {
  selectedNode: MermaidNode | null;
  selectedEdge: MermaidEdge | null;
  onUpdateNode: (id: string, data: Partial<MermaidNode['data']>) => void;
  onUpdateEdge: (id: string, data: Partial<MermaidEdge['data']>) => void;
}

const SHAPE_OPTIONS: { value: MermaidShapeType; label: string }[] = [
  { value: 'rect', label: '矩形' },
  { value: 'rounded', label: '圆角' },
  { value: 'stadium', label: '体育场' },
  { value: 'diamond', label: '菱形' },
  { value: 'circle', label: '圆形' },
  { value: 'cylinder', label: '圆柱' },
  { value: 'hexagon', label: '六边形' },
  { value: 'parallelogram', label: '平行四边形' },
  { value: 'subroutine', label: '子程序' },
  { value: 'doublecircle', label: '双圆' },
  { value: 'asymmetric', label: '不对称' },
  { value: 'parallelogram-reverse', label: '反向平行四边形' },
  { value: 'trapezoid', label: '梯形' },
  { value: 'trapezoid-reverse', label: '反向梯形' },
];

const EDGE_STYLE_OPTIONS: { value: MermaidEdgeStyle; label: string }[] = [
  { value: 'arrow', label: '实线箭头 (-->)' },
  { value: 'line', label: '实线 (---)' },
  { value: 'dotted', label: '虚线 (-.-)' },
  { value: 'dotted-arrow', label: '虚线箭头 (-.->)' },
  { value: 'thick', label: '粗线箭头 (==>)' },
  { value: 'circle', label: '圆形端点 (---o)' },
  { value: 'cross', label: '交叉端点 (---x)' },
  { value: 'bidirectional', label: '双向箭头 (<--->)' },
];

export function PropertyPanel({ selectedNode, selectedEdge, onUpdateNode, onUpdateEdge }: PropertyPanelProps) {
  if (!selectedNode && !selectedEdge) {
    return (
      <div className="property-panel">
        <h3 className="panel-title">属性面板</h3>
        <p className="panel-hint">选中节点或边以编辑属性</p>
      </div>
    );
  }

  if (selectedNode) {
    return (
      <div className="property-panel">
        <h3 className="panel-title">节点属性</h3>
        <div className="panel-content">
          <label className="panel-label">
            文本
            <input
              className="panel-input"
              type="text"
              value={selectedNode.data.label}
              onChange={(e) => onUpdateNode(selectedNode.id, { label: e.target.value })}
            />
          </label>
          <label className="panel-label">
            形状
            <select
              className="panel-select"
              value={selectedNode.data.shape}
              onChange={(e) => {
                const newShape = e.target.value as MermaidShapeType;
                onUpdateNode(selectedNode.id, { shape: newShape });
              }}
            >
              {SHAPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <div className="panel-info">
            <span className="info-label">ID:</span>
            <span className="info-value">{selectedNode.id}</span>
          </div>
          <div className="panel-info">
            <span className="info-label">位置:</span>
            <span className="info-value">
              ({Math.round(selectedNode.position.x)}, {Math.round(selectedNode.position.y)})
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (selectedEdge) {
    return (
      <div className="property-panel">
        <h3 className="panel-title">边属性</h3>
        <div className="panel-content">
          <label className="panel-label">
            标签
            <input
              className="panel-input"
              type="text"
              value={selectedEdge.data.label ?? ''}
              placeholder="（无标签）"
              onChange={(e) => onUpdateEdge(selectedEdge.id, { label: e.target.value })}
            />
          </label>
          <label className="panel-label">
            样式
            <select
              className="panel-select"
              value={selectedEdge.data.edgeStyle}
              onChange={(e) => {
                const newStyle = e.target.value as MermaidEdgeStyle;
                onUpdateEdge(selectedEdge.id, { edgeStyle: newStyle });
              }}
            >
              {EDGE_STYLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <div className="panel-info">
            <span className="info-label">ID:</span>
            <span className="info-value">{selectedEdge.id}</span>
          </div>
          <div className="panel-info">
            <span className="info-label">连接:</span>
            <span className="info-value">{selectedEdge.source} → {selectedEdge.target}</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

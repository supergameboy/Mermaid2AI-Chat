/** 节点库 — 14种形状，支持点击添加和拖拽到画布 */
import type { DragEvent } from 'react';
import type { MermaidShapeType } from '@mermaid-editor/serializer';

interface NodeLibraryProps {
  onAddNode: (shape: MermaidShapeType) => void;
}

const SHAPES: { type: MermaidShapeType; label: string; icon: string }[] = [
  // 基础10种
  { type: 'rect',                   label: '矩形',       icon: '▭' },
  { type: 'rounded',                label: '圆角',       icon: '▢' },
  { type: 'stadium',                label: '体育场',     icon: '⬭' },
  { type: 'diamond',                label: '菱形',       icon: '◇' },
  { type: 'circle',                 label: '圆形',       icon: '○' },
  { type: 'cylinder',               label: '圆柱',       icon: '⌭' },
  { type: 'hexagon',                label: '六边形',     icon: '⬡' },
  { type: 'parallelogram',          label: '平行四边形', icon: '▱' },
  { type: 'subroutine',             label: '子程序',     icon: '⫼' },
  { type: 'doublecircle',           label: '双圆',       icon: '◎' },
  // 扩展4种
  { type: 'asymmetric',             label: '不对称',     icon: '▶' },
  { type: 'parallelogram-reverse',  label: '反向平行',   icon: ' ◢' },
  { type: 'trapezoid',              label: '梯形',       icon: '⏢' },
  { type: 'trapezoid-reverse',      label: '反向梯形',   icon: '⏃' },
];

export function NodeLibrary({ onAddNode }: NodeLibraryProps) {
  // 拖拽开始：将形状类型写入 dataTransfer
  const handleDragStart = (e: DragEvent<HTMLButtonElement>, shape: MermaidShapeType) => {
    e.dataTransfer.setData('application/mermaid-shape', shape);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="node-library">
      <h3 className="library-title">节点库</h3>
      <div className="node-list">
        {SHAPES.map((shape) => (
          <button
            key={shape.type}
            className="node-item"
            draggable
            onDragStart={(e) => handleDragStart(e, shape.type)}
            onClick={() => onAddNode(shape.type)}
            title={`点击添加或拖拽到画布：${shape.label}`}
          >
            <span className="node-icon">{shape.icon}</span>
            <span className="node-label">{shape.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * 节点库 — 按图表类型动态显示可用形状，支持点击添加和拖拽到画布
 *
 * 单一职责：根据 diagramType 渲染对应节点形状列表
 * - 图结构类型：显示该类型可用的形状（使用 ShapePreview 渲染真实形状预览）
 * - 数据图表类型：返回 null（不显示节点库）
 *
 * M0 增强：
 *   - 使用 ShapePreview 替换 Unicode 字符图标，确保预览与实际渲染一致
 *   - onAddNode 新增 icon 参数（为后续 icon 选择留接口）
 */
import type { DragEvent, ReactElement } from 'react';
import {
  isChartDiagramType,
  type DiagramType,
  type GraphDiagramType,
  type MermaidShapeType,
} from '@mermaid2aichat/serializer';
import { ShapePreview } from './shape-preview.js';

interface NodeLibraryProps {
  /** 当前图表类型（决定可用形状） */
  diagramType: DiagramType;
  /** 添加节点回调（M0 新增 icon 参数） */
  onAddNode: (shape: MermaidShapeType, icon?: string) => void;
}

interface ShapeOption {
  type: MermaidShapeType;
  label: string;
}

/** flowchart 可用形状（对齐 M0 MermaidShapeType） */
const FLOWCHART_SHAPES: ShapeOption[] = [
  // jison 语法形状（16 种）
  { type: 'rect', label: '矩形' },
  { type: 'rounded', label: '圆角' },
  { type: 'stadium', label: '体育场' },
  { type: 'ellipse', label: '椭圆' },
  { type: 'subroutine', label: '子程序' },
  { type: 'cylinder', label: '圆柱' },
  { type: 'circle', label: '圆形' },
  { type: 'doublecircle', label: '双圆' },
  { type: 'diamond', label: '菱形' },
  { type: 'hexagon', label: '六边形' },
  { type: 'odd', label: '奇形' },
  { type: 'trapezoid', label: '梯形' },
  { type: 'trapezoid-reverse', label: '倒梯形' },
  { type: 'lean-right', label: '右倾斜' },
  { type: 'lean-left', label: '左倾斜' },
  // 扩展形状（常用）
  { type: 'document', label: '文档' },
  { type: 'note', label: '便签' },
  { type: 'triangle', label: '三角形' },
  { type: 'card', label: '卡片' },
  { type: 'text', label: '文本' },
];

/** 按图表类型定义可用形状 */
const SHAPES_BY_TYPE: Record<GraphDiagramType, ShapeOption[]> = {
  flowchart: FLOWCHART_SHAPES,
  sequenceDiagram: [
    { type: 'seq-participant', label: '参与者' },
    { type: 'seq-actor', label: 'Actor' },
  ],
  classDiagram: [
    { type: 'class-box', label: '类' },
  ],
  erDiagram: [
    { type: 'er-box', label: '实体' },
  ],
  mindmap: [
    { type: 'mindmap-default', label: '默认' },
    { type: 'mindmap-rounded', label: '圆角' },
    { type: 'mindmap-circle', label: '圆形' },
    { type: 'mindmap-hexagon', label: '六边形' },
    { type: 'mindmap-cloud', label: '云形' },
    { type: 'mindmap-bang', label: '爆炸' },
  ],
  stateDiagram: [
    { type: 'state-default', label: '状态' },
    { type: 'state-start', label: '起始' },
    { type: 'state-end', label: '结束' },
    { type: 'diamond', label: '选择' },
  ],
  architecture: [
    { type: 'arch-service', label: '服务' },
    { type: 'arch-junction', label: '连接点' },
    { type: 'arch-group', label: '分组' },
  ],
};

/** 渲染形状预览图标 */
function ShapeIcon({ shape }: { shape: MermaidShapeType }): ReactElement {
  return <ShapePreview shape={shape} size={28} />;
}

export function NodeLibrary({ diagramType, onAddNode }: NodeLibraryProps): ReactElement | null {
  // 数据图表类型不显示节点库
  if (isChartDiagramType(diagramType)) {
    return null;
  }

  const shapes = SHAPES_BY_TYPE[diagramType];

  // 拖拽开始：将形状类型写入 dataTransfer
  const handleDragStart = (e: DragEvent<HTMLButtonElement>, shape: MermaidShapeType) => {
    e.dataTransfer.setData('application/mermaid-shape', shape);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="node-library">
      <h3 className="library-title">节点库</h3>
      <div className="node-list">
        {shapes.map((shape) => (
          <button
            key={shape.type}
            className="node-item"
            draggable
            onDragStart={(e) => handleDragStart(e, shape.type)}
            onClick={() => onAddNode(shape.type)}
            title={`点击添加或拖拽到画布：${shape.label}`}
          >
            <span className="node-icon">
              <ShapeIcon shape={shape.type} />
            </span>
            <span className="node-label">{shape.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

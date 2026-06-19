/**
 * 14种 Mermaid 节点组件
 * 使用 SVG 渲染形状，确保文本不变形
 * 每种形状对应一个 React Flow 自定义节点
 */
import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { MermaidShapeType, MermaidNodeData } from '@mermaid-editor/serializer';

/** React Flow 节点类型，data 为 MermaidNodeData */
type MermaidFlowNode = Node<MermaidNodeData, MermaidShapeType>;

const handleStyle = { width: 8, height: 8 };

/** 通用节点组件 — 根据形状渲染不同 SVG 形状 */
export const MermaidNodeComponent = memo(({ data, selected }: NodeProps<MermaidFlowNode>) => {
  const shape = data.shape;
  const style = data.style;
  const stroke = style?.stroke ?? '#333';
  const fill = style?.fill ?? '#fff';
  const color = style?.color ?? '#333';

  return (
    <div className="mermaid-node" style={{ position: 'relative', display: 'inline-block' }}>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <ShapeRenderer shape={shape} label={data.label} stroke={stroke} fill={fill} color={color} selected={selected} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  );
});

MermaidNodeComponent.displayName = 'MermaidNode';

/** 形状渲染器 — 根据形状类型渲染对应 SVG */
function ShapeRenderer({
  shape,
  label,
  stroke,
  fill,
  color,
  selected,
}: {
  shape: MermaidShapeType;
  label: string;
  stroke: string;
  fill: string;
  color: string;
  selected: boolean;
}) {
  // 拆分 label 为多行（支持 <br>、<br/>、\n）
  const lines = label.split(/<br\s*\/?>|\n/i);
  const lineCount = lines.length;
  const lineHeight = 18;
  const baseHeight = 48;

  // 文本内容宽度估算（每字符约 8px + padding）
  const charWidth = 8;
  const padding = 24;
  const maxLineLength = Math.max(...lines.map(l => l.length));
  const textWidth = Math.max(maxLineLength * charWidth, 60);
  const width = textWidth + padding * 2;
  const height = baseHeight + (lineCount - 1) * lineHeight;
  const strokeWidth = selected ? 3 : 2;
  const strokeColor = selected ? '#1890ff' : stroke;

  const commonTextStyle: React.CSSProperties = {
    fill: color,
    fontSize: '14px',
    textAnchor: 'middle',
    dominantBaseline: 'central',
    userSelect: 'none',
    pointerEvents: 'none',
  };

  // 多行文本渲染辅助函数 — 将 label 拆分为多个 tspan 实现垂直居中
  const renderText = (textX: number, textY: number = height / 2) => (
    <text x={textX} y={textY} style={commonTextStyle}>
      {lines.map((line, i) => (
        <tspan
          key={i}
          x={textX}
          dy={i === 0 ? -(lineCount - 1) * lineHeight / 2 : lineHeight}
        >
          {line}
        </tspan>
      ))}
    </text>
  );

  switch (shape) {
    case 'rect':
      return (
        <svg width={width} height={height} style={{ display: 'block' }}>
          <rect x={1} y={1} width={width - 2} height={height - 2} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
          {renderText(width / 2)}
        </svg>
      );

    case 'rounded':
      return (
        <svg width={width} height={height} style={{ display: 'block' }}>
          <rect x={1} y={1} width={width - 2} height={height - 2} rx={12} ry={12} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
          {renderText(width / 2)}
        </svg>
      );

    case 'stadium':
      return (
        <svg width={width} height={height} style={{ display: 'block' }}>
          <rect x={1} y={1} width={width - 2} height={height - 2} rx={height / 2} ry={height / 2} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
          {renderText(width / 2)}
        </svg>
      );

    case 'diamond': {
      const cx = width / 2;
      const cy = height / 2;
      const dx = width / 2;
      const dy = height / 2;
      const points = `${cx},${cy - dy} ${cx + dx},${cy} ${cx},${cy + dy} ${cx - dx},${cy}`;
      return (
        <svg width={width} height={height} style={{ display: 'block' }}>
          <polygon points={points} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
          {renderText(cx)}
        </svg>
      );
    }

    case 'circle': {
      const size = Math.max(width, height);
      const r = size / 2 - 2;
      return (
        <svg width={size} height={size} style={{ display: 'block' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
          {renderText(size / 2, size / 2)}
        </svg>
      );
    }

    case 'cylinder': {
      const ellipseRy = 8;
      return (
        <svg width={width} height={height} style={{ display: 'block' }}>
          {/* 圆柱主体 */}
          <path
            d={`M 1 ${ellipseRy} L 1 ${height - ellipseRy} Q ${width / 2} ${height + ellipseRy - 4} ${width - 1} ${height - ellipseRy} L ${width - 1} ${ellipseRy}`}
            fill={fill}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
          {/* 顶部椭圆 */}
          <ellipse cx={width / 2} cy={ellipseRy} rx={width / 2 - 1} ry={ellipseRy} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
          {renderText(width / 2)}
        </svg>
      );
    }

    case 'hexagon': {
      const offset = 20;
      const points = `${offset},1 ${width - offset},1 ${width - 1},${height / 2} ${width - offset},${height - 1} ${offset},${height - 1} 1,${height / 2}`;
      return (
        <svg width={width} height={height} style={{ display: 'block' }}>
          <polygon points={points} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
          {renderText(width / 2)}
        </svg>
      );
    }

    case 'parallelogram': {
      const offset = 16;
      const points = `${offset},1 ${width - 1},1 ${width - offset},${height - 1} 1,${height - 1}`;
      return (
        <svg width={width} height={height} style={{ display: 'block' }}>
          <polygon points={points} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
          {renderText(width / 2)}
        </svg>
      );
    }

    case 'subroutine': {
      const innerLineX = 10;
      return (
        <svg width={width} height={height} style={{ display: 'block' }}>
          <rect x={1} y={1} width={width - 2} height={height - 2} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1={innerLineX} y1={1} x2={innerLineX} y2={height - 1} stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1={width - innerLineX} y1={1} x2={width - innerLineX} y2={height - 1} stroke={strokeColor} strokeWidth={strokeWidth} />
          {renderText(width / 2)}
        </svg>
      );
    }

    case 'doublecircle': {
      const size = Math.max(width, height);
      const r = size / 2 - 2;
      const innerR = r - 6;
      return (
        <svg width={size} height={size} style={{ display: 'block' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
          <circle cx={size / 2} cy={size / 2} r={innerR} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} />
          {renderText(size / 2, size / 2)}
        </svg>
      );
    }

    case 'asymmetric': {
      // 旗帜形状：左侧直角，右侧尖角
      const offset = 20;
      const points = `1,1 ${width - offset},1 ${width - 1},${height / 2} ${width - offset},${height - 1} 1,${height - 1}`;
      return (
        <svg width={width} height={height} style={{ display: 'block' }}>
          <polygon points={points} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
          {renderText(width / 2 - offset / 2)}
        </svg>
      );
    }

    case 'parallelogram-reverse': {
      // 反向平行四边形
      const offset = 16;
      const points = `1,1 ${width - offset},1 ${width - 1},${height - 1} ${offset},${height - 1}`;
      return (
        <svg width={width} height={height} style={{ display: 'block' }}>
          <polygon points={points} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
          {renderText(width / 2)}
        </svg>
      );
    }

    case 'trapezoid': {
      // 梯形：上窄下宽
      const offset = 20;
      const points = `${offset},1 ${width - offset},1 ${width - 1},${height - 1} 1,${height - 1}`;
      return (
        <svg width={width} height={height} style={{ display: 'block' }}>
          <polygon points={points} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
          {renderText(width / 2)}
        </svg>
      );
    }

    case 'trapezoid-reverse': {
      // 反向梯形：上宽下窄
      const offset = 20;
      const points = `1,1 ${width - 1},1 ${width - offset},${height - 1} ${offset},${height - 1}`;
      return (
        <svg width={width} height={height} style={{ display: 'block' }}>
          <polygon points={points} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
          {renderText(width / 2)}
        </svg>
      );
    }

    default:
      return (
        <svg width={width} height={height} style={{ display: 'block' }}>
          <rect x={1} y={1} width={width - 2} height={height - 2} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
          {renderText(width / 2)}
        </svg>
      );
  }
}

/** 节点类型注册 — 14种形状 */
export const nodeTypes = {
  rect: MermaidNodeComponent,
  rounded: MermaidNodeComponent,
  stadium: MermaidNodeComponent,
  diamond: MermaidNodeComponent,
  circle: MermaidNodeComponent,
  cylinder: MermaidNodeComponent,
  hexagon: MermaidNodeComponent,
  parallelogram: MermaidNodeComponent,
  subroutine: MermaidNodeComponent,
  doublecircle: MermaidNodeComponent,
  // 扩展形状
  asymmetric: MermaidNodeComponent,
  'parallelogram-reverse': MermaidNodeComponent,
  trapezoid: MermaidNodeComponent,
  'trapezoid-reverse': MermaidNodeComponent,
};

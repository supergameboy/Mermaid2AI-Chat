/**
 * 形状渲染组件 — 根据 MermaidShapeType 渲染对应 SVG 形状 + 标签
 *
 * 单一职责：根据形状类型从注册表获取路径生成器，渲染 SVG 形状和 HTML 标签
 *
 * 数据流:
 *   MermaidShapeType → shapeRegistry → PathGenerator + Decorations
 *     → SVG <path d="..."> + 装饰元素
 *     → HTML 标签（支持 FontAwesome 图标、多行文本）
 */

import { memo } from 'react';
import type { CSSProperties } from 'react';
import type { MermaidShapeType, NodeStyle } from '@mermaid2aichat/serializer';
import {
  getShapeDefinition,
  type ShapeDecoration,
} from './path-generators.js';
import { computeNodeDimensions } from './node-size.js';

// ============================================================
// 类型
// ============================================================

/** 形状组件 Props */
export interface ShapeComponentProps {
  /** 形状类型 */
  shape: MermaidShapeType;
  /** 标签文本 */
  label: string;
  /** 标签类型 */
  labelType?: 'text' | 'string' | 'markdown';
  /** 节点样式 */
  style?: NodeStyle;
  /** 是否选中 */
  selected: boolean;
  /** 图标名称（可选） */
  icon?: string;
  /** 图片 URL（可选） */
  img?: string;
}

// ============================================================
// 常量
// ============================================================

/** 默认样式 */
const DEFAULT_STROKE = '#333333';
const DEFAULT_FILL = '#ffffff';
const DEFAULT_COLOR = '#333333';
const DEFAULT_FONT_SIZE = 14;
const DEFAULT_LINE_HEIGHT = 18;

/** Handle 样式 */
export const handleStyle = { width: 8, height: 8 };

// ============================================================
// 标签图标解析
// ============================================================

interface LabelParseResult {
  /** 移除图标语法后的纯净标签 */
  cleanLabel: string;
  /** FontAwesome CSS 类名列表 */
  faIcons: string[];
}

/**
 * 解析 label 中的 FontAwesome 图标语法
 *
 * 官方语法: fa[bklrs]?:fa-xxx，例如:
 *   - fa:fa-car      → fa-solid fa-car
 *   - fab:fa-twitter → fa-brands fa-twitter
 *   - fas:fa-car     → fa-solid fa-car
 *
 * 同时支持通过 metadata icon 字段传入的图标类名（如 "fa fa-car"）
 */
function parseLabelIcons(label: string, icon?: string): LabelParseResult {
  const faIcons: string[] = [];

  // 1. 解析 label 文本中的 fa:fa-xxx 语法
  const cleanLabel = label
    .replace(/\b(fa[bklrs]?):fa-([\w-]+)\b/g, (_match, prefix, iconName) => {
      const styleClass = mapFaPrefixToStyle(prefix);
      faIcons.push(`${styleClass} fa-${iconName}`);
      return '';
    })
    .replace(/\s+/g, ' ')
    .trim();

  // 2. 解析 metadata icon 字段（如 "fa fa-car" 或 "fas fa-car"）
  if (icon) {
    const iconClasses = icon
      .split(/\s+/)
      .filter(Boolean)
      .map((cls) => (cls === 'fa' ? 'fas' : cls));
    faIcons.push(iconClasses.join(' '));
  }

  return { cleanLabel, faIcons };
}

/** 将 FontAwesome 前缀映射到 CSS 样式类 */
function mapFaPrefixToStyle(prefix: string): string {
  switch (prefix) {
    case 'fab':
      return 'fa-brands';
    case 'far':
      return 'fa-regular';
    case 'fal':
      return 'fa-light';
    case 'fad':
      return 'fa-duotone';
    case 'fas':
    case 'fa':
    default:
      return 'fa-solid';
  }
}

// ============================================================
// 形状渲染组件
// ============================================================

/** 形状渲染器 — 根据形状类型渲染 SVG 形状 + HTML 标签 */
export const ShapeRenderer = memo(function ShapeRenderer({
  shape,
  label,
  style,
  selected,
  icon,
  img,
}: ShapeComponentProps) {
  const definition = getShapeDefinition(shape);

  // 未知形状回退为矩形
  const effectiveShape = definition ? shape : 'rect';
  const effectiveDefinition = definition ?? getShapeDefinition('rect')!;

  // 样式
  const stroke = style?.stroke ?? DEFAULT_STROKE;
  const fill = style?.fill ?? DEFAULT_FILL;
  const color = style?.color ?? DEFAULT_COLOR;
  const strokeWidth = selected ? Math.max(3, (style?.strokeWidth ?? 2) + 1) : (style?.strokeWidth ?? 2);
  const strokeColor = selected ? '#1890ff' : stroke;

  // 解析 label 中的 fa:fa-xxx 图标语法（如 fa:fa-car Car）
  const { cleanLabel, faIcons } = parseLabelIcons(label, icon);

  // 基础矩形尺寸（用于文本布局）
  const lines = cleanLabel.split(/<br\s*\/?>|\n/i);

  // 根据形状类型计算实际 SVG 画布尺寸和 viewBox
  // 非矩形形状（圆、菱形等）path 内缩 pad，容器加 pad 避免 stroke 裁切
  const shapeSizing = computeNodeDimensions(effectiveShape, cleanLabel);
  const { width, height, pathWidth, pathHeight, pad } = shapeSizing;

  // 生成 SVG path
  const pathD = effectiveDefinition.path(pathWidth, pathHeight);
  const decorations = effectiveDefinition.decorations?.(pathWidth, pathHeight) ?? [];

  // 渲染标签（HTML，支持图标、图片和多行文本）
  // 图标/图片与第一行文字在同一行，后续行换行显示
  const firstLine = lines[0] ?? '';
  const restLines = lines.slice(1);
  const hasIcon = faIcons.length > 0 || Boolean(img);
  // Bug5: 将节点 style 中的任意 CSS 属性应用到标签（如 font-size、font-family 等）
  const extraLabelStyle = nodeStyleToCss(style);
  const renderLabel = () => (
    <div
      className="mermaid-shape-label"
      style={{
        color,
        fontSize: DEFAULT_FONT_SIZE,
        lineHeight: `${DEFAULT_LINE_HEIGHT}px`,
        ...extraLabelStyle,
      }}
    >
      {hasIcon ? (
        <span className="mermaid-shape-label-row">
          {faIcons.map((cls, i) => (
            <i key={i} className={cls} />
          ))}
          {img && <img src={img} alt="" className="mermaid-shape-img" />}
          {firstLine && (
            <span className="mermaid-shape-label-line">{firstLine}</span>
          )}
        </span>
      ) : (
        firstLine && (
          <span className="mermaid-shape-label-line">{firstLine}</span>
        )
      )}
      {restLines.map((line, i) => (
        <span key={i} className="mermaid-shape-label-line">
          {line}
        </span>
      ))}
    </div>
  );

  // text 形状特殊处理（无边框，仅文本）
  if (effectiveShape === 'text') {
    return (
      <div className="mermaid-shape" style={{ width, height }}>
        {renderLabel()}
      </div>
    );
  }

  return (
    <div className="mermaid-shape" style={{ width, height }}>
      <svg
        className="mermaid-shape-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ overflow: 'visible' }}
      >
        <g transform={`translate(${pad}, ${pad})`}>
          {pathD && (
            <path
              d={pathD}
              fill={fill}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              fillRule={effectiveDefinition.evenodd ? 'evenodd' : 'nonzero'}
            />
          )}
          {decorations.map((dec, i) => (
            <DecorationElement
              key={i}
              decoration={dec}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              fill={fill}
            />
          ))}
        </g>
      </svg>
      {renderLabel()}
    </div>
  );
});

// ============================================================
// 样式辅助
// ============================================================

/**
 * 将 NodeStyle 中的非 path 样式属性转换为 React CSSProperties
 * - 保留 fill/stroke/strokeWidth/color 之外的所有原始 CSS 属性
 * - 将连字符命名（如 font-size）转换为驼峰命名（fontSize）
 */
function nodeStyleToCss(style: NodeStyle | undefined): CSSProperties | undefined {
  if (!style) return undefined;
  const { fill, stroke, strokeWidth, color, ...rest } = style;
  const css: CSSProperties = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined) continue;
    const reactKey = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    (css as Record<string, unknown>)[reactKey] = value;
  }
  return Object.keys(css).length > 0 ? css : undefined;
}

// ============================================================
// 装饰元素渲染
// ============================================================

/** 渲染单个装饰元素 */
function DecorationElement({
  decoration,
  stroke,
  strokeWidth,
  fill,
}: {
  decoration: ShapeDecoration;
  stroke: string;
  strokeWidth: number;
  fill: string;
}) {
  const { tag, attrs } = decoration;
  const commonAttrs = {
    stroke,
    strokeWidth,
    fill: tag === 'line' ? 'none' : fill,
  };

  switch (tag) {
    case 'ellipse':
      return <ellipse {...commonAttrs} {...attrs} />;
    case 'line':
      return <line {...commonAttrs} {...attrs} />;
    case 'rect':
      return <rect {...commonAttrs} {...attrs} />;
    case 'circle':
      return <circle {...commonAttrs} {...attrs} />;
    case 'path':
      return <path {...commonAttrs} {...attrs} />;
    default:
      return null;
  }
}

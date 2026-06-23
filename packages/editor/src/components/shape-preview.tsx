/**
 * ShapePreview — SVG 形状预览组件
 *
 * 单一职责：根据 MermaidShapeType 渲染小的 SVG 形状预览（用于节点库图标）
 *
 * 复用现有 path-generators.ts 的路径生成逻辑，确保预览与实际渲染一致
 *
 * 数据流:
 *   MermaidShapeType → getShapeDefinition → PathGenerator + Decorations
 *     → SVG <path d="..."> + 装饰元素（小尺寸预览）
 */

import type { ReactElement } from 'react';
import type { MermaidShapeType } from '@mermaid2aichat/serializer';
import { getShapeDefinition } from '../nodes/flowchart/shapes/path-generators.js';

// ============================================================
// 类型
// ============================================================

export interface ShapePreviewProps {
  /** 形状类型 */
  shape: MermaidShapeType;
  /** 预览尺寸（宽=高，默认 32） */
  size?: number;
  /** 边框颜色（默认 #333） */
  color?: string;
  /** 填充颜色（默认 #fff） */
  fill?: string;
}

// ============================================================
// 常量
// ============================================================

const DEFAULT_SIZE = 32;
const DEFAULT_COLOR = '#333333';
const DEFAULT_FILL = '#ffffff';

// ============================================================
// 组件实现
// ============================================================

/**
 * SVG 形状预览组件
 *
 * 使用 path-generators.ts 的路径生成器，在指定尺寸的 SVG 中渲染形状
 * 预览尺寸固定（非节点实际尺寸），用于节点库图标显示
 */
export function ShapePreview({
  shape,
  size = DEFAULT_SIZE,
  color = DEFAULT_COLOR,
  fill = DEFAULT_FILL,
}: ShapePreviewProps): ReactElement {
  const shapeDef = getShapeDefinition(shape);

  // 未知形状：渲染占位矩形
  if (!shapeDef) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect
          x="2"
          y="2"
          width={size - 4}
          height={size - 4}
          fill={fill}
          stroke={color}
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  // 使用 size 作为宽高生成路径（path-generators 接收 width/height）
  const pathD = shapeDef.path(size, size);
  const decorations = shapeDef.decorations?.(size, size) ?? [];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <path
        d={pathD}
        fill={fill}
        stroke={color}
        strokeWidth="1.5"
        fillRule={shapeDef.evenodd ? 'evenodd' : 'nonzero'}
      />
      {decorations.map((deco, i) => {
        const key = `deco-${i}`;
        const Tag = deco.tag;
        return <Tag key={key} {...deco.attrs} />;
      })}
    </svg>
  );
}

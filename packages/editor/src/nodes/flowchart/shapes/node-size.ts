/**
 * 节点尺寸计算 — 根据形状类型和标签文本计算渲染尺寸
 *
 * 单一职责：纯函数，根据 MermaidShapeType + label 计算 React Flow 节点尺寸
 *
 * 数据流:
 *   MermaidShapeType + label
 *     → 计算文本基础矩形 (baseWidth/baseHeight)
 *     → 根据形状类型增加 pad/path 尺寸
 *     → 返回节点总尺寸
 *
 * 用途:
 *   - ShapeRenderer: 渲染 SVG 形状和标签
 *   - dagre-layout: 布局算法使用真实节点尺寸而非固定默认值
 */

import type { MermaidShapeType } from '@mermaid2aichat/serializer';

// ============================================================
// 常量
// ============================================================

const DEFAULT_PADDING = 24;
const DEFAULT_BASE_HEIGHT = 48;
const DEFAULT_LINE_HEIGHT = 18;
const CHAR_WIDTH = 8;

/** 非矩形形状四周留白（避免 stroke 被裁切） */
const SHAPE_PAD = 8;

// ============================================================
// 公共 API
// ============================================================

/**
 * 节点完整尺寸计算结果
 */
export interface NodeSizeResult {
  /** 外层容器宽度（React Flow 节点尺寸） */
  width: number;
  /** 外层容器高度（React Flow 节点尺寸） */
  height: number;
  /** 传给 path 生成器的宽度 */
  pathWidth: number;
  /** 传给 path 生成器的高度 */
  pathHeight: number;
  /** path 相对容器的内边距 */
  pad: number;
}

/**
 * 根据形状类型和标签文本计算节点完整尺寸（含 path 尺寸和 pad）
 *
 * @param shape - 形状类型
 * @param label - 标签文本（可能包含 <br>、\n、FontAwesome 图标语法）
 * @returns 节点完整尺寸信息
 */
export function computeNodeDimensions(
  shape: MermaidShapeType,
  label: string,
): NodeSizeResult {
  const cleanLabel = label.replace(/\b(fa[bklrs]?):fa-[\w-]+\b/g, '').trim();
  const lines = cleanLabel.split(/<br\s*\/?>|\n/i);
  const lineCount = lines.length;
  const maxLineLength = Math.max(...lines.map((l) => l.length));
  const textWidth = Math.max(maxLineLength * CHAR_WIDTH, 60);
  const baseWidth = textWidth + DEFAULT_PADDING * 2;
  const baseHeight = DEFAULT_BASE_HEIGHT + (lineCount - 1) * DEFAULT_LINE_HEIGHT;

  return computeShapeDimensions(shape, baseWidth, baseHeight);
}

/**
 * 根据形状类型和标签文本计算节点渲染尺寸
 *
 * @param shape - 形状类型
 * @param label - 标签文本（可能包含 <br>、\n、FontAwesome 图标语法）
 * @returns 节点宽度和高度
 */
export function computeNodeSize(
  shape: MermaidShapeType,
  label: string,
): { width: number; height: number } {
  const { width, height } = computeNodeDimensions(shape, label);
  return { width, height };
}

// ============================================================
// 内部实现
// ============================================================

/**
 * 根据形状类型计算 SVG 画布尺寸
 *
 * 矩形类形状：path 与基础矩形一致
 * 圆/双圆/菱形/六边形等：path 在基础矩形内绘制，容器四周增加 pad
 */
function computeShapeDimensions(
  shape: MermaidShapeType,
  baseWidth: number,
  baseHeight: number,
): NodeSizeResult {
  const base: NodeSizeResult = {
    width: baseWidth,
    height: baseHeight,
    pathWidth: baseWidth,
    pathHeight: baseHeight,
    pad: 0,
  };

  switch (shape) {
    case 'circle':
    case 'doublecircle': {
      const baseSize = Math.max(baseWidth, baseHeight);
      return {
        width: baseSize + SHAPE_PAD * 2,
        height: baseSize + SHAPE_PAD * 2,
        pathWidth: baseSize,
        pathHeight: baseSize,
        pad: SHAPE_PAD,
      };
    }
    case 'stadium':
    case 'ellipse':
    case 'diamond':
    case 'hexagon':
    case 'trapezoid':
    case 'trapezoid-reverse':
    case 'lean-right':
    case 'lean-left':
    case 'odd': {
      return {
        width: baseWidth + SHAPE_PAD * 2,
        height: baseHeight + SHAPE_PAD * 2,
        pathWidth: baseWidth,
        pathHeight: baseHeight,
        pad: SHAPE_PAD,
      };
    }
    default:
      return base;
  }
}

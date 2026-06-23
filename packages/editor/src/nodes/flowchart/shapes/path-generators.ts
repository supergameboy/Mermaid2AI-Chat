/**
 * SVG 路径生成器 — 70+ Mermaid 形状的 SVG path 字符串生成
 *
 * 单一职责：根据宽高生成各形状的 SVG path d 属性字符串
 *
 * 对齐官方 mermaid shapes.ts 的形状定义，但使用纯函数替代 D3 handler
 * 每个函数接收 (width, height) 返回 SVG path d 字符串
 *
 * 参考:
 *   - 官方 shapes.ts: packages/mermaid/src/rendering-util/rendering-elements/shapes.ts
 *   - 官方 shapes/ 目录: 各形状的独立实现
 */

import type { MermaidShapeType } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

/** 路径生成器函数类型 */
export type PathGenerator = (width: number, height: number) => string;

/** 形状定义 */
export interface ShapeDefinition {
  /** SVG path 生成器 */
  path: PathGenerator;
  /** 是否使用 fillRule="evenodd"（带孔形状） */
  evenodd?: boolean;
  /** 额外的 SVG 子元素生成器（如 cylinder 的顶部椭圆） */
  decorations?: (width: number, height: number) => ShapeDecoration[];
}

/** 额外 SVG 装饰元素（如圆柱顶部的椭圆、子程序的竖线等） */
export interface ShapeDecoration {
  /** SVG 元素标签名 */
  tag: 'ellipse' | 'line' | 'rect' | 'circle' | 'path';
  /** SVG 属性 */
  attrs: Record<string, string | number>;
}

// ============================================================
// 辅助函数
// ============================================================

/** 生成圆弧路径（用于圆柱顶部/底部） */
function arcPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, rx, ry, startAngle);
  const end = polarToCartesian(cx, cy, rx, ry, endAngle);
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  const sweep = endAngle > startAngle ? 1 : 0;
  return `A ${rx} ${ry} 0 ${largeArc} ${sweep} ${start.x} ${start.y}`;
}

/** 极坐标转笛卡尔坐标 */
function polarToCartesian(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  angleDeg: number,
): { x: number; y: number } {
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + rx * Math.cos(angleRad),
    y: cy + ry * Math.sin(angleRad),
  };
}

// ============================================================
// 基本形状（jison 语法 16 种）
// ============================================================

/** 矩形 */
const rect: PathGenerator = (w, h) => `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;

/** 圆角矩形 */
const rounded: PathGenerator = (w, h) => {
  const r = Math.min(12, h / 4);
  return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
};

/** 体育场形 */
const stadium: PathGenerator = (w, h) => {
  const r = h / 2;
  return `M ${r} 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w - r} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 ${r} 0 Z`;
};

/** 椭圆 */
const ellipse: PathGenerator = (w, h) => {
  const rx = w / 2;
  const ry = h / 2;
  return `M ${rx} 0 A ${rx} ${ry} 0 1 0 ${rx} ${h} A ${rx} ${ry} 0 1 0 ${rx} 0 Z`;
};

/** 子程序（带竖线的矩形） */
const subroutine: PathGenerator = (w, h) => {
  const inset = 8;
  return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
};
const subroutineDecorations = (w: number, h: number): ShapeDecoration[] => [
  { tag: 'line', attrs: { x1: inset, y1: 0, x2: inset, y2: h } },
  { tag: 'line', attrs: { x1: w - inset, y1: 0, x2: w - inset, y2: h } },
];
const inset = 8;

/** 圆柱体 */
const cylinder: PathGenerator = (w, h) => {
  const ry = Math.min(8, h / 4);
  const rx = w / 2;
  return `M 0 ${ry} L 0 ${h - ry} A ${rx} ${ry} 0 0 0 ${w} ${h - ry} L ${w} ${ry}`;
};
const cylinderDecorations = (w: number, h: number): ShapeDecoration[] => {
  const ry = Math.min(8, h / 4);
  const rx = w / 2;
  return [{ tag: 'ellipse', attrs: { cx: w / 2, cy: ry, rx, ry } }];
};

/** 圆形 */
const circle: PathGenerator = (w, h) => {
  const r = Math.max(w, h) / 2;
  const cx = Math.max(w, h) / 2;
  return `M ${cx - r} ${cx} A ${r} ${r} 0 1 0 ${cx + r} ${cx} A ${r} ${r} 0 1 0 ${cx - r} ${cx} Z`;
};

/** 双圆 */
const doublecircle: PathGenerator = (w, h) => {
  const r = Math.max(w, h) / 2;
  const cx = Math.max(w, h) / 2;
  return `M ${cx - r} ${cx} A ${r} ${r} 0 1 0 ${cx + r} ${cx} A ${r} ${r} 0 1 0 ${cx - r} ${cx} Z`;
};
const doublecircleDecorations = (w: number, h: number): ShapeDecoration[] => {
  const r = Math.max(w, h) / 2 - 6;
  const cx = Math.max(w, h) / 2;
  return [{ tag: 'circle', attrs: { cx, cy: cx, r } }];
};

/** 菱形 */
const diamond: PathGenerator = (w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  return `M ${cx} 0 L ${w} ${cy} L ${cx} ${h} L 0 ${cy} Z`;
};

/** 六边形 */
const hexagon: PathGenerator = (w, h) => {
  const offset = Math.min(20, w / 4);
  return `M ${offset} 0 L ${w - offset} 0 L ${w} ${h / 2} L ${w - offset} ${h} L ${offset} ${h} L 0 ${h / 2} Z`;
};

/** 奇形（右斜矩形） */
const odd: PathGenerator = (w, h) => {
  const offset = 16;
  return `M ${offset} 0 L ${w} 0 L ${w} ${h} L 0 ${h} L ${offset} 0 Z`;
};

/** 梯形 */
const trapezoid: PathGenerator = (w, h) => {
  const offset = Math.min(20, w / 4);
  return `M ${offset} 0 L ${w - offset} 0 L ${w} ${h} L 0 ${h} Z`;
};

/** 倒梯形 */
const trapezoidReverse: PathGenerator = (w, h) => {
  const offset = Math.min(20, w / 4);
  return `M 0 0 L ${w} 0 L ${w - offset} ${h} L ${offset} ${h} Z`;
};

/** 右倾斜 */
const leanRight: PathGenerator = (w, h) => {
  const offset = Math.min(20, w / 4);
  return `M ${offset} 0 L ${w} 0 L ${w - offset} ${h} L 0 ${h} Z`;
};

/** 左倾斜 */
const leanLeft: PathGenerator = (w, h) => {
  const offset = Math.min(20, w / 4);
  return `M 0 0 L ${w - offset} 0 L ${w} ${h} L ${offset} ${h} Z`;
};

// ============================================================
// 扩展形状（shapeData，31 种常用）
// ============================================================

/** 数据存储（圆柱体变体，无顶部椭圆） */
const datastore: PathGenerator = (w, h) => {
  const ry = Math.min(8, h / 4);
  const rx = w / 2;
  return `M 0 ${ry} L 0 ${h - ry} A ${rx} ${ry} 0 0 0 ${w} ${h - ry} L ${w} ${ry} A ${rx} ${ry} 0 0 0 0 ${ry} Z`;
};

/** 文档（波浪底边矩形） */
const document: PathGenerator = (w, h) => {
  const waveH = Math.min(10, h / 6);
  return `M 0 0 L ${w} 0 L ${w} ${h - waveH} Q ${w * 0.75} ${h} ${w / 2} ${h - waveH} Q ${w * 0.25} ${h - waveH * 2} 0 ${h - waveH} Z`;
};

/** 便签（折角矩形） */
const note: PathGenerator = (w, h) => {
  const fold = Math.min(16, w / 6);
  return `M 0 0 L ${w - fold} 0 L ${w} ${fold} L ${w} ${h} L 0 ${h} Z M ${w - fold} 0 L ${w - fold} ${fold} L ${w} ${fold}`;
};

/** 三角形 */
const triangle: PathGenerator = (w, h) => {
  return `M ${w / 2} 0 L ${w} ${h} L 0 ${h} Z`;
};

/** Fork/Join（粗矩形） */
const forkJoin: PathGenerator = (w, h) => {
  const barH = Math.min(6, h / 8);
  return `M 0 ${barH} L ${w} ${barH} L ${w} ${h - barH} L 0 ${h - barH} Z`;
};

/** 沙漏 */
const hourglass: PathGenerator = (w, h) => {
  return `M 0 0 L ${w} 0 L 0 ${h} L ${w} ${h} Z`;
};

/** 闪电 */
const lightningBolt: PathGenerator = (w, h) => {
  return `M ${w * 0.4} 0 L ${w * 0.1} ${h * 0.5} L ${w * 0.4} ${h * 0.5} L ${w * 0.2} ${h} L ${w * 0.9} ${h * 0.4} L ${w * 0.5} ${h * 0.4} L ${w * 0.8} 0 Z`;
};

/** 云形 */
const cloud: PathGenerator = (w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  return `M ${cx - rx * 0.6} ${cy - ry * 0.4} Q ${cx - rx} ${cy - ry} ${cx - rx * 0.2} ${cy - ry * 0.8} Q ${cx} ${cy - ry} ${cx + rx * 0.3} ${cy - ry * 0.7} Q ${cx + rx} ${cy - ry * 0.3} ${cx + rx * 0.7} ${cy + ry * 0.3} Q ${cx + rx * 0.5} ${cy + ry} ${cx} ${cy + ry * 0.8} Q ${cx - rx * 0.5} ${cy + ry} ${cx - rx * 0.8} ${cy + ry * 0.4} Q ${cx - rx} ${cy} ${cx - rx * 0.6} ${cy - ry * 0.4} Z`;
};

/** 爆炸形 */
const bang: PathGenerator = (w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2;
  const points: string[] = [];
  const spikes = 12;
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (i * Math.PI) / spikes;
    const radius = i % 2 === 0 ? r : r * 0.7;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
  }
  return points.join(' ') + ' Z';
};

/** 文本块（无边框） */
const text: PathGenerator = () => '';

/** 卡片（凹角矩形） */
const card: PathGenerator = (w, h) => {
  const notch = Math.min(10, h / 6);
  return `M 0 0 L ${w} 0 L ${w} ${h} L ${notch} ${h} L 0 ${h - notch} Z`;
};

/** 带线矩形 */
const linedRectangle: PathGenerator = (w, h) => {
  return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
};
const linedRectangleDecorations = (w: number, h: number): ShapeDecoration[] => [
  { tag: 'line', attrs: { x1: 0, y1: 4, x2: w, y2: 4 } },
];

/** 小起点圆 */
const smallCircle: PathGenerator = (w, h) => {
  const r = Math.min(w, h, 20) / 2;
  const cx = w / 2;
  const cy = h / 2;
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
};

/** 带框圆（停止点） */
const framedCircle: PathGenerator = (w, h) => {
  const r = Math.min(w, h) / 2 - 4;
  const cx = w / 2;
  const cy = h / 2;
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
};
const framedCircleDecorations = (w: number, h: number): ShapeDecoration[] => {
  const r = Math.min(w, h) / 2 - 2;
  const cx = w / 2;
  const cy = h / 2;
  return [{ tag: 'circle', attrs: { cx, cy, r } }];
};

/** 左花括号 */
const braceLeft: PathGenerator = (w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(8, h / 8);
  return `M ${w} 0 Q ${cx} 0 ${cx} ${r} Q ${cx} ${cy - r} ${cx - r} ${cy} Q ${cx} ${cy + r} ${cx} ${h - r} Q ${cx} ${h} ${w} ${h}`;
};

/** 右花括号 */
const braceRight: PathGenerator = (w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(8, h / 8);
  return `M 0 0 Q ${cx} 0 ${cx} ${r} Q ${cx} ${cy - r} ${cx + r} ${cy} Q ${cx} ${cy + r} ${cx} ${h - r} Q ${cx} ${h} 0 ${h}`;
};

/** 双花括号 */
const braces: PathGenerator = (w, h) => {
  const r = Math.min(8, h / 8);
  const cx1 = w * 0.25;
  const cx2 = w * 0.75;
  const cy = h / 2;
  return `M ${w} 0 Q ${cx2} 0 ${cx2} ${r} Q ${cx2} ${cy - r} ${cx2 - r} ${cy} Q ${cx2} ${cy + r} ${cx2} ${h - r} Q ${cx2} ${h} ${w} ${h} M 0 0 Q ${cx1} 0 ${cx1} ${r} Q ${cx1} ${cy - r} ${cx1 + r} ${cy} Q ${cx1} ${cy + r} ${cx1} ${h - r} Q ${cx1} ${h} 0 ${h}`;
};

/** 延迟（半圆角矩形） */
const delay: PathGenerator = (w, h) => {
  const r = h / 2;
  return `M 0 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w - r} ${h} L 0 ${h} Z`;
};

/** 水平圆柱（倾斜圆柱） */
const horizontalCylinder: PathGenerator = (w, h) => {
  const rx = Math.min(8, w / 4);
  const ry = h / 2;
  return `M ${rx} 0 L ${w - rx} 0 A ${rx} ${ry} 0 0 1 ${w - rx} ${h} L ${rx} ${h} A ${rx} ${ry} 0 0 1 ${rx} 0 Z`;
};
const horizontalCylinderDecorations = (w: number, h: number): ShapeDecoration[] => {
  const rx = Math.min(8, w / 4);
  const ry = h / 2;
  return [{ tag: 'ellipse', attrs: { cx: rx, cy: h / 2, rx, ry } }];
};

/** 带线圆柱（磁盘） */
const linedCylinder: PathGenerator = cylinder;
const linedCylinderDecorations = (w: number, h: number): ShapeDecoration[] => {
  const ry = Math.min(8, h / 4);
  const rx = w / 2;
  return [
    { tag: 'ellipse', attrs: { cx: w / 2, cy: ry, rx, ry } },
    { tag: 'line', attrs: { x1: 0, y1: ry * 2, x2: w, y2: ry * 2 } },
  ];
};

/** 曲边梯形（显示器） */
const curvedTrapezoid: PathGenerator = (w, h) => {
  const r = Math.min(12, h / 4);
  return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
};

/** 分割矩形 */
const dividedRectangle: PathGenerator = (w, h) => {
  return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
};
const dividedRectangleDecorations = (w: number, h: number): ShapeDecoration[] => [
  { tag: 'line', attrs: { x1: 0, y1: h / 2, x2: w, y2: h / 2 } },
];

/** 窗格（内部存储） */
const windowPane: PathGenerator = (w, h) => {
  return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
};
const windowPaneDecorations = (w: number, h: number): ShapeDecoration[] => [
  { tag: 'line', attrs: { x1: w / 2, y1: 0, x2: w / 2, y2: h } },
  { tag: 'line', attrs: { x1: 0, y1: h / 2, x2: w, y2: h / 2 } },
];

/** 实心圆（连接点） */
const filledCircle: PathGenerator = (w, h) => {
  const r = Math.min(w, h, 16) / 2;
  const cx = w / 2;
  const cy = h / 2;
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
};

/** 凹五边形（循环限制） */
const notchedPentagon: PathGenerator = (w, h) => {
  const notch = Math.min(15, h / 4);
  return `M 0 0 L ${w} 0 L ${w} ${h} L ${notch} ${h} L 0 ${h - notch} Z`;
};

/** 倒三角 */
const flippedTriangle: PathGenerator = (w, h) => {
  return `M 0 0 L ${w} 0 L ${w / 2} ${h} Z`;
};

/** 斜矩形（手动输入） */
const slopedRectangle: PathGenerator = (w, h) => {
  const offset = Math.min(20, h / 3);
  return `M 0 ${offset} L ${w} 0 L ${w} ${h - offset} L 0 ${h} Z`;
};

/** 堆叠文档 */
const stackedDocument: PathGenerator = (w, h) => {
  const offset = 6;
  const waveH = Math.min(8, h / 8);
  return `M ${offset} ${offset} L ${w} ${offset} L ${w} ${h - waveH} Q ${w * 0.75} ${h} ${w / 2} ${h - waveH} Q ${w * 0.25} ${h - waveH * 2} ${offset} ${h - waveH} Z`;
};
const stackedDocumentDecorations = (w: number, _h: number): ShapeDecoration[] => {
  const offset = 6;
  return [
    { tag: 'path', attrs: { d: `M 0 0 L ${w - offset} 0 L ${w - offset} ${offset} L 0 ${offset} Z` } },
  ];
};

/** 堆叠矩形 */
const stackedRectangle: PathGenerator = (w, h) => {
  return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
};
const stackedRectangleDecorations = (w: number, _h: number): ShapeDecoration[] => {
  const offset = 6;
  return [
    { tag: 'path', attrs: { d: `M 0 0 L ${w - offset} 0 L ${w - offset} ${offset} L 0 ${offset} Z` } },
    { tag: 'path', attrs: { d: `M ${offset} ${offset} L ${w} ${offset} L ${w} ${offset * 2} L ${offset} ${offset * 2} Z` } },
  ];
};

/** 蝴蝶结矩形 */
const bowTieRectangle: PathGenerator = (w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z M 0 0 L ${cx} ${cy} L 0 ${h} M ${w} 0 L ${cx} ${cy} L ${w} ${h}`;
};

/** 交叉圆 */
const crossedCircle: PathGenerator = (w, h) => {
  const r = Math.min(w, h) / 2;
  const cx = w / 2;
  const cy = h / 2;
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
};
const crossedCircleDecorations = (w: number, h: number): ShapeDecoration[] => {
  const r = Math.min(w, h) / 2;
  const cx = w / 2;
  const cy = h / 2;
  const d = r * 0.707;
  return [
    { tag: 'line', attrs: { x1: cx - d, y1: cy - d, x2: cx + d, y2: cy + d } },
    { tag: 'line', attrs: { x1: cx - d, y1: cy + d, x2: cx + d, y2: cy - d } },
  ];
};

/** 标签文档 */
const taggedDocument: PathGenerator = (w, h) => {
  const tagW = Math.min(20, w / 4);
  const waveH = Math.min(8, h / 8);
  return `M ${tagW} 0 L ${w} 0 L ${w} ${h - waveH} Q ${w * 0.75} ${h} ${w / 2} ${h - waveH} Q ${w * 0.25} ${h - waveH * 2} ${tagW} ${h - waveH} Z`;
};
const taggedDocumentDecorations = (w: number, _h: number): ShapeDecoration[] => {
  const tagW = Math.min(20, w / 4);
  return [
    { tag: 'path', attrs: { d: `M 0 0 L ${tagW} 0 L ${tagW} 10 L 0 10 Z` } },
  ];
};

/** 标签矩形 */
const taggedRectangle: PathGenerator = (w, h) => {
  return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
};
const taggedRectangleDecorations = (w: number, h: number): ShapeDecoration[] => {
  const tagW = Math.min(20, w / 4);
  return [
    { tag: 'path', attrs: { d: `M 0 0 L ${tagW} 0 L ${tagW} 10 L 0 10 Z` } },
  ];
};

/** 旗帜（纸带） */
const flag: PathGenerator = (w, h) => {
  const waveH = Math.min(10, h / 4);
  return `M 0 0 L ${w} 0 L ${w} ${h - waveH} Q ${w * 0.75} ${h} ${w / 2} ${h - waveH} Q ${w * 0.25} ${h - waveH * 2} 0 ${h - waveH} Z`;
};

/** 带线文档 */
const linedDocument: PathGenerator = (w, h) => {
  const waveH = Math.min(10, h / 6);
  return `M 0 0 L ${w} 0 L ${w} ${h - waveH} Q ${w * 0.75} ${h} ${w / 2} ${h - waveH} Q ${w * 0.25} ${h - waveH * 2} 0 ${h - waveH} Z`;
};
const linedDocumentDecorations = (w: number, h: number): ShapeDecoration[] => {
  const waveH = Math.min(10, h / 6);
  return [
    { tag: 'line', attrs: { x1: 0, y1: waveH, x2: w, y2: waveH } },
  ];
};

// ============================================================
// 形状注册表
// ============================================================

/** 形状注册表 — MermaidShapeType → ShapeDefinition */
export const shapeRegistry: Partial<Record<MermaidShapeType, ShapeDefinition>> = {
  // === 基本形状（jison 语法 16 种）===
  rect: { path: rect },
  rounded: { path: rounded },
  stadium: { path: stadium },
  ellipse: { path: ellipse },
  subroutine: { path: subroutine, decorations: subroutineDecorations },
  cylinder: { path: cylinder, decorations: cylinderDecorations },
  circle: { path: circle },
  doublecircle: { path: doublecircle, decorations: doublecircleDecorations },
  diamond: { path: diamond },
  hexagon: { path: hexagon },
  odd: { path: odd },
  trapezoid: { path: trapezoid },
  'trapezoid-reverse': { path: trapezoidReverse },
  'lean-right': { path: leanRight },
  'lean-left': { path: leanLeft },
  'rect-with-prop': { path: rect },

  // === 扩展形状（shapeData）===
  datastore: { path: datastore },
  document: { path: document },
  note: { path: note },
  triangle: { path: triangle },
  'fork-join': { path: forkJoin },
  hourglass: { path: hourglass },
  'lightning-bolt': { path: lightningBolt },
  cloud: { path: cloud },
  bang: { path: bang },
  text: { path: text },
  card: { path: card },
  'lined-rectangle': { path: linedRectangle, decorations: linedRectangleDecorations },
  'small-circle': { path: smallCircle },
  'framed-circle': { path: framedCircle, decorations: framedCircleDecorations },
  'brace-left': { path: braceLeft },
  'brace-right': { path: braceRight },
  braces: { path: braces },
  delay: { path: delay },
  'horizontal-cylinder': { path: horizontalCylinder, decorations: horizontalCylinderDecorations },
  'lined-cylinder': { path: linedCylinder, decorations: linedCylinderDecorations },
  'curved-trapezoid': { path: curvedTrapezoid },
  'divided-rectangle': { path: dividedRectangle, decorations: dividedRectangleDecorations },
  'window-pane': { path: windowPane, decorations: windowPaneDecorations },
  'filled-circle': { path: filledCircle },
  'notched-pentagon': { path: notchedPentagon },
  'flipped-triangle': { path: flippedTriangle },
  'sloped-rectangle': { path: slopedRectangle },
  'stacked-document': { path: stackedDocument, decorations: stackedDocumentDecorations },
  'stacked-rectangle': { path: stackedRectangle, decorations: stackedRectangleDecorations },
  'bow-tie-rectangle': { path: bowTieRectangle },
  'crossed-circle': { path: crossedCircle, decorations: crossedCircleDecorations },
  'tagged-document': { path: taggedDocument, decorations: taggedDocumentDecorations },
  'tagged-rectangle': { path: taggedRectangle, decorations: taggedRectangleDecorations },
  flag: { path: flag },
  'lined-document': { path: linedDocument, decorations: linedDocumentDecorations },
};

/**
 * 获取形状定义
 * @param shape - MermaidShapeType
 * @returns ShapeDefinition 或 undefined（未知形状）
 */
export function getShapeDefinition(shape: MermaidShapeType): ShapeDefinition | undefined {
  return shapeRegistry[shape];
}

/**
 * 检查形状是否已注册
 */
export function isShapeSupported(shape: MermaidShapeType): boolean {
  return shape in shapeRegistry;
}

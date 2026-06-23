/**
 * 形状边界计算 — 根据形状类型计算 Handle 偏移量
 *
 * 单一职责：纯函数，根据形状类型和节点尺寸返回 Handle 在各方向的偏移量
 *
 * 用途:
 *   React Flow 的 Handle position 属性只接受 Position 枚举（Left/Right/Top/Bottom）
 *   对于非矩形形状（circle/diamond/hexagon 等），Handle 需要通过 style.transform 偏移到形状几何边界
 *
 * 偏移量相对于 Handle 的默认位置:
 *   - Top Handle 默认在 (width/2, 0)
 *   - Bottom Handle 默认在 (width/2, height)
 *   - Left Handle 默认在 (0, height/2)
 *   - Right Handle 默认在 (width, height/2)
 */

import type { MermaidShapeType } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

/** 形状边界信息 */
export interface ShapeBoundary {
  /** Handle 在各方向的偏移量（相对于默认位置，单位 px） */
  handleOffsets: {
    top: { x: number; y: number };
    bottom: { x: number; y: number };
    left: { x: number; y: number };
    right: { x: number; y: number };
  };
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 根据形状类型和节点尺寸计算 Handle 偏移量
 *
 * 对于矩形形状（rect/rounded 等），Handle 在节点边缘（偏移量为 0）
 * 对于非矩形形状（circle/diamond/hexagon 等），Handle 偏移到形状几何边界
 *
 * @param shape - 形状类型
 * @param width - 节点宽度
 * @param height - 节点高度
 * @returns 形状边界信息（Handle 偏移量）
 */
export function getShapeBoundary(
  shape: MermaidShapeType,
  width: number,
  height: number,
): ShapeBoundary {
  const cx = width / 2;
  const cy = height / 2;

  switch (shape) {
    // === 圆形 ===
    case 'circle':
    case 'doublecircle': {
      // 圆形半径 = min(width, height) / 2
      const r = Math.min(width, height) / 2;
      return {
        handleOffsets: {
          top: { x: 0, y: cy - r },
          bottom: { x: 0, y: r - cy },
          left: { x: cx - r, y: 0 },
          right: { x: r - cx, y: 0 },
        },
      };
    }

    // === 菱形 ===
    case 'diamond': {
      // 菱形顶点在 (cx, 0), (width, cy), (cx, height), (0, cy)
      // Handle 在顶点上，偏移量为 0
      return {
        handleOffsets: {
          top: { x: 0, y: 0 },
          bottom: { x: 0, y: 0 },
          left: { x: 0, y: 0 },
          right: { x: 0, y: 0 },
        },
      };
    }

    // === 六边形 ===
    case 'hexagon': {
      // 六边形 {{label}} 的边界比矩形内缩
      // 简化: Handle 偏移到六边形的边中点
      const inset = Math.min(width, height) * 0.15;
      return {
        handleOffsets: {
          top: { x: 0, y: 0 },
          bottom: { x: 0, y: 0 },
          left: { x: inset, y: 0 },
          right: { x: -inset, y: 0 },
        },
      };
    }

    // === 椭圆 ===
    case 'ellipse':
    case 'stadium': {
      // 椭圆 (-label-) 的边界比矩形内缩
      // Handle 在椭圆边界上
      const ry = height / 2;
      const rx = width / 2;
      // top Handle: y 偏移 = 0（椭圆顶部在 y=0）
      // 但椭圆方程: (x-cx)^2/rx^2 + (y-cy)^2/ry^2 = 1
      // top Handle 在 (cx, 0)，偏移量 0
      return {
        handleOffsets: {
          top: { x: 0, y: 0 },
          bottom: { x: 0, y: 0 },
          left: { x: 0, y: 0 },
          right: { x: 0, y: 0 },
        },
      };
    }

    // === 矩形类形状（默认无偏移） ===
    case 'rect':
    case 'rounded':
    case 'subroutine':
    case 'cylinder':
    case 'trapezoid':
    case 'trapezoid-reverse':
    case 'lean-right':
    case 'lean-left':
    case 'rect-with-prop':
    case 'odd':
    default:
      return {
        handleOffsets: {
          top: { x: 0, y: 0 },
          bottom: { x: 0, y: 0 },
          left: { x: 0, y: 0 },
          right: { x: 0, y: 0 },
        },
      };
  }
}

/**
 * 将 Handle 偏移量转换为 CSS transform 字符串
 *
 * @param offset - Handle 偏移量
 * @returns CSS transform 字符串（如 `translate(10px, 5px)`）
 */
export function handleOffsetToTransform(offset: { x: number; y: number }): string {
  return `translate(${offset.x}px, ${offset.y}px)`;
}

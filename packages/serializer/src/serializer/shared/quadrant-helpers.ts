/**
 * Quadrant 序列化辅助函数
 *
 * 单一职责：提供 quadrantChart 序列化过程中的辅助函数
 *
 * 功能:
 *   - 坐标归一化验证（0-1 范围）
 *   - 样式序列化（NodeStyle + radius → 样式字符串）
 *   - classDef 样式合并（point 自身样式覆盖 classDef 样式）
 *   - classDef 语句序列化
 */

import type {
  NodeStyle,
  QuadrantPoint,
  StateClassDefInfo,
} from '../../types.js';

// ============================================================
// 坐标验证
// ============================================================

/**
 * 验证坐标是否在 0-1 归一化范围内
 *
 * @param value - 坐标值
 * @returns true 表示有效（0-1 范围），false 表示无效
 */
export function isValidNormalizedCoordinate(value: number): boolean {
  return value >= 0 && value <= 1;
}

/**
 * 格式化坐标为字符串
 *
 * - 整数（0 或 1）直接输出
 * - 浮点保留必要小数位（去除尾随零和精度噪声）
 *
 * 浮点精度处理：JavaScript 浮点运算会产生精度噪声（如 0.1 + 0.2 = 0.30000000000000004），
 * 拖拽计算产生的坐标可能包含精度噪声，序列化输出会包含冗余小数位。
 * 使用 toFixed(6) 截断到 6 位小数后 parseFloat 去除尾随零。
 *
 * @param value - 坐标值（0-1）
 * @returns 格式化后的字符串（如 "0.3"、"0.62"、"1"、"0"）
 */
export function formatCoordinate(value: number): string {
  // 截断精度噪声：toFixed(6) 保留 6 位小数，parseFloat 去除尾随零
  const truncated = parseFloat(value.toFixed(6));
  return String(truncated);
}

// ============================================================
// 样式序列化
// ============================================================

/**
 * 将 QuadrantPoint 的样式转换为样式字符串
 *
 * 格式: `color: #ff3300, radius: 9, stroke-color: #000, stroke-width: 10px`
 * 顺序: color → radius → stroke-color → stroke-width（对齐官方语法顺序）
 *
 * @param point - QuadrantPoint（含 style 和 radius）
 * @returns 样式字符串，无样式时返回空字符串
 */
export function serializePointStyle(point: QuadrantPoint): string {
  const parts: string[] = [];

  // color → fill（quadrant 的 color 是填充色，存储在 style.fill）
  if (point.style?.fill) {
    parts.push(`color: ${point.style.fill}`);
  }
  // radius
  if (point.radius !== undefined) {
    parts.push(`radius: ${point.radius}`);
  }
  // stroke-color → stroke
  if (point.style?.stroke) {
    parts.push(`stroke-color: ${point.style.stroke}`);
  }
  // stroke-width → strokeWidth（数字 → Npx）
  if (point.style?.strokeWidth !== undefined) {
    parts.push(`stroke-width: ${point.style.strokeWidth}px`);
  }

  return parts.join(', ');
}

// ============================================================
// classDef 样式合并
// ============================================================

/**
 * 合并 classDef 样式到数据点
 *
 * 合并规则（决策 8）:
 *   - classDef 优先级低（基础样式）
 *   - point 自身样式覆盖 classDef 样式
 *   - 合并后的样式用于渲染
 *
 * @param point - 数据点（含自身样式）
 * @param classDefs - classDef 列表
 * @returns 合并后的 NodeStyle 和 radius
 */
export function mergeClassDefStyle(
  point: QuadrantPoint,
  classDefs: StateClassDefInfo[] | undefined,
): { style: NodeStyle; radius?: number } {
  // 无 className 或无 classDef 时，直接返回 point 自身样式
  if (!point.className || !classDefs) {
    return { style: { ...point.style }, radius: point.radius };
  }

  // 查找对应的 classDef
  const classDef = classDefs.find((cd) => cd.name === point.className);
  if (!classDef) {
    return { style: { ...point.style }, radius: point.radius };
  }

  // classDef 样式作为基础，point 自身样式覆盖（point 有值时优先 point）
  const classStyle = parseClassDefStyle(classDef.style);
  return {
    style: {
      fill: point.style?.fill ?? classStyle.fill,
      stroke: point.style?.stroke ?? classStyle.stroke,
      strokeWidth: point.style?.strokeWidth ?? classStyle.strokeWidth,
    },
    radius: point.radius ?? classStyle.radius,
  };
}

/**
 * 解析 classDef 样式字符串为 NodeStyle + radius
 *
 * 输入格式: `color: #ff3300, radius: 9, stroke-color: #000, stroke-width: 10px`
 *
 * @param styleStr - 样式字符串
 * @returns NodeStyle 和 radius
 */
export function parseClassDefStyle(styleStr: string): NodeStyle & { radius?: number } {
  const result: NodeStyle & { radius?: number } = {};
  const parts = styleStr.split(',').map((s) => s.trim());

  for (const part of parts) {
    const [key, value] = part.split(/\s*:\s*/);
    if (!key || !value) continue;

    if (key === 'color') {
      result.fill = value;
    } else if (key === 'radius') {
      const num = parseInt(value, 10);
      if (!Number.isNaN(num)) {
        result.radius = num;
      }
    } else if (key === 'stroke-color') {
      result.stroke = value;
    } else if (key === 'stroke-width') {
      const match = value.match(/^(\d+)px$/);
      if (match) {
        result.strokeWidth = parseInt(match[1], 10);
      }
    }
  }

  return result;
}

// ============================================================
// classDef 语句序列化
// ============================================================

/**
 * 序列化 classDef 语句
 *
 * 格式: `classDef ClassName styles`
 *
 * @param classDef - classDef 信息
 * @returns classDef 语句字符串
 */
export function serializeClassDefStatement(classDef: StateClassDefInfo): string {
  return `classDef ${classDef.name} ${classDef.style}`;
}

// ============================================================
// 数据点序列化
// ============================================================

/**
 * 序列化数据点为 quadrantChart 语法行
 *
 * 格式:
 *   - 无样式无类: `Label: [x, y]`
 *   - 有样式无类: `Label: [x, y] radius: 9, color: #ff3300`
 *   - 无样式有类: `Label:::className: [x, y]`
 *   - 有样式有类: `Label:::className: [x, y] radius: 9`
 *
 * @param point - QuadrantPoint
 * @returns 数据点语法行
 */
export function serializePointLine(point: QuadrantPoint): string {
  const coords = `[${formatCoordinate(point.x)}, ${formatCoordinate(point.y)}]`;
  const styleStr = serializePointStyle(point);

  // 有 className 时使用 `Label:::className: [x, y]` 格式
  if (point.className) {
    const styleSuffix = styleStr ? ` ${styleStr}` : '';
    return `${point.label}:::${point.className}: ${coords}${styleSuffix}`;
  }

  // 无 className 时使用 `Label: [x, y]` 格式
  const styleSuffix = styleStr ? ` ${styleStr}` : '';
  return `${point.label}: ${coords}${styleSuffix}`;
}

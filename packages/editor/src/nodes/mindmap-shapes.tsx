/**
 * Mindmap 形状样式生成器
 *
 * 单一职责：提供 7 种 mindmap 节点形状的 CSS 样式和 section 着色
 *
 * 形状列表（对齐官方 mindmap svgDraw.ts）:
 *   - default  → 无边框文本（仅底线）
 *   - rect     → 矩形
 *   - rounded  → 圆角矩形
 *   - circle   → 圆形
 *   - cloud    → 云形
 *   - bang     → 爆炸形
 *   - hexagon  → 六边形
 */

import type { MindmapNodeType } from '@mermaid2aichat/serializer';

// ============================================================
// 常量
// ============================================================

const SELECTED_COLOR = '#1890ff';
const DEFAULT_COLOR = '#333';

/**
 * Section 颜色（对齐官方 mermaid mindmap section 着色）
 *
 * 官方使用 CSS 类名 section-0 ~ section-11，这里提供对应的颜色值。
 * root 节点的子节点按索引分配 section，每个 section 使用不同背景色。
 */
export const SECTION_COLORS: readonly string[] = [
  '#ffe8aa', // section-0 浅黄
  '#f8e8ff', // section-1 浅紫
  '#e8f4ff', // section-2 浅蓝
  '#e8ffe8', // section-3 浅绿
  '#ffe8e8', // section-4 浅红
  '#fff8e8', // section-5 浅橙
  '#e8ffff', // section-6 浅青
  '#f0e8ff', // section-7 浅靛
  '#fff0e8', // section-8 浅桃
  '#e8fff0', // section-9 浅薄荷
  '#ffe8f0', // section-10 浅粉
  '#f0f0e8', // section-11 浅卡其
];

/**
 * 根据 section 编号获取颜色
 *
 * @param section - section 编号（0-11），undefined 表示无 section
 * @returns 颜色值（白色表示无 section）
 */
export function getSectionColor(section: number | undefined): string {
  if (section === undefined || section < 0) {
    return '#ffffff';
  }
  return SECTION_COLORS[section % SECTION_COLORS.length];
}

// ============================================================
// 形状样式
// ============================================================

/**
 * 获取形状的 CSS 样式
 *
 * @param type - mindmap 节点类型
 * @param selected - 是否选中
 * @returns React.CSSProperties
 */
export function getShapeStyle(
  type: MindmapNodeType,
  selected: boolean,
): React.CSSProperties {
  const borderColor = selected ? SELECTED_COLOR : DEFAULT_COLOR;
  const borderWidth = selected ? '2px' : '1px';

  const base: React.CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 12px',
    fontSize: 14,
    boxSizing: 'border-box',
    background: '#fff',
  };

  switch (type) {
    case 'rect':
      return {
        ...base,
        border: `${borderWidth} solid ${borderColor}`,
        borderRadius: 0,
      };

    case 'rounded':
      return {
        ...base,
        border: `${borderWidth} solid ${borderColor}`,
        borderRadius: 12,
      };

    case 'circle':
      return {
        ...base,
        border: `${borderWidth} solid ${borderColor}`,
        borderRadius: '50%',
        minWidth: 80,
        minHeight: 80,
        width: 80,
        height: 80,
        textAlign: 'center',
      };

    case 'hexagon':
      return {
        ...base,
        border: `${borderWidth} solid ${borderColor}`,
        clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
        padding: '6px 24px',
      };

    case 'cloud':
      return {
        ...base,
        border: `${borderWidth} solid ${borderColor}`,
        borderRadius: '50%',
        padding: '10px 20px',
      };

    case 'bang':
      return {
        ...base,
        border: `${borderWidth} solid ${borderColor}`,
        borderRadius: '50%',
        padding: '10px 20px',
      };

    case 'default':
    default:
      // default: 无边框，仅底线
      return {
        ...base,
        border: 'none',
        borderBottom: `${borderWidth} solid ${borderColor}`,
        borderRadius: 0,
      };
  }
}

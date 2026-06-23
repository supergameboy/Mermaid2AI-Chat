/**
 * Quadrant 样式验证工具
 *
 * 单一职责：验证 quadrantChart 的 point 样式值（hex 颜色、像素值、数字）
 *
 * 移植来源: mermaid-develop/packages/mermaid/src/diagrams/quadrant-chart/utils.ts
 *
 * 验证规则:
 *   - validateHexCode: 验证 #RRGGBB 或 #RGB 格式（返回 true 表示无效）
 *   - validateNumber: 验证纯数字（返回 true 表示无效）
 *   - validateSizeInPixels: 验证 Npx 格式（返回 true 表示无效）
 *
 * 错误处理:
 *   - 无效样式抛 InvalidStyleError（程序错误不可包容，institution.md 第5章）
 */

/**
 * 无效样式错误
 *
 * 用于在 parseStyles 中抛出明确的样式验证错误
 */
export class InvalidStyleError extends Error {
  constructor(style: string, value: string, type: string) {
    super(`value for ${style} ${value} is invalid, please use a valid ${type}`);
    this.name = 'InvalidStyleError';
  }
}

/**
 * 验证 hex 颜色码
 *
 * @param value - 待验证的值（如 '#ff3300' 或 'ff3300'）
 * @returns true 表示无效，false 表示有效
 *
 * 支持格式:
 *   - #RRGGBB（6 位）
 *   - #RGB（3 位）
 *   - RRGGBB（无 # 前缀）
 *   - RGB（无 # 前缀）
 */
export function validateHexCode(value: string): boolean {
  return !/^#?([\dA-Fa-f]{6}|[\dA-Fa-f]{3})$/.test(value);
}

/**
 * 验证纯数字
 *
 * @param value - 待验证的值（如 '9'）
 * @returns true 表示无效，false 表示有效
 */
export function validateNumber(value: string): boolean {
  return !/^\d+$/.test(value);
}

/**
 * 验证像素尺寸
 *
 * @param value - 待验证的值（如 '10px'）
 * @returns true 表示无效，false 表示有效
 */
export function validateSizeInPixels(value: string): boolean {
  return !/^\d+px$/.test(value);
}

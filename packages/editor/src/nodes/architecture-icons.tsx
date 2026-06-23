/**
 * Architecture Icon 渲染器 — 12+ icon 类型的 SVG 渲染
 *
 * 单一职责：根据 icon 名称渲染对应的 SVG 图标
 *
 * icon 类型（对齐官方 architecture-beta 支持）:
 *   database / cloud / server / disk / internet / web / mobile / desktop / api / auth / files / user
 *
 * 数据流:
 *   MermaidNodeData.archIcon (string) → ArchitectureIcon → SVG 元素
 */

import type { JSX } from 'react';

// ============================================================
// 类型
// ============================================================

export interface ArchitectureIconProps {
  /** icon 名称（如 'database'/'cloud'/'server'） */
  name: string;
  /** SVG 尺寸（宽=高） */
  size?: number;
  /** 颜色 */
  color?: string;
}

// ============================================================
// 常量
// ============================================================

/** 支持的 icon 名称列表 */
export const ARCHITECTURE_ICONS = [
  'database',
  'cloud',
  'server',
  'disk',
  'internet',
  'web',
  'mobile',
  'desktop',
  'api',
  'auth',
  'files',
  'user',
] as const;

export type ArchitectureIconName = (typeof ARCHITECTURE_ICONS)[number];

/** icon 名称 → 渲染函数 映射 */
const ICON_RENDERERS: Record<string, (color: string) => JSX.Element> = {
  database: (color) => (
    <g fill="none" stroke={color} strokeWidth="1.5">
      <ellipse cx="12" cy="5" rx="8" ry="2.5" />
      <path d="M4 5 V19 A8 2.5 0 0 0 20 19 V5" />
      <path d="M4 10 A8 2.5 0 0 0 20 10" />
      <path d="M4 14 A8 2.5 0 0 0 20 14" />
    </g>
  ),
  cloud: (color) => (
    <path
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      d="M7 18 A5 5 0 0 1 7 8 A6 6 0 0 1 18 9 A4 4 0 0 1 18 18 Z"
    />
  ),
  server: (color) => (
    <g fill="none" stroke={color} strokeWidth="1.5">
      <rect x="4" y="4" width="16" height="6" rx="1" />
      <rect x="4" y="14" width="16" height="6" rx="1" />
      <circle cx="7" cy="7" r="0.5" fill={color} />
      <circle cx="7" cy="17" r="0.5" fill={color} />
    </g>
  ),
  disk: (color) => (
    <g fill="none" stroke={color} strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <rect x="6" y="7" width="12" height="3" />
      <circle cx="7" cy="15" r="1" />
      <circle cx="11" cy="15" r="1" />
    </g>
  ),
  internet: (color) => (
    <g fill="none" stroke={color} strokeWidth="1.5">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12 H21" />
      <path d="M12 3 A13 9 0 0 1 12 21 A13 9 0 0 1 12 3" />
      <path d="M12 3 A13 9 0 0 0 12 21 A13 9 0 0 0 12 3" />
    </g>
  ),
  web: (color) => (
    <g fill="none" stroke={color} strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="14" rx="1" />
      <path d="M3 8 H21" />
      <circle cx="5.5" cy="6" r="0.5" fill={color} />
      <circle cx="7.5" cy="6" r="0.5" fill={color} />
      <circle cx="9.5" cy="6" r="0.5" fill={color} />
    </g>
  ),
  mobile: (color) => (
    <g fill="none" stroke={color} strokeWidth="1.5">
      <rect x="7" y="3" width="10" height="18" rx="1.5" />
      <path d="M11 18 H13" />
    </g>
  ),
  desktop: (color) => (
    <g fill="none" stroke={color} strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="12" rx="1" />
      <path d="M8 20 H16" />
      <path d="M12 16 V20" />
    </g>
  ),
  api: (color) => (
    <g fill="none" stroke={color} strokeWidth="1.5">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <text x="12" y="15" fontSize="7" fontWeight="bold" textAnchor="middle" fill={color} stroke="none">
        API
      </text>
    </g>
  ),
  auth: (color) => (
    <g fill="none" stroke={color} strokeWidth="1.5">
      <rect x="5" y="11" width="14" height="9" rx="1" />
      <path d="M8 11 V8 A4 4 0 0 1 16 8 V11" />
      <circle cx="12" cy="15" r="1" fill={color} />
    </g>
  ),
  files: (color) => (
    <g fill="none" stroke={color} strokeWidth="1.5">
      <path d="M4 4 H11 L13 6 H20 V20 H4 Z" />
      <path d="M4 8 H20" />
    </g>
  ),
  user: (color) => (
    <g fill="none" stroke={color} strokeWidth="1.5">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21 A8 8 0 0 1 20 21" />
    </g>
  ),
};

// ============================================================
// 主组件
// ============================================================

/**
 * Architecture Icon 渲染器
 *
 * 根据 icon 名称渲染对应的 SVG 图标，未知 icon 显示默认方块
 */
export function ArchitectureIcon({ name, size = 24, color = '#333' }: ArchitectureIconProps): JSX.Element {
  const renderIcon = ICON_RENDERERS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      data-arch-icon={name}
    >
      {renderIcon ? renderIcon(color) : (
        // 未知 icon：显示默认方块
        <rect
          x="4"
          y="4"
          width="16"
          height="16"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          rx="2"
        />
      )}
    </svg>
  );
}

/** 判断是否为支持的 icon 名称 */
export function isArchitectureIcon(name: string): boolean {
  return name in ICON_RENDERERS;
}

/** 获取 icon 渲染函数（用于 IconRegistry 注册），未知名返回 undefined */
export function getArchitectureIconRenderer(name: string): ((color: string) => JSX.Element) | undefined {
  return ICON_RENDERERS[name];
}

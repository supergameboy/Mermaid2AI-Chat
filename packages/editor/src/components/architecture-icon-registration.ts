/**
 * Architecture Icon 注册 — 将 12 个 architecture icon 注册到 IconRegistry
 *
 * 单一职责：在模块加载时将 architecture-icons.tsx 的 12 个 icon 注册到全局 IconRegistry
 *
 * 数据流:
 *   模块加载 → registerArchitectureIcons() → iconRegistry.register('architecture', icons)
 *     → IconPicker 通过 iconRegistry.getIcons('architecture') 获取
 */
import type { JSX } from 'react';
import { iconRegistry, type IconDefinition } from './icon-registry.js';
import {
  ARCHITECTURE_ICONS,
  getArchitectureIconRenderer,
} from '../nodes/architecture-icons.js';

/** architecture icon 中文标签映射 */
const ARCHITECTURE_ICON_LABELS: Record<string, string> = {
  database: '数据库',
  cloud: '云',
  server: '服务器',
  disk: '磁盘',
  internet: '互联网',
  web: 'Web',
  mobile: '移动设备',
  desktop: '桌面',
  api: 'API',
  auth: '认证',
  files: '文件',
  user: '用户',
};

/** 构建 architecture icon 定义列表 */
function buildArchitectureIcons(): IconDefinition[] {
  const icons: IconDefinition[] = [];
  for (const name of ARCHITECTURE_ICONS) {
    const renderer = getArchitectureIconRenderer(name);
    if (!renderer) {
      continue;
    }
    icons.push({
      name,
      label: ARCHITECTURE_ICON_LABELS[name] ?? name,
      render: (color: string): JSX.Element => renderer(color),
      viewBox: '0 0 24 24',
    });
  }
  return icons;
}

/** 注册 architecture icon 到全局 IconRegistry */
export function registerArchitectureIcons(): void {
  iconRegistry.register('architecture', buildArchitectureIcons());
}

// 模块加载时自动注册
registerArchitectureIcons();

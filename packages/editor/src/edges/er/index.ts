/**
 * er 边组件注册表 — 统一导出 er 边组件和注册表
 *
 * 单一职责：导出 erDiagram 的边组件，提供 edgeTypes 注册表
 */

export { ErEdgeComponent } from './er-edge.js';

import type { EdgeTypes } from '@xyflow/react';
import { ErEdgeComponent } from './er-edge.js';

/** er 边类型注册表（供 edges/index.ts 注册） */
export const erEdgeTypes: EdgeTypes = {
  'er-relation': ErEdgeComponent,
};

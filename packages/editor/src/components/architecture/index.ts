/**
 * Architecture 属性面板 — 4 个面板的聚合导出
 *
 * 单一职责：导出 architecture 的 4 个属性编辑面板
 *
 * 面板列表（对齐 M7 设计文档决策 4）:
 *   - ArchitectureServicePanel:  编辑 service 的 id/icon/title/group
 *   - ArchitectureJunctionPanel: 编辑 junction 的 id
 *   - ArchitectureGroupPanel:    编辑 group 的 id/icon/title/成员管理
 *   - ArchitectureEdgePanel:     编辑边的 lhsDir/rhsDir/arrow/title
 */

export { ArchitectureServicePanel } from './service-panel.js';
export { ArchitectureJunctionPanel } from './junction-panel.js';
export { ArchitectureGroupPanel } from './group-panel.js';
export { ArchitectureEdgePanel } from './edge-panel.js';

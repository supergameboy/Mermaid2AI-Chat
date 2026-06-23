/**
 * Architecture 节点组件 — 渲染 architecture 的 3 种节点类型
 *
 * 单一职责：根据节点 type 渲染对应视觉，管理 4 个方向的 Handle 连接点
 *
 * 数据流:
 *   MermaidNode (type='arch-service' | 'arch-junction' | 'arch-group')
 *     → 对应节点组件
 *     → 渲染 icon + label（service）/ 实心圆（junction）/ 圆角矩形（group）
 *
 * 节点类型（3 种，对齐 M7 设计文档决策 2）:
 *   - 'arch-service':  ArchServiceComponent   — 带图标的矩形（显示 icon + label）
 *   - 'arch-junction': ArchJunctionComponent  — 实心圆（连接汇聚点）
 *   - 'arch-group':     ArchGroupComponent     — 带标题的圆角矩形（Parent Node）
 *
 * Handle 设计（4 个方向，对齐 M7 设计文档决策 6）:
 *   - 所有节点渲染 4 个 Handle（Top/Bottom/Left/Right）
 *   - 边的 lhsDir/rhsDir（L/R/T/B）映射到 Handle 位置
 *   - Handle ID: 'left'/'right'/'top'/'bottom'
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { MermaidNodeData } from '@mermaid2aichat/serializer';
import { ArchitectureIcon } from './architecture-icons.js';

// ============================================================
// 类型
// ============================================================

export type ArchServiceFlowNode = Node<MermaidNodeData, 'arch-service'>;
export type ArchJunctionFlowNode = Node<MermaidNodeData, 'arch-junction'>;
export type ArchGroupFlowNode = Node<MermaidNodeData, 'arch-group'>;

// ============================================================
// 常量
// ============================================================

const handleStyle = { width: 6, height: 6, background: '#1890ff' };

// ============================================================
// 辅助函数
// ============================================================

/** 安全读取 MermaidNodeData 的扩展字段 */
function readField<T>(data: MermaidNodeData, key: string): T | undefined {
  const value = (data as Record<string, unknown>)[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as T;
}

// ============================================================
// 4 方向 Handle 渲染
// ============================================================

/** 渲染 4 个方向的 Handle（Top/Bottom/Left/Right） */
function FourDirectionHandles() {
  return (
    <>
      <Handle id="top" type="target" position={Position.Top} style={handleStyle} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={handleStyle} />
      <Handle id="left" type="target" position={Position.Left} style={handleStyle} />
      <Handle id="right" type="source" position={Position.Right} style={handleStyle} />
    </>
  );
}

// ============================================================
// ArchServiceNode — 带图标的矩形
// ============================================================

interface ArchServiceNodeProps {
  data: MermaidNodeData;
  selected: boolean;
}

/**
 * Architecture Service 节点
 *
 * 显示为带图标的矩形：icon（左）+ label（右）
 * icon 由 data.archIcon 决定（如 'database'/'cloud'/'server'）
 */
function ArchServiceNodeBase({ data, selected }: ArchServiceNodeProps) {
  const icon = readField<string>(data, 'archIcon');
  const iconText = readField<string>(data, 'archIconText');
  const label = data.label;

  return (
    <div
      className="arch-service-node"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 120,
        padding: '8px 12px',
        border: selected ? '2px solid #1890ff' : '1px solid #666',
        borderRadius: 4,
        background: '#fff',
        fontSize: 14,
      }}
    >
      <FourDirectionHandles />

      {/* icon */}
      {icon && (
        <div className="arch-service-icon">
          <ArchitectureIcon name={icon} size={24} color="#333" />
        </div>
      )}

      {/* label + iconText */}
      <div className="arch-service-text">
        <div className="arch-service-label">{label}</div>
        {iconText && (
          <div className="arch-service-icon-text" style={{ fontSize: 11, color: '#999' }}>
            {iconText}
          </div>
        )}
      </div>
    </div>
  );
}

export const ArchServiceComponent = memo(ArchServiceNodeBase);
ArchServiceComponent.displayName = 'ArchServiceComponent';

// ============================================================
// ArchJunctionNode — 实心圆（连接汇聚点）
// ============================================================

interface ArchJunctionNodeProps {
  data: MermaidNodeData;
  selected: boolean;
}

/**
 * Architecture Junction 节点
 *
 * 显示为实心圆，作为多边的连接汇聚点
 */
function ArchJunctionNodeBase({ data, selected }: ArchJunctionNodeProps) {
  return (
    <div
      className="arch-junction-node"
      style={{
        position: 'relative',
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#333',
        border: selected ? '3px solid #1890ff' : '2px solid #666',
      }}
      title={data.label}
    >
      <FourDirectionHandles />
    </div>
  );
}

export const ArchJunctionComponent = memo(ArchJunctionNodeBase);
ArchJunctionComponent.displayName = 'ArchJunctionComponent';

// ============================================================
// ArchGroupNode — 带标题的圆角矩形（Parent Node）
// ============================================================

interface ArchGroupNodeProps {
  data: MermaidNodeData;
  selected: boolean;
}

/**
 * Architecture Group 节点
 *
 * 显示为带标题的圆角矩形，作为 Parent Node 容纳子节点
 * 标题在顶部，子节点在内部
 */
function ArchGroupNodeBase({ data, selected }: ArchGroupNodeProps) {
  const label = data.label;

  return (
    <div
      className="arch-group-node"
      style={{
        position: 'relative',
        minWidth: 200,
        minHeight: 120,
        padding: 0,
        border: selected ? '2px dashed #1890ff' : '1px dashed #999',
        borderRadius: 8,
        background: 'rgba(24, 144, 255, 0.05)',
      }}
    >
      {/* 标题栏 */}
      <div
        className="arch-group-title"
        style={{
          padding: '4px 8px',
          borderBottom: selected ? '2px dashed #1890ff' : '1px dashed #999',
          fontSize: 13,
          fontWeight: 600,
          color: '#666',
        }}
      >
        {label}
      </div>

      {/* 子节点容器（React Flow 会自动渲染子节点） */}
      <div className="arch-group-content" style={{ padding: 8, minHeight: 80 }}>
        {/* 子节点由 React Flow Parent Node 机制自动渲染 */}
      </div>

      <FourDirectionHandles />
    </div>
  );
}

export const ArchGroupComponent = memo(ArchGroupNodeBase);
ArchGroupComponent.displayName = 'ArchGroupComponent';

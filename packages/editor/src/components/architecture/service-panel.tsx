/**
 * Architecture Service 属性面板
 *
 * 单一职责：编辑 architecture service 节点的 id/icon/title/group
 *
 * 编辑字段:
 *   - id: 节点 ID（只读，显示）
 *   - icon: icon 类型（IconPicker 可视化选择，M0 集成）
 *   - label: 显示标题
 *   - group: 所属 group（下拉选择，可选"无"）
 */

import type { MermaidNode, ArchitectureGroupInfo, MermaidNodeData } from '@mermaid2aichat/serializer';
import { IconPicker } from '../icon-picker.js';

export interface ArchitectureServicePanelProps {
  /** 当前编辑的 service 节点 */
  node: MermaidNode;
  /** 所有可用的 groups */
  groups: ArchitectureGroupInfo[];
  /** v4 根因修复：所有节点（用于从 node.data.label 派生 group 标题） */
  nodes?: MermaidNode[];
  /** 节点更新回调 */
  onChange: (updates: Partial<MermaidNode>) => void;
  /** 节点删除回调 */
  onDelete: () => void;
}

/** 读取 data 的扩展字段 */
function readField<T>(data: MermaidNodeData, key: string): T | undefined {
  const value = (data as Record<string, unknown>)[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as T;
}

/** Architecture Service 属性面板 */
export function ArchitectureServicePanel({ node, groups, nodes, onChange, onDelete }: ArchitectureServicePanelProps) {
  const archIcon = readField<string>(node.data, 'archIcon') ?? '';
  const label = node.data.label ?? '';
  const parentId = node.parentId ?? '';

  return (
    <div className="arch-service-panel" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>服务属性</h3>

      {/* ID（只读） */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#666' }}>ID</span>
        <input
          type="text"
          value={node.id}
          readOnly
          style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4, background: '#f5f5f5' }}
        />
      </label>

      {/* icon 选择（M0: 使用 IconPicker 替代 select） */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#666' }}>Icon</span>
        <IconPicker
          diagramType="architecture"
          value={archIcon || null}
          onChange={(icon) => {
            const newData = { ...node.data };
            if (icon) {
              (newData as Record<string, unknown>).archIcon = icon;
            } else {
              delete (newData as Record<string, unknown>).archIcon;
            }
            onChange({ data: newData });
          }}
        />
      </div>

      {/* label 编辑 */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#666' }}>标题</span>
        <input
          type="text"
          value={label}
          onChange={(e) => {
            onChange({ data: { ...node.data, label: e.target.value } });
          }}
          style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4 }}
        />
      </label>

      {/* 所属 group 选择 */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#666' }}>所属 Group</span>
        <select
          value={parentId}
          onChange={(e) => {
            const value = e.target.value;
            if (value) {
              onChange({ parentId: value, extent: 'parent' as const });
            } else {
              // 移除 parentId
              const { parentId: _omit, extent: _omit2, ...rest } = node;
              void _omit;
              void _omit2;
              onChange(rest);
            }
          }}
          style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4 }}
        >
          <option value="">（无 group）</option>
          {groups.map((g) => {
            // v4 根因修复：从 node.data.label 派生 group 标题
            const gNode = nodes?.find((n) => n.id === g.id);
            const gTitle = gNode?.data.label ?? g.id;
            return (
              <option key={g.id} value={g.id}>
                {gTitle}
              </option>
            );
          })}
        </select>
      </label>

      {/* 删除按钮 */}
      <button
        type="button"
        onClick={onDelete}
        style={{
          padding: '6px 12px',
          border: '1px solid #ff4d4f',
          borderRadius: 4,
          background: '#fff',
          color: '#ff4d4f',
          cursor: 'pointer',
          marginTop: 8,
        }}
      >
        删除服务
      </button>
    </div>
  );
}

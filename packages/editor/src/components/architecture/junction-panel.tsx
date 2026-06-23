/**
 * Architecture Junction 属性面板
 *
 * 单一职责：编辑 architecture junction 节点的 id
 *
 * junction 是连接汇聚点，只有 id 一个可编辑字段
 */

import type { MermaidNode } from '@mermaid2aichat/serializer';

export interface ArchitectureJunctionPanelProps {
  /** 当前编辑的 junction 节点 */
  node: MermaidNode;
  /** 节点删除回调 */
  onDelete: () => void;
}

/** Architecture Junction 属性面板 */
export function ArchitectureJunctionPanel({ node, onDelete }: ArchitectureJunctionPanelProps) {
  return (
    <div className="arch-junction-panel" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Junction 属性</h3>

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

      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
        Junction 是连接汇聚点，用于多条边的交汇。
      </div>

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
        删除 Junction
      </button>
    </div>
  );
}

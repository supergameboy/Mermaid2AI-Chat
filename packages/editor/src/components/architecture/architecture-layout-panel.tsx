/**
 * ArchitectureLayoutPanel — architecture layout hints 编辑面板（v4 新增）
 *
 * 单一职责：提供 layout hints 的完整 UI 编辑
 *   - 显示所有 layout hints 列表（direction + members）
 *   - 添加 layout hint：选择方向（row/column）+ 选择成员节点（多选）
 *   - 编辑 layout hint：修改方向、添加/移除成员
 *   - 删除 layout hint
 *
 * 数据流:
 *   metadata.layoutHints → 列表视图
 *   用户操作 → onAddLayoutHint/onUpdateLayoutHint/onDeleteLayoutHint/onToggleLayoutMember → GraphCanvas 更新 metadata
 *
 * 语法对应:
 *   layout:row [a, b, c] → { direction: 'row', members: ['a', 'b', 'c'] }
 *   layout:column [a, b, c] → { direction: 'column', members: ['a', 'b', 'c'] }
 */

import { memo, useState } from 'react';
import type { MermaidNode, ArchitectureLayoutHint } from '@mermaid2aichat/serializer';

export interface ArchitectureLayoutPanelProps {
  /** 所有节点（供选择成员） */
  nodes: MermaidNode[];
  /** 当前 layout hints（从 metadata.layoutHints 读取） */
  layoutHints: ArchitectureLayoutHint[];
  /** 添加 layout hint */
  onAddLayoutHint: (direction: 'row' | 'column', members: string[]) => void;
  /** 更新 layout hint */
  onUpdateLayoutHint: (index: number, updates: Partial<ArchitectureLayoutHint>) => void;
  /** 删除 layout hint */
  onDeleteLayoutHint: (index: number) => void;
  /** 切换成员是否在 layout hint 中 */
  onToggleLayoutMember: (hintIndex: number, nodeId: string) => void;
}

/** 获取节点显示标签 */
function getNodeLabel(node: MermaidNode): string {
  return node.data.label ?? node.id;
}

/** Architecture Layout Hints 编辑面板组件 */
export const ArchitectureLayoutPanel = memo(function ArchitectureLayoutPanel({
  nodes,
  layoutHints,
  onAddLayoutHint,
  onUpdateLayoutHint,
  onDeleteLayoutHint,
  onToggleLayoutMember,
}: ArchitectureLayoutPanelProps) {
  // 新建 layout hint 的本地状态
  const [newDirection, setNewDirection] = useState<'row' | 'column'>('row');
  const [newMembers, setNewMembers] = useState<string[]>([]);

  // 切换新成员选择
  const toggleNewMember = (nodeId: string) => {
    setNewMembers((prev) =>
      prev.includes(nodeId)
        ? prev.filter((id) => id !== nodeId)
        : [...prev, nodeId]
    );
  };

  // 添加 layout hint
  const handleAdd = () => {
    if (newMembers.length === 0) {
      return;
    }
    onAddLayoutHint(newDirection, newMembers);
    setNewMembers([]);
  };

  return (
    <div className="arch-layout-panel" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Layout Hints</h3>
      <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
        布局提示用于约束节点排列（row 水平排列 / column 垂直排列）
      </p>

      {/* 现有 layout hints 列表 */}
      {layoutHints.length === 0 ? (
        <div style={{ fontSize: 12, color: '#999', padding: '4px 0' }}>
          暂无 layout hints，可从下方添加。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {layoutHints.map((hint, index) => (
            <div
              key={index}
              style={{
                border: '1px solid #eee',
                borderRadius: 4,
                padding: 8,
                background: '#fafafa',
              }}
            >
              {/* 方向选择 + 删除 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <select
                  value={hint.direction}
                  onChange={(e) => {
                    const value = e.target.value as 'row' | 'column';
                    onUpdateLayoutHint(index, { direction: value });
                  }}
                  style={{ padding: '2px 6px', border: '1px solid #ddd', borderRadius: 2 }}
                >
                  <option value="row">row（水平）</option>
                  <option value="column">column（垂直）</option>
                </select>
                <button
                  type="button"
                  onClick={() => onDeleteLayoutHint(index)}
                  style={{
                    padding: '2px 6px',
                    border: '1px solid #ff4d4f',
                    borderRadius: 2,
                    background: '#fff',
                    color: '#ff4d4f',
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  删除
                </button>
              </div>

              {/* 成员列表 */}
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>成员（{hint.members.length}）</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {nodes.map((node) => {
                  const isMember = hint.members.includes(node.id);
                  return (
                    <label
                      key={node.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 4px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isMember}
                        onChange={() => onToggleLayoutMember(index, node.id)}
                      />
                      <span>{getNodeLabel(node)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加新 layout hint */}
      <div
        style={{
          border: '1px dashed #ddd',
          borderRadius: 4,
          padding: 8,
          marginTop: 8,
        }}
      >
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>添加新 layout hint</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <select
            value={newDirection}
            onChange={(e) => setNewDirection(e.target.value as 'row' | 'column')}
            style={{ padding: '2px 6px', border: '1px solid #ddd', borderRadius: 2 }}
          >
            <option value="row">row（水平）</option>
            <option value="column">column（垂直）</option>
          </select>
          <button
            type="button"
            onClick={handleAdd}
            disabled={newMembers.length === 0}
            style={{
              padding: '2px 8px',
              border: '1px solid #1677ff',
              borderRadius: 2,
              background: newMembers.length === 0 ? '#f5f5f5' : '#1677ff',
              color: newMembers.length === 0 ? '#999' : '#fff',
              cursor: newMembers.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: 12,
            }}
          >
            添加
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 150, overflowY: 'auto' }}>
          {nodes.map((node) => {
            const isChecked = newMembers.includes(node.id);
            return (
              <label
                key={node.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 4px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleNewMember(node.id)}
                />
                <span>{getNodeLabel(node)}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
});

ArchitectureLayoutPanel.displayName = 'ArchitectureLayoutPanel';

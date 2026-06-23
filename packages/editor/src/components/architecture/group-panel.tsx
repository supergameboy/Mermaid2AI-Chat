/**
 * Architecture Group 属性面板（v4 根因修复）
 *
 * 单一职责：编辑 architecture group 的 icon/标题/父分组/成员管理
 *
 * v4 根因修复:
 *   - title 从 node.data.label 读取（不再从 group.title 读取）
 *   - in 从 node.parentId 读取（不再从 group.in 读取）
 *   - icon 从 node.data.archIcon 读取（不再从 group.icon 读取，与 service 统一）
 *   - 更新 title 调用 onUpdateNode（更新 node.data.label）
 *   - 更新 icon 调用 onUpdateNode（更新 node.data.archIcon）
 *   - 更新父分组调用 onMoveToGroup（更新 node.parentId）
 *
 * 编辑字段:
 *   - id: group ID（只读）
 *   - icon: group icon 类型（IconPicker 可视化选择，M0 集成，存储在 node.data.archIcon）
 *   - title: group 标题（存储在 node.data.label）
 *   - in: 父 group ID（存储在 node.parentId）
 *   - 成员列表: 显示 group 中的所有成员，支持移除
 */

import type { MermaidNode, ArchitectureGroupInfo, MermaidNodeData } from '@mermaid2aichat/serializer';
import { deriveGroupMembers } from '@mermaid2aichat/serializer';
import { IconPicker } from '../icon-picker.js';

export interface ArchitectureGroupPanelProps {
  /** 当前编辑的 group 信息（v4 根因修复：仅含 id，作为 group 索引） */
  group: ArchitectureGroupInfo;
  /** 所有节点（用于派生成员 + 读取 group 节点的 title/parentId/icon） */
  nodes: MermaidNode[];
  /** 所有 groups（用于选择父 group） */
  groups: ArchitectureGroupInfo[];
  /** v4 根因修复：节点数据更新回调（用于更新 title = node.data.label, icon = node.data.archIcon） */
  onUpdateNode?: (id: string, data: Partial<MermaidNode['data']>) => void;
  /** group 删除回调（v4：由 GraphCanvas 弹出确认对话框选择递归/保留子节点） */
  onDelete: () => void;
  /** v4：移动节点到其他 group（targetGroupId 为 null 表示移出 group）
   * 也用于更改 group 的父分组（targetGroupId 为新父 group ID） */
  onMoveToGroup: (nodeId: string, targetGroupId: string | null) => void;
}

/** Architecture Group 属性面板（v4 根因修复） */
export function ArchitectureGroupPanel({
  group,
  nodes,
  groups,
  onUpdateNode,
  onDelete,
  onMoveToGroup,
}: ArchitectureGroupPanelProps) {
  // v4 根因修复：从 node 派生 title 和 parentId
  const groupNode = nodes.find((n) => n.id === group.id);
  const title = groupNode?.data.label ?? group.id;
  const parentId = groupNode?.parentId ?? null;

  // v4：成员通过 parentId 派生（不再从 nodeIds 读取）
  const members = deriveGroupMembers(nodes, group.id);

  // 可选的父 group（排除自身和后代，避免循环引用）
  const collectDescendantIds = (groupId: string): Set<string> => {
    const result = new Set<string>([groupId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of nodes) {
        if (n.parentId && result.has(n.parentId) && !result.has(n.id)) {
          result.add(n.id);
          changed = true;
        }
      }
    }
    return result;
  };
  const descendantIds = collectDescendantIds(group.id);
  const availableParentGroups = groups.filter((g) => g.id !== group.id && !descendantIds.has(g.id));

  return (
    <div className="arch-group-panel" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Group 属性</h3>

      {/* ID（只读） */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#666' }}>ID</span>
        <input
          type="text"
          value={group.id}
          readOnly
          style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4, background: '#f5f5f5' }}
        />
      </label>

      {/* icon 选择（v4 根因修复 + M0: 使用 IconPicker 替代 select，存储在 node.data.archIcon） */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#666' }}>Icon</span>
        <IconPicker
          diagramType="architecture"
          value={(groupNode?.data.archIcon as string) || null}
          onChange={(icon) => {
            if (onUpdateNode) {
              if (icon) {
                // 设置 icon
                onUpdateNode(group.id, { archIcon: icon });
              } else if (groupNode) {
                // 移除 icon：构造不含 archIcon 的新 data
                const newData = { ...groupNode.data };
                delete (newData as Record<string, unknown>).archIcon;
                onUpdateNode(group.id, newData);
              }
            }
          }}
        />
      </div>

      {/* title 编辑（v4 根因修复：存储在 node.data.label） */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#666' }}>标题</span>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            // v4 根因修复：更新 node.data.label（而非 group.title）
            if (onUpdateNode) {
              onUpdateNode(group.id, { label: e.target.value });
            }
          }}
          style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4 }}
        />
      </label>

      {/* 父 group 选择（v4 根因修复：存储在 node.parentId） */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#666' }}>父分组（嵌套）</span>
        <select
          value={parentId ?? ''}
          onChange={(e) => {
            // v4 根因修复：更新 node.parentId（而非 group.in）
            const value = e.target.value;
            onMoveToGroup(group.id, value || null);
          }}
          style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4 }}
        >
          <option value="">（顶层）</option>
          {availableParentGroups.map((g) => {
            // v4 根因修复：从 node 派生 group 标题
            const gNode = nodes.find((n) => n.id === g.id);
            const gTitle = gNode?.data.label ?? g.id;
            return (
              <option key={g.id} value={g.id}>
                {gTitle}
              </option>
            );
          })}
        </select>
      </label>

      {/* 成员列表（v4：通过 parentId 派生） */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
        <span style={{ fontSize: 12, color: '#666' }}>成员（{members.length}）</span>
        {members.length === 0 ? (
          <div style={{ fontSize: 12, color: '#999', padding: '4px 0' }}>
            暂无成员，可通过树形面板或拖拽服务节点到 group 内添加成员。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {members.map((member) => {
              const data = member.data as MermaidNodeData & { archIcon?: string };
              return (
                <div
                  key={member.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    border: '1px solid #eee',
                    borderRadius: 4,
                    background: '#fafafa',
                  }}
                >
                  <span style={{ fontSize: 12 }}>
                    {data.archIcon ? `[${data.archIcon}] ` : ''}{member.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => onMoveToGroup(member.id, null)}
                    title="移出分组（保留为顶层节点）"
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
                    移除
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 删除按钮（v4：由 GraphCanvas 弹出确认对话框选择递归/保留子节点） */}
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
        删除 Group
      </button>
    </div>
  );
}

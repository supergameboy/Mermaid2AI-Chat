/**
 * ArchitectureTreePanel — architecture 树形结构编辑面板（v3 新增，v4 修订）
 *
 * 单一职责：提供 architecture 树形结构的可视化编辑
 *   - 添加 group（顶层或嵌套到其他 group）
 *   - 添加 service/junction（可选归属 group）
 *   - 删除节点（group 支持两种模式：递归删除子节点 / 保留子节点提升为顶层）
 *   - 移动节点到其他 group（含循环引用检测）
 *   - 选中节点同步画布
 *
 * 数据流:
 *   MermaidNode[] + ArchitectureGroupInfo[] → buildChildrenMap → 树形视图
 *   用户操作 → onAddGroup/onAddService/onAddJunction/onDeleteNode/onMoveToGroup → GraphCanvas 更新 CanvasState
 *
 * v4 修订:
 *   - 选中状态改为联合类型 selectedId: { type: 'node'|'group'; id: string } | null
 *   - 删除节点支持 options.recursive（group 两种删除模式）
 *   - 移动节点含循环引用检测（由 GraphCanvas 调用 detectCycle）
 *   - group 成员通过 parentId 派生（不再从 nodeIds 读取）
 *
 * 对标参考: packages/editor/src/components/mindmap/mindmap-tree-panel.tsx
 */

import { memo, useMemo } from 'react';
import type { MermaidNode, ArchitectureGroupInfo } from '@mermaid2aichat/serializer';

/** v4：选中状态联合类型（替代 selectedNodeId + selectedGroupId） */
export type ArchitectureSelectedId =
  | { type: 'node'; id: string }
  | { type: 'group'; id: string }
  | null;

export interface ArchitectureTreePanelProps {
  /** 所有节点列表（arch-service/arch-junction/arch-group 统一在 nodes 中） */
  nodes: MermaidNode[];
  /** 所有 groups（从 metadata.groups 读取，v4：仅含 id/icon，title/in 通过 node 派生） */
  groups: ArchitectureGroupInfo[];
  /** v4：联合类型选中状态 */
  selectedId: ArchitectureSelectedId;
  /** 添加 group（可选父 group ID 实现嵌套） */
  onAddGroup: (parentId?: string) => void;
  /** 添加 service（可选所属 group ID） */
  onAddService: (groupId?: string) => void;
  /** 添加 junction（可选所属 group ID） */
  onAddJunction: (groupId?: string) => void;
  /** v4：删除节点，group 支持两种模式（recursive 递归删除子节点 / 非 recursive 保留子节点提升为顶层） */
  onDeleteNode: (nodeId: string, options?: { recursive?: boolean }) => void;
  /** v4：移动节点到其他 group（targetGroupId 为 null 表示移出 group），含循环引用检测 */
  onMoveToGroup: (nodeId: string, targetGroupId: string | null) => void;
  /** 选中节点回调（同步画布选中） */
  onSelectNode: (nodeId: string) => void;
  /** 选中 group 回调（同步画布选中 + PropertyPanel 切换到 ArchitectureGroupPanel） */
  onSelectGroup: (groupId: string) => void;
}

/** 构建 parentId → children[] 的映射（复用 mindmap 的模式） */
function buildChildrenMap(nodes: MermaidNode[]): Map<string | null, MermaidNode[]> {
  const map = new Map<string | null, MermaidNode[]>();
  for (const node of nodes) {
    const parentId = node.parentId ?? null;
    const children = map.get(parentId);
    if (children) {
      children.push(node);
    } else {
      map.set(parentId, [node]);
    }
  }
  return map;
}

/** 递归收集节点及其所有后代 ID */
function collectDescendantIds(nodeId: string, childrenMap: Map<string | null, MermaidNode[]>): string[] {
  const result: string[] = [nodeId];
  const children = childrenMap.get(nodeId) ?? [];
  for (const child of children) {
    result.push(...collectDescendantIds(child.id, childrenMap));
  }
  return result;
}

/** 判断节点是否为 group 类型 */
function isGroupNode(node: MermaidNode): boolean {
  return node.type === 'arch-group' || node.data.shape === 'arch-group';
}

/** 判断节点是否为 junction 类型 */
function isJunctionNode(node: MermaidNode): boolean {
  return node.type === 'arch-junction' || node.data.shape === 'arch-junction';
}

/** 获取节点显示标签 */
function getNodeLabel(node: MermaidNode): string {
  return node.data.label ?? node.id;
}

/** 获取节点类型标签 */
function getTypeLabel(node: MermaidNode): string {
  if (isGroupNode(node)) return '分组';
  if (isJunctionNode(node)) return '连接点';
  return '服务';
}

/** 树形节点项 */
interface TreeItemProps {
  node: MermaidNode;
  level: number;
  childrenMap: Map<string | null, MermaidNode[]>;
  nodes: MermaidNode[];
  groups: ArchitectureGroupInfo[];
  selectedId: ArchitectureSelectedId;
  onAddGroup: (parentId?: string) => void;
  onAddService: (groupId?: string) => void;
  onAddJunction: (groupId?: string) => void;
  onDeleteNode: (nodeId: string, options?: { recursive?: boolean }) => void;
  onMoveToGroup: (nodeId: string, targetGroupId: string | null) => void;
  onSelectNode: (nodeId: string) => void;
  onSelectGroup: (groupId: string) => void;
}

/** 递归渲染树形节点 */
const TreeItem = memo(function TreeItem({
  node,
  level,
  childrenMap,
  nodes,
  groups,
  selectedId,
  onAddGroup,
  onAddService,
  onAddJunction,
  onDeleteNode,
  onMoveToGroup,
  onSelectNode,
  onSelectGroup,
}: TreeItemProps) {
  const children = childrenMap.get(node.id) ?? [];
  const isGroup = isGroupNode(node);
  const isJunction = isJunctionNode(node);
  const isSelected = selectedId?.type === 'node' && selectedId.id === node.id
    ? true
    : selectedId?.type === 'group' && selectedId.id === node.id;

  // 点击节点：group 调用 onSelectGroup，其他调用 onSelectNode
  const handleClick = () => {
    if (isGroup) {
      onSelectGroup(node.id);
    } else {
      onSelectNode(node.id);
    }
  };

  // 删除节点：group 弹出确认对话框（由 GraphCanvas 处理），其他直接删除
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGroup) {
      // group 删除由 GraphCanvas 弹出确认对话框（递归 vs 保留子节点）
      // 这里直接调用，GraphCanvas 内部会处理 UI 确认
      onDeleteNode(node.id);
    } else {
      onDeleteNode(node.id);
    }
  };

  // 移动到其他 group：弹出选择器（简化实现，用 select 下拉）
  const handleMoveToGroup = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    // v4 修复：使用 __move_out__ 区分"移出分组"与初始值""
    const rawValue = e.target.value;
    const targetId = rawValue === '' || rawValue === '__move_out__' ? null : rawValue;
    onMoveToGroup(node.id, targetId);
    // 重置 select
    e.target.value = '';
  };

  // 可选的目标 group（排除自身和后代，避免循环引用）
  const availableGroups = useMemo(() => {
    const descendantIds = new Set(collectDescendantIds(node.id, childrenMap));
    return groups.filter((g) => g.id !== node.id && !descendantIds.has(g.id));
  }, [groups, node.id, childrenMap]);

  return (
    <div className="arch-tree-item">
      <div
        className={`arch-tree-row${isSelected ? ' selected' : ''}`}
        style={{ paddingLeft: level * 16 + 8 }}
        onClick={handleClick}
      >
        <span className="arch-tree-type-badge">{getTypeLabel(node)}</span>
        <span className="arch-tree-label">{getNodeLabel(node)}</span>
        <span className="arch-tree-actions">
          {/* group 可以添加子 group */}
          {isGroup && (
            <button
              type="button"
              className="arch-tree-btn"
              title="添加子分组"
              onClick={(e) => {
                e.stopPropagation();
                onAddGroup(node.id);
              }}
            >
              +组
            </button>
          )}
          {/* group 可以添加 service/junction */}
          {isGroup && (
            <>
              <button
                type="button"
                className="arch-tree-btn"
                title="添加服务到分组"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddService(node.id);
                }}
              >
                +服
              </button>
              <button
                type="button"
                className="arch-tree-btn"
                title="添加连接点到分组"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddJunction(node.id);
                }}
              >
                +连
              </button>
            </>
          )}
          {/* 移动到其他 group（非顶层节点可移出） */}
          <select
            className="arch-tree-move-select"
            value=""
            onChange={handleMoveToGroup}
            onClick={(e) => e.stopPropagation()}
            title="移动到分组"
          >
            <option value="">移动到...</option>
            <option value="__move_out__">（移出分组）</option>
            {availableGroups.map((g) => {
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
          {/* 删除按钮 */}
          <button
            type="button"
            className="arch-tree-btn arch-tree-btn-delete"
            title={isGroup ? '删除分组（可选递归/保留子节点）' : '删除节点'}
            onClick={handleDelete}
          >
            删
          </button>
        </span>
      </div>
      {children.map((child) => (
        <TreeItem
          key={child.id}
          node={child}
          level={level + 1}
          childrenMap={childrenMap}
          nodes={nodes}
          groups={groups}
          selectedId={selectedId}
          onAddGroup={onAddGroup}
          onAddService={onAddService}
          onAddJunction={onAddJunction}
          onDeleteNode={onDeleteNode}
          onMoveToGroup={onMoveToGroup}
          onSelectNode={onSelectNode}
          onSelectGroup={onSelectGroup}
        />
      ))}
    </div>
  );
});

/** architecture 树形结构编辑面板组件 */
export const ArchitectureTreePanel = memo(function ArchitectureTreePanel({
  nodes,
  groups,
  selectedId,
  onAddGroup,
  onAddService,
  onAddJunction,
  onDeleteNode,
  onMoveToGroup,
  onSelectNode,
  onSelectGroup,
}: ArchitectureTreePanelProps) {
  const childrenMap = useMemo(() => buildChildrenMap(nodes), [nodes]);
  const rootNodes = childrenMap.get(null) ?? [];

  return (
    <div className="arch-tree-panel">
      <h3 className="panel-title">架构树形结构</h3>
      <div className="arch-tree-toolbar">
        <button
          type="button"
          className="arch-tree-add-btn"
          onClick={() => onAddGroup()}
          title="添加顶层分组"
        >
          + 顶层分组
        </button>
        <button
          type="button"
          className="arch-tree-add-btn"
          onClick={() => onAddService()}
          title="添加顶层服务"
        >
          + 顶层服务
        </button>
        <button
          type="button"
          className="arch-tree-add-btn"
          onClick={() => onAddJunction()}
          title="添加顶层连接点"
        >
          + 顶层连接点
        </button>
      </div>
      {rootNodes.length === 0 ? (
        <p className="panel-hint">画布为空，请从上方按钮添加节点</p>
      ) : (
        <div className="arch-tree-content">
          {rootNodes.map((root) => (
            <TreeItem
              key={root.id}
              node={root}
              level={0}
              childrenMap={childrenMap}
              nodes={nodes}
              groups={groups}
              selectedId={selectedId}
              onAddGroup={onAddGroup}
              onAddService={onAddService}
              onAddJunction={onAddJunction}
              onDeleteNode={onDeleteNode}
              onMoveToGroup={onMoveToGroup}
              onSelectNode={onSelectNode}
              onSelectGroup={onSelectGroup}
            />
          ))}
        </div>
      )}
    </div>
  );
});

ArchitectureTreePanel.displayName = 'ArchitectureTreePanel';

/** 导出辅助函数（供 GraphCanvas 删除子树时使用） */
export { collectDescendantIds, buildChildrenMap };

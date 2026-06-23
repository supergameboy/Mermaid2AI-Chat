/**
 * MindmapTreePanel — mindmap 树形结构编辑面板
 *
 * 单一职责：提供 mindmap 树形结构的可视化编辑（添加子节点/兄弟节点/删除节点）
 *
 * 数据流:
 *   MermaidNode[] → buildChildrenMap → 树形视图
 *   用户操作 → onAddChild/onAddSibling/onDeleteNode → GraphCanvas 更新 CanvasState
 *
 * 树形结构:
 *   - mindmap 是树形结构，使用 parentId 表达父子关系
 *   - 根节点（parentId 为 undefined/null）在顶层
 *   - 子节点缩进显示，按 parentId 递归渲染
 *
 * 操作:
 *   - 添加子节点：在选中节点下创建新子节点（parentId = 选中节点 ID）
 *   - 添加兄弟节点：在选中节点的父节点下创建新子节点（parentId = 选中节点的 parentId）
 *   - 删除节点：递归删除选中节点及其所有子节点
 */

import { memo, useMemo } from 'react';
import type { MermaidNode } from '@mermaid2aichat/serializer';

export interface MindmapTreePanelProps {
  /** 所有节点列表 */
  nodes: MermaidNode[];
  /** 当前选中的节点 ID */
  selectedNodeId: string | null;
  /** 添加子节点回调 */
  onAddChild: (parentId: string) => void;
  /** 添加兄弟节点回调 */
  onAddSibling: (nodeId: string) => void;
  /** 删除节点回调（递归删除子树） */
  onDeleteNode: (nodeId: string) => void;
  /** 选中节点回调 */
  onSelectNode: (nodeId: string) => void;
}

/** 构建 parentId → children[] 的映射 */
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

/** 树形节点项 */
interface TreeItemProps {
  node: MermaidNode;
  level: number;
  childrenMap: Map<string | null, MermaidNode[]>;
  selectedNodeId: string | null;
  onAddChild: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onSelectNode: (nodeId: string) => void;
}

/** 递归渲染树形节点 */
const TreeItem = memo(function TreeItem({
  node,
  level,
  childrenMap,
  selectedNodeId,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  onSelectNode,
}: TreeItemProps) {
  const children = childrenMap.get(node.id) ?? [];
  const isSelected = selectedNodeId === node.id;
  const isRoot = node.parentId === undefined || node.parentId === null;

  return (
    <div className="mindmap-tree-item">
      <div
        className={`mindmap-tree-row${isSelected ? ' selected' : ''}`}
        style={{ paddingLeft: level * 16 + 8 }}
        onClick={() => onSelectNode(node.id)}
      >
        <span className="mindmap-tree-label">
          {isRoot && <span className="mindmap-tree-root-badge">根</span>}
          {node.data.label}
        </span>
        <span className="mindmap-tree-actions">
          <button
            type="button"
            className="mindmap-tree-btn"
            title="添加子节点"
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(node.id);
            }}
          >
            +子
          </button>
          {!isRoot && (
            <button
              type="button"
              className="mindmap-tree-btn"
              title="添加兄弟节点"
              onClick={(e) => {
                e.stopPropagation();
                onAddSibling(node.id);
              }}
            >
              +兄
            </button>
          )}
          <button
            type="button"
            className="mindmap-tree-btn mindmap-tree-btn-delete"
            title="删除节点（含子节点）"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteNode(node.id);
            }}
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
          selectedNodeId={selectedNodeId}
          onAddChild={onAddChild}
          onAddSibling={onAddSibling}
          onDeleteNode={onDeleteNode}
          onSelectNode={onSelectNode}
        />
      ))}
    </div>
  );
});

/** mindmap 树形结构编辑面板组件 */
export const MindmapTreePanel = memo(function MindmapTreePanel({
  nodes,
  selectedNodeId,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  onSelectNode,
}: MindmapTreePanelProps) {
  const childrenMap = useMemo(() => buildChildrenMap(nodes), [nodes]);
  const rootNodes = childrenMap.get(null) ?? [];

  if (rootNodes.length === 0) {
    return (
      <div className="mindmap-tree-panel">
        <h3 className="panel-title">树形结构</h3>
        <p className="panel-hint">画布为空，请添加根节点</p>
      </div>
    );
  }

  return (
    <div className="mindmap-tree-panel">
      <h3 className="panel-title">树形结构</h3>
      <div className="mindmap-tree-content">
        {rootNodes.map((root) => (
          <TreeItem
            key={root.id}
            node={root}
            level={0}
            childrenMap={childrenMap}
            selectedNodeId={selectedNodeId}
            onAddChild={onAddChild}
            onAddSibling={onAddSibling}
            onDeleteNode={onDeleteNode}
            onSelectNode={onSelectNode}
          />
        ))}
      </div>
    </div>
  );
});

MindmapTreePanel.displayName = 'MindmapTreePanel';

/** 导出辅助函数（供 GraphCanvas 删除子树时使用） */
export { collectDescendantIds, buildChildrenMap };

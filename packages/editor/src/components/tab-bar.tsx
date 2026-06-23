/**
 * TabBar 组件 — 多标签页视图管理
 *
 * 功能：
 * - 按 AI 会话（sessionId）分组，支持展开/折叠
 * - 手动管理：新建/关闭/重命名/拖拽排序
 * - 历史会话默认折叠（仅最新会话展开）
 * - 关闭确认框（避免误操作）
 * - 悬停提示完整视图信息
 *
 * 数据流：
 * - 用户操作 → on* 回调 → App 发送 WebSocket 消息
 * - 服务端广播 → Store 更新 views/activeViewId → TabBar 重新渲染
 */
import { useState, useCallback, useRef, useEffect, useMemo, type DragEvent } from 'react';
import type { ViewSummary } from '@mermaid2aichat/serializer';

export interface TabBarProps {
  /** 所有视图列表 */
  views: ViewSummary[];
  /** 活动视图 ID */
  activeViewId: string | null;
  /** 切换活动视图 */
  onSwitchView: (viewId: string) => void;
  /** 新建空白视图 */
  onCreateView: () => void;
  /** 关闭视图（已由 TabBar 内部处理确认框，外部直接执行） */
  onCloseView: (viewId: string) => void;
  /** 重命名视图 */
  onRenameView: (viewId: string, title: string) => void;
  /** 重排序视图（同组内） */
  onReorderViews: (orderedIds: string[]) => void;
}

/** 视图分组 */
interface ViewGroup {
  /** 分组键：sessionId / 'manual' / 'ungrouped' */
  key: string;
  /** 显示名称 */
  label: string;
  /** 组内视图（按 createdAt 倒序） */
  views: ViewSummary[];
  /** 是否为最新会话（用于默认折叠判断） */
  isLatest: boolean;
}

/** 分组键类型 */
const MANUAL_KEY = 'manual';
const UNGROUPED_KEY = 'ungrouped';

/**
 * 按会话分组视图
 * - source='user' → 'manual' 组
 * - source='ai' 且有 sessionId → 按 sessionId 分组
 * - source='ai' 且无 sessionId → 'ungrouped' 组
 */
function groupViewsBySession(views: ViewSummary[]): ViewGroup[] {
  const groupMap = new Map<string, ViewSummary[]>();

  for (const view of views) {
    let key: string;
    if (view.source === 'user') {
      key = MANUAL_KEY;
    } else if (view.sessionId) {
      key = view.sessionId;
    } else {
      key = UNGROUPED_KEY;
    }

    let group = groupMap.get(key);
    if (!group) {
      group = [];
      groupMap.set(key, group);
    }
    group.push(view);
  }

  // 找出最新的 AI 会话（按组内最新视图时间）
  const sessionLatestTime = new Map<string, number>();
  for (const view of views) {
    if (view.source === 'ai' && view.sessionId) {
      const existing = sessionLatestTime.get(view.sessionId) ?? 0;
      sessionLatestTime.set(view.sessionId, Math.max(existing, view.createdAt));
    }
  }
  const latestSessionId = sessionLatestTime.size > 0
    ? Array.from(sessionLatestTime.entries()).sort(([, a], [, b]) => b - a)[0][0]
    : null;

  // 构建分组数组（手动组在前，最新会话其次，历史会话最后）
  const groups: ViewGroup[] = [];
  for (const [key, groupViews] of groupMap.entries()) {
    const sortedViews = [...groupViews].sort((a, b) => b.createdAt - a.createdAt);
    let label: string;
    let isLatest = false;

    if (key === MANUAL_KEY) {
      label = '手动创建';
    } else if (key === UNGROUPED_KEY) {
      label = '未分组';
    } else {
      label = `AI 会话 ${key.slice(0, 8)}`;
      isLatest = key === latestSessionId;
    }

    groups.push({ key, label, views: sortedViews, isLatest });
  }

  // 排序：手动组 → 最新会话 → 历史会话（按最新时间倒序）
  groups.sort((a, b) => {
    if (a.key === MANUAL_KEY) return -1;
    if (b.key === MANUAL_KEY) return 1;
    if (a.isLatest) return -1;
    if (b.isLatest) return 1;
    if (a.key === UNGROUPED_KEY) return 1;
    if (b.key === UNGROUPED_KEY) return -1;
    const aTime = a.views[0]?.createdAt ?? 0;
    const bTime = b.views[0]?.createdAt ?? 0;
    return bTime - aTime;
  });

  return groups;
}

/** 格式化视图标题（无标题时生成默认标题） */
function formatViewTitle(view: ViewSummary): string {
  if (view.title) return view.title;
  const date = new Date(view.createdAt);
  const timeStr = `${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  return view.source === 'ai' ? `AI输出 ${timeStr}` : `新建视图 ${timeStr}`;
}

/** 格式化悬停提示 */
function formatTooltip(view: ViewSummary): string {
  const created = new Date(view.createdAt).toLocaleString('zh-CN');
  const updated = new Date(view.updatedAt).toLocaleString('zh-CN');
  const source = view.source === 'ai' ? 'AI' : '用户';
  const session = view.sessionId ? `\n会话: ${view.sessionId.slice(0, 8)}` : '';
  return `标题: ${formatViewTitle(view)}\n创建: ${created}\n更新: ${updated}\n来源: ${source}${session}`;
}

export function TabBar(props: TabBarProps) {
  const { views, activeViewId, onSwitchView, onCreateView, onCloseView, onRenameView, onReorderViews } = props;
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // 关闭确认模态对话框（替代 window.confirm，VSCode webview 禁止原生对话框）
  const [closeConfirmView, setCloseConfirmView] = useState<ViewSummary | null>(null);
  const dragSourceId = useRef<string | null>(null);
  // 重命名 input 引用：useEffect 接管焦点管理，比重渲染时的 autoFocus 更可靠
  const editInputRef = useRef<HTMLInputElement>(null);

  // memoize groups：groupViewsBySession 每次调用都返回新数组/对象，避免 useEffect 依赖变化导致无限循环
  const groups = useMemo(() => groupViewsBySession(views), [views]);

  // 初始化折叠状态：历史会话默认折叠（仅最新会话和手动组展开）
  useEffect(() => {
    setCollapsedGroups((prev) => {
      if (prev.size > 0) return prev; // 已初始化
      const collapsed = new Set<string>();
      for (const group of groups) {
        // 历史会话（非最新 AI 会话）默认折叠
        if (group.key !== MANUAL_KEY && group.key !== UNGROUPED_KEY && !group.isLatest) {
          collapsed.add(group.key);
        }
      }
      return collapsed;
    });
  }, [groups]);

  // 进入编辑态时聚焦 input 并全选文本
  // 使用 useRef + useEffect 管理焦点，避免重渲染时 autoFocus 失效
  useEffect(() => {
    if (editingViewId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingViewId]);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleStartRename = useCallback((view: ViewSummary) => {
    setEditingViewId(view.id);
    setEditingTitle(view.title ?? '');
  }, []);

  const handleCommitRename = useCallback(() => {
    if (editingViewId) {
      const trimmed = editingTitle.trim();
      if (trimmed) {
        onRenameView(editingViewId, trimmed);
      }
      setEditingViewId(null);
      setEditingTitle('');
    }
  }, [editingViewId, editingTitle, onRenameView]);

  const handleCancelRename = useCallback(() => {
    setEditingViewId(null);
    setEditingTitle('');
  }, []);

  const handleCloseClick = useCallback((view: ViewSummary) => {
    setCloseConfirmView(view);
  }, []);

  const handleConfirmClose = useCallback(() => {
    if (closeConfirmView) {
      onCloseView(closeConfirmView.id);
      setCloseConfirmView(null);
    }
  }, [closeConfirmView, onCloseView]);

  const handleCancelClose = useCallback(() => {
    setCloseConfirmView(null);
  }, []);

  // === 拖拽排序（仅同组内） ===
  const handleDragStart = useCallback((e: DragEvent, viewId: string) => {
    dragSourceId.current = viewId;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: DragEvent, targetViewId: string, groupViews: ViewSummary[]) => {
    e.preventDefault();
    const sourceId = dragSourceId.current;
    dragSourceId.current = null;
    if (!sourceId || sourceId === targetViewId) return;

    // 同组内重排序
    const ids = groupViews.map((v) => v.id);
    const sourceIdx = ids.indexOf(sourceId);
    const targetIdx = ids.indexOf(targetViewId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    // 移动 source 到 target 位置
    ids.splice(sourceIdx, 1);
    ids.splice(targetIdx, 0, sourceId);
    onReorderViews(ids);
  }, [onReorderViews]);

  return (
    <div className="tab-bar">
      {groups.map((group) => {
        const collapsed = collapsedGroups.has(group.key);
        const isManualOrUngrouped = group.key === MANUAL_KEY || group.key === UNGROUPED_KEY;

        return (
          <div key={group.key} className="tab-group">
            {!isManualOrUngrouped && (
              <div
                className="tab-group-header"
                onClick={() => toggleGroup(group.key)}
                title={collapsed ? '点击展开' : '点击折叠'}
              >
                <span className="tab-group-toggle">{collapsed ? '▶' : '▼'}</span>
                <span className="tab-group-label">{group.label}</span>
                <span className="tab-group-count">({group.views.length})</span>
              </div>
            )}
            {!collapsed && group.views.map((view) => {
              const isActive = view.id === activeViewId;
              const isEditing = view.id === editingViewId;
              const title = formatViewTitle(view);
              const tooltip = formatTooltip(view);

              return (
                <div
                  key={view.id}
                  className={`tab-item ${isActive ? 'tab-item-active' : ''}`}
                  draggable={!isEditing}
                  onDragStart={(e) => handleDragStart(e, view.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, view.id, group.views)}
                  onClick={() => !isEditing && view.id !== activeViewId && onSwitchView(view.id)}
                  onDoubleClick={() => handleStartRename(view)}
                  title={tooltip}
                >
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      className="tab-edit-input"
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={(e) => {
                        // 仅当焦点真正离开 input（转移到其他元素）时才提交
                        // 避免 React reconciliation 过程中的意外失焦触发提交
                        if (e.relatedTarget !== null) {
                          handleCommitRename();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitRename();
                        if (e.key === 'Escape') handleCancelRename();
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <span className="tab-item-title">{title}</span>
                      <button
                        className="tab-item-close"
                        title="关闭"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseClick(view);
                        }}
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      <button
        className="tab-new"
        onClick={onCreateView}
        title="新建空白视图"
      >
        +
      </button>
      {/* 关闭确认模态对话框（替代 window.confirm，VSCode webview 禁止原生对话框） */}
      {closeConfirmView && (
        <div className="tab-modal-overlay" onClick={handleCancelClose}>
          <div className="tab-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tab-modal-message">
              确定关闭标签页「{formatViewTitle(closeConfirmView)}」？关闭后无法恢复。
            </div>
            <div className="tab-modal-actions">
              <button className="tab-modal-btn tab-modal-cancel" onClick={handleCancelClose}>
                取消
              </button>
              <button className="tab-modal-btn tab-modal-confirm" onClick={handleConfirmClose}>
                确认关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

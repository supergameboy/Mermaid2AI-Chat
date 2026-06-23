/**
 * NamespaceEditor — classDiagram 命名空间编辑面板
 *
 * 单一职责：添加/编辑/删除命名空间，显示命名空间内的类
 *
 * 数据流:
 *   ClassNamespaceInfo[] → NamespaceEditor → onCreate/onUpdate/onDelete → 更新 CanvasState.metadata.namespaces
 */

import { memo, useState } from 'react';
import type { ClassNamespaceInfo, MermaidNode } from '@mermaid2aichat/serializer';

export interface NamespaceEditorProps {
  /** 当前所有命名空间 */
  namespaces: ClassNamespaceInfo[];
  /** 可用的类节点列表（用于显示归属） */
  classes: MermaidNode[];
  /** 创建命名空间 */
  onCreate: (name: string) => void;
  /** 更新命名空间 */
  onUpdate: (oldName: string, newName: string) => void;
  /** 删除命名空间 */
  onDelete: (name: string) => void;
}

/** 命名空间编辑面板组件 */
export const NamespaceEditor = memo(function NamespaceEditor({
  namespaces,
  classes,
  onCreate,
  onUpdate,
  onDelete,
}: NamespaceEditorProps) {
  const [newName, setNewName] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName('');
  };

  const handleStartEdit = (currentName: string) => {
    setEditingName(currentName);
    setEditValue(currentName);
  };

  const handleSaveEdit = () => {
    if (!editingName) return;
    const newName = editValue.trim();
    if (newName && newName !== editingName) {
      onUpdate(editingName, newName);
    }
    setEditingName(null);
    setEditValue('');
  };

  // 查找命名空间内的类节点
  const getClassesInNamespace = (classIds: string[]): MermaidNode[] => {
    return classes.filter((c) => classIds.includes(c.id));
  };

  return (
    <div className="panel-content">
      <div className="panel-section-title">命名空间</div>

      {/* 创建新命名空间 */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        <input
          className="panel-input"
          type="text"
          placeholder="命名空间名称"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="panel-reset-btn"
          onClick={handleCreate}
          disabled={!newName.trim()}
        >
          添加
        </button>
      </div>

      {/* 命名空间列表 */}
      {namespaces.length === 0 && (
        <span style={{ fontSize: 12, color: '#999' }}>暂无命名空间</span>
      )}

      {namespaces.map((ns) => {
        const nsClasses = getClassesInNamespace(ns.classIds);
        return (
          <div
            key={ns.name}
            style={{
              padding: '8px',
              border: '1px solid #e8e8e8',
              borderRadius: '4px',
              marginBottom: '8px',
            }}
          >
            {/* 命名空间名称 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              {editingName === ns.name ? (
                <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                  <input
                    className="panel-input"
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="panel-reset-btn" onClick={handleSaveEdit}>保存</button>
                  <button type="button" className="panel-reset-btn" onClick={() => setEditingName(null)}>取消</button>
                </div>
              ) : (
                <>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{ns.name}</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      className="panel-reset-btn"
                      onClick={() => handleStartEdit(ns.name)}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="panel-reset-btn"
                      onClick={() => onDelete(ns.name)}
                      style={{ color: '#ff4d4f', borderColor: '#ff4d4f' }}
                    >
                      删除
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* 命名空间内的类 */}
            <div style={{ fontSize: 12, color: '#666' }}>
              包含类 ({nsClasses.length}):
              {nsClasses.length === 0 ? (
                <span style={{ color: '#999' }}> 无</span>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                  {nsClasses.map((c) => (
                    <span
                      key={c.id}
                      style={{
                        padding: '2px 8px',
                        backgroundColor: '#e6f7ff',
                        border: '1px solid #91d5ff',
                        borderRadius: '10px',
                        fontSize: 11,
                      }}
                    >
                      {c.data.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

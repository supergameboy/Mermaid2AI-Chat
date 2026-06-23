/**
 * Note 序列化器 — note 节点 → Mermaid note 代码
 *
 * 单一职责：将 note 信息序列化为 Mermaid classDiagram note 语法
 *
 * 语法:
 *   note for ClassName "note text"
 *
 * 数据流:
 *   ClassNoteInfo[] (metadata.classNotes) 或 note 节点 + note 边
 *     → serializeNotes(notes, nodes, edges)
 *     → 优先使用 metadata.classNotes 结构化信息
 *     → fallback: 从 note 节点和 note 边推断
 *     → 输出 Mermaid note 代码行
 */

import type {
  MermaidNode,
  MermaidEdge,
  ClassNoteInfo,
} from '../../types.js';

// ============================================================
// 公共 API
// ============================================================

/**
 * 序列化 note 列表
 *
 * 优先使用 metadata.classNotes 结构化信息（解析器输出的权威来源）
 * 如果不存在，从 note 节点（type='note'）和 note 边（type='note-edge'）推断
 *
 * @param notes - note 信息列表（从 metadata.classNotes 读取）
 * @param nodes - 画布所有节点（用于 fallback 推断）
 * @param edges - 画布所有边（用于 fallback 推断）
 * @returns Mermaid note 代码行数组
 */
export function serializeNotes(
  notes: ClassNoteInfo[] | undefined,
  nodes: MermaidNode[],
  edges: MermaidEdge[],
): string[] {
  if (notes && notes.length > 0) {
    return notes.map((note) => serializeNote(note.classId, note.label));
  }

  // fallback: 从 note 节点和 note 边推断
  return serializeNotesFromGraph(nodes, edges);
}

// ============================================================
// 内部实现
// ============================================================

/** 序列化单个 note */
function serializeNote(classId: string, label: string): string {
  const escapedLabel = escapeNoteText(label ?? '');
  return `note for ${classId} "${escapedLabel}"`;
}

/**
 * 从 note 节点和 note 边推断 note 信息
 *
 * note 节点: type='note', data.label=note 文本
 * note 边: type='note-edge', source=note 节点, target=class 节点
 */
function serializeNotesFromGraph(
  nodes: MermaidNode[],
  edges: MermaidEdge[],
): string[] {
  const lines: string[] = [];
  const noteNodes = nodes.filter((n) => n.type === 'note');
  const noteEdges = edges.filter((e) => e.type === 'note-edge');

  for (const noteNode of noteNodes) {
    // 找到 note 关联的 class（note 边 source=note, target=class）
    const noteEdge = noteEdges.find((e) => e.source === noteNode.id);
    if (!noteEdge) {
      continue;
    }

    const classId = noteEdge.target;
    const label = noteNode.data.label ?? '';
    lines.push(serializeNote(classId, label));
  }

  return lines;
}

/** 转义 note 文本中的特殊字符（双引号） */
function escapeNoteText(text: string): string {
  return text.replace(/"/g, '\\"');
}

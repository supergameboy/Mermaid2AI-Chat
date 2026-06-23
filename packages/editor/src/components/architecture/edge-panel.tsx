/**
 * Architecture Edge 属性面板（v4 修订）
 *
 * 单一职责：编辑 architecture 边的 lhsDir/rhsDir/箭头类型/title
 *
 * v4 修订（决策 13）:
 *   - 箭头类型从 checkbox 改为 4 种选择器：
 *     - `--`（无箭头）：lhsInto=false, rhsInto=false
 *     - `-->`（右箭头）：rhsInto=true, lhsInto=false
 *     - `<--`（左箭头）：lhsInto=true, rhsInto=false
 *     - `<-->`（双向箭头）：lhsInto=true, rhsInto=true
 *
 * 编辑字段:
 *   - source/target: 边的源/目标节点 ID（只读）
 *   - lhsDir: 源节点的连接方向（L/R/T/B）
 *   - rhsDir: 目标节点的连接方向（L/R/T/B）
 *   - arrowType: 箭头类型（--/-->/<--/<-->）
 *   - title: 边标题
 */

import type { MermaidEdge, MermaidNode, ArchitectureDirection, MermaidEdgeData, ArchitectureEdgeInfo } from '@mermaid2aichat/serializer';

export interface ArchitectureEdgePanelProps {
  /** 当前编辑的边 */
  edge: MermaidEdge;
  /** 所有节点（用于显示源/目标） */
  nodes: MermaidNode[];
  /** 边更新回调 */
  onChange: (updates: Partial<MermaidEdge>) => void;
  /** 边删除回调 */
  onDelete: () => void;
}

/** 方向选项 */
const DIRECTION_OPTIONS: ReadonlyArray<{ value: ArchitectureDirection; label: string }> = [
  { value: 'L', label: 'L (左)' },
  { value: 'R', label: 'R (右)' },
  { value: 'T', label: 'T (上)' },
  { value: 'B', label: 'B (下)' },
];

/** v4：箭头类型选项（决策 13） */
const ARROW_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string; lhsInto: boolean; rhsInto: boolean }> = [
  { value: '--', label: '-- （无箭头）', lhsInto: false, rhsInto: false },
  { value: '-->', label: '--> （右箭头）', lhsInto: false, rhsInto: true },
  { value: '<--', label: '<-- （左箭头）', lhsInto: true, rhsInto: false },
  { value: '<-->', label: '<--> （双向箭头）', lhsInto: true, rhsInto: true },
];

/** Handle ID → 方向 */
function handleIdToDirection(handleId: string | null | undefined): ArchitectureDirection {
  switch (handleId) {
    case 'left': return 'L';
    case 'right': return 'R';
    case 'top': return 'T';
    case 'bottom': return 'B';
    default: return 'L';
  }
}

/** 方向 → Handle ID */
function directionToHandleId(dir: ArchitectureDirection): string {
  switch (dir) {
    case 'L': return 'left';
    case 'R': return 'right';
    case 'T': return 'top';
    case 'B': return 'bottom';
  }
}

/** v4：根据 lhsInto/rhsInto 推导箭头类型 */
function deriveArrowType(lhsInto: boolean, rhsInto: boolean): string {
  if (lhsInto && rhsInto) return '<-->';
  if (lhsInto) return '<--';
  if (rhsInto) return '-->';
  return '--';
}

/** Architecture Edge 属性面板（v4 修订） */
export function ArchitectureEdgePanel({ edge, nodes, onChange, onDelete }: ArchitectureEdgePanelProps) {
  const archEdge = edge.data.archEdge;
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);

  // 如果没有 archEdge，从 handleId 推导
  const lhsDir = archEdge?.lhsDir ?? handleIdToDirection(edge.sourceHandle);
  const rhsDir = archEdge?.rhsDir ?? handleIdToDirection(edge.targetHandle);
  const lhsInto = archEdge?.lhsInto ?? false;
  const rhsInto = archEdge?.rhsInto ?? false;
  const arrowType = deriveArrowType(lhsInto, rhsInto);
  const title = archEdge?.title ?? '';

  /** 更新 archEdge 字段 */
  function updateArchEdge(updates: Partial<{
    lhsDir: ArchitectureDirection;
    rhsDir: ArchitectureDirection;
    lhsInto: boolean;
    rhsInto: boolean;
    title: string;
  }>) {
    const newLhsInto = updates.lhsInto ?? lhsInto;
    const newRhsInto = updates.rhsInto ?? rhsInto;

    const newArchEdge: ArchitectureEdgeInfo = {
      lhsId: edge.source,
      lhsDir: updates.lhsDir ?? lhsDir,
      lhsInto: newLhsInto,
      rhsId: edge.target,
      rhsDir: updates.rhsDir ?? rhsDir,
      rhsInto: newRhsInto,
      ...(archEdge?.lhsGroup ? { lhsGroup: archEdge.lhsGroup } : {}),
      ...(archEdge?.rhsGroup ? { rhsGroup: archEdge.rhsGroup } : {}),
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(archEdge?.title && updates.title === undefined ? { title: archEdge.title } : {}),
    };

    const newData: MermaidEdgeData = {
      ...edge.data,
      edgeStyle: (newLhsInto || newRhsInto) ? 'arrow' : 'line',
      archEdge: newArchEdge,
    };

    onChange({
      data: newData,
      sourceHandle: directionToHandleId(newArchEdge.lhsDir),
      targetHandle: directionToHandleId(newArchEdge.rhsDir),
    });
  }

  return (
    <div className="arch-edge-panel" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>边属性</h3>

      {/* source / target（只读） */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div>
          <span style={{ fontSize: 12, color: '#666' }}>源节点: </span>
          <span style={{ fontSize: 12 }}>{sourceNode?.data.label ?? edge.source}</span>
        </div>
        <div>
          <span style={{ fontSize: 12, color: '#666' }}>目标节点: </span>
          <span style={{ fontSize: 12 }}>{targetNode?.data.label ?? edge.target}</span>
        </div>
      </div>

      {/* lhsDir 选择 */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#666' }}>源方向（lhsDir）</span>
        <select
          value={lhsDir}
          onChange={(e) => {
            updateArchEdge({ lhsDir: e.target.value as ArchitectureDirection });
          }}
          style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4 }}
        >
          {DIRECTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {/* rhsDir 选择 */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#666' }}>目标方向（rhsDir）</span>
        <select
          value={rhsDir}
          onChange={(e) => {
            updateArchEdge({ rhsDir: e.target.value as ArchitectureDirection });
          }}
          style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4 }}
        >
          {DIRECTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {/* v4：箭头类型选择器（决策 13） */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#666' }}>箭头类型</span>
        <select
          value={arrowType}
          onChange={(e) => {
            const selected = ARROW_TYPE_OPTIONS.find((opt) => opt.value === e.target.value);
            if (selected) {
              updateArchEdge({ lhsInto: selected.lhsInto, rhsInto: selected.rhsInto });
            }
          }}
          style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4 }}
        >
          {ARROW_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {/* title 编辑 */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#666' }}>标题</span>
        <input
          type="text"
          value={title}
          placeholder="（可选）"
          onChange={(e) => {
            updateArchEdge({ title: e.target.value });
          }}
          style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4 }}
        />
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
        删除边
      </button>
    </div>
  );
}

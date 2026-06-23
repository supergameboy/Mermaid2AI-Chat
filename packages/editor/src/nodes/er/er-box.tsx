/**
 * ErBox 节点组件 — 渲染 ER 实体盒（标题栏 + 属性列表）
 *
 * 单一职责：渲染 erDiagram 的实体节点视觉，管理 Handle 连接点
 *
 * 数据流:
 *   MermaidNode (type='er-box') → ErBoxComponent
 *     → 标题栏 (label + alias)
 *     → 属性列表 (attributes: type name [keys] comment)
 *
 * 字段约定（通过 MermaidNodeData 索引签名承载）:
 *   - label: string                  — 实体名（M0 定义）
 *   - attributes?: NodeAttribute[]   — 属性列表（M0 定义）
 *   - alias?: string                 — 实体别名（er 专用，通过索引签名承载）
 *   - colorIndex?: number            — 颜色索引（er 专用，通过索引签名承载）
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type {
  MermaidNodeData,
  NodeAttribute,
  ERAttributeKey,
} from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

/** React Flow 节点类型，data 为 MermaidNodeData */
export type ErFlowNode = Node<MermaidNodeData, 'er-box'>;

// ============================================================
// 常量
// ============================================================

const handleStyle = { width: 8, height: 8 };

/** key badge 样式映射 */
const KEY_BADGE_STYLES: Readonly<Record<ERAttributeKey, { background: string; color: string }>> = {
  PK: { background: '#ff4d4f', color: '#fff' },
  FK: { background: '#1890ff', color: '#fff' },
  UK: { background: '#52c41a', color: '#fff' },
};

/** key 显示顺序约定（PK > FK > UK） */
const KEY_ORDER: readonly ERAttributeKey[] = ['PK', 'FK', 'UK'];

// ============================================================
// 辅助函数
// ============================================================

/** 安全读取 MermaidNodeData 的扩展字段 */
function readField<T>(data: MermaidNodeData, key: string): T | undefined {
  const value = (data as Record<string, unknown>)[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as T;
}

/** 渲染属性的 key badge 列表（按 PK > FK > UK 顺序） */
function renderKeyBadges(keys: ERAttributeKey[]): React.ReactNode {
  const sorted = KEY_ORDER.filter((k) => keys.includes(k));
  if (sorted.length === 0) return null;
  return sorted.map((key) => {
    const style = KEY_BADGE_STYLES[key];
    return (
      <span
        key={key}
        style={{
          display: 'inline-block',
          background: style.background,
          color: style.color,
          padding: '0 4px',
          borderRadius: 2,
          fontSize: 10,
          fontWeight: 'bold',
          marginLeft: 4,
          lineHeight: '14px',
        }}
      >
        {key}
      </span>
    );
  });
}

// ============================================================
// 节点组件
// ============================================================

/** ErBox 节点组件 — 渲染 ER 实体盒（标题栏 + 属性列表） */
export const ErBoxComponent = memo(function ErBoxComponent({
  data,
  selected,
}: NodeProps<ErFlowNode>) {
  const attributes = data.attributes ?? [];
  const alias = readField<string>(data, 'alias');

  const borderColor = selected ? '#1890ff' : '#333';
  const borderWidth = selected ? '2px' : '1px';

  return (
    <div
      className="er-box"
      style={{
        position: 'relative',
        display: 'inline-block',
        minWidth: 180,
        border: `${borderWidth} solid ${borderColor}`,
        borderRadius: 4,
        background: '#fff',
        fontSize: 13,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* 四方向 Handle — 支持任意方向连接 */}
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="target" position={Position.Left} id="left" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="right" style={handleStyle} />

      {/* 标题栏：实体名 + 别名 */}
      <div
        className="er-box-header"
        style={{
          background: '#f0f0f0',
          padding: '6px 12px',
          fontWeight: 'bold',
          textAlign: 'center',
          borderBottom: attributes.length > 0 ? `1px solid ${borderColor}` : 'none',
        }}
      >
        <div>{data.label}</div>
        {alias && (
          <div style={{ fontSize: 11, fontWeight: 'normal', color: '#999', marginTop: 2 }}>
            ({alias})
          </div>
        )}
      </div>

      {/* 属性列表 */}
      {attributes.length > 0 && (
        <div className="er-box-attributes" style={{ padding: '4px 8px' }}>
          {attributes.map((attr: NodeAttribute, i: number) => (
            <div
              key={`attr-${i}`}
              style={{ fontFamily: 'monospace', padding: '1px 0', display: 'flex', alignItems: 'center' }}
            >
              <span style={{ color: '#666', marginRight: 6 }}>{attr.type}</span>
              <span>{attr.name}</span>
              {renderKeyBadges(attr.keys)}
              {attr.comment && (
                <span style={{ color: '#999', fontStyle: 'italic', marginLeft: 8, fontSize: 12 }}>
                  &quot;{attr.comment}&quot;
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 空属性提示 */}
      {attributes.length === 0 && (
        <div style={{ padding: '4px 8px', color: '#999', fontStyle: 'italic' }}>
          （无属性）
        </div>
      )}
    </div>
  );
});

ErBoxComponent.displayName = 'ErBox';

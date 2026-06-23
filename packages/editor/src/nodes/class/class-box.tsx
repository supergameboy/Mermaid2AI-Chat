/**
 * ClassBox 节点组件 — 渲染类盒（标题栏 + 属性列表 + 方法列表）
 *
 * 单一职责：渲染 classDiagram 的类节点视觉，管理 Handle 连接点
 *
 * 数据流:
 *   MermaidNode (type='class-box') → ClassBoxComponent
 *     → 标题栏 (label + stereotype + generics + annotations)
 *     → 属性列表 (members filter !isMethod)
 *     → 方法列表 (members filter isMethod)
 *
 * 字段约定（通过 MermaidNodeData 索引签名承载）:
 *   - label: string                  — 类名（M0 定义）
 *   - members?: NodeMember[]         — 成员列表（M0 定义）
 *   - stereotype?: ClassStereotype   — 构造型（class 专用）
 *   - generics?: string              — 泛型（class 专用）
 *   - annotations?: string[]         — 注解列表（class 专用）
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type {
  MermaidNodeData,
  NodeMember,
  ClassVisibility,
} from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

/** Class stereotype — class 专用（M0 未定义，本模块保留） */
export type ClassStereotype =
  | 'interface' | 'abstract' | 'annotation' | 'enum'
  | 'protocol' | 'exception' | 'metaclass' | 'stereotype';

/** React Flow 节点类型，data 为 MermaidNodeData */
export type ClassBoxFlowNode = Node<MermaidNodeData, 'class-box'>;

// ============================================================
// 常量
// ============================================================

const handleStyle = { width: 8, height: 8 };

const STEREOTYPE_LABELS: Readonly<Record<ClassStereotype, string>> = {
  interface: '<<interface>>',
  abstract: '<<abstract>>',
  annotation: '<<annotation>>',
  enum: '<<enum>>',
  protocol: '<<protocol>>',
  exception: '<<exception>>',
  metaclass: '<<metaclass>>',
  stereotype: '<<stereotype>>',
};

const VISIBILITY_SYMBOLS: Readonly<Record<ClassVisibility, string>> = {
  '+': '+',
  '-': '-',
  '#': '#',
  '~': '~',
  '': '',
};

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

/** 获取成员的 classifier 后缀（static `*` / abstract `$`） */
function getClassifierSuffix(member: NodeMember): string {
  if (member.isStatic) return ' *';
  if (member.isAbstract) return ' $';
  return '';
}

/** 格式化属性显示文本 */
function formatAttribute(member: NodeMember): string {
  const visibility = VISIBILITY_SYMBOLS[member.visibility] ?? '';
  const typePart = member.type ? `: ${member.type}` : '';
  const classifier = getClassifierSuffix(member);
  return `${visibility} ${member.name}${typePart}${classifier}`;
}

/** 格式化方法显示文本 */
function formatMethod(member: NodeMember): string {
  const visibility = VISIBILITY_SYMBOLS[member.visibility] ?? '';
  const params = member.parameters ?? '';
  const returnTypePart = member.returnType ? `: ${member.returnType}` : '';
  const classifier = getClassifierSuffix(member);
  return `${visibility} ${member.name}(${params})${returnTypePart}${classifier}`;
}

// ============================================================
// 节点组件
// ============================================================

/** ClassBox 节点组件 — 渲染类盒（标题栏 + 属性列表 + 方法列表） */
export const ClassBoxComponent = memo(function ClassBoxComponent({
  data,
  selected,
}: NodeProps<ClassBoxFlowNode>) {
  const members = data.members ?? [];
  const fields = members.filter((m) => !m.isMethod);
  const methods = members.filter((m) => m.isMethod);

  const stereotype = readField<ClassStereotype>(data, 'stereotype');
  const generics = readField<string>(data, 'generics');
  const annotations = readField<string[]>(data, 'annotations') ?? [];

  const borderColor = selected ? '#1890ff' : '#333';
  const borderWidth = selected ? '2px' : '1px';

  return (
    <div
      className="class-box"
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

      {/* 标题栏：类名 + stereotype + generics */}
      <div
        className="class-box-header"
        style={{
          background: '#f0f0f0',
          padding: '6px 12px',
          fontWeight: 'bold',
          textAlign: 'center',
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        {/* stereotype 行（如 <<interface>>） */}
        {stereotype && (
          <div style={{ fontSize: 11, fontWeight: 'normal', color: '#666' }}>
            {STEREOTYPE_LABELS[stereotype]}
          </div>
        )}
        {/* annotations 行（非 stereotype 的额外注解） */}
        {annotations.length > 0 && (
          <div style={{ fontSize: 11, fontWeight: 'normal', color: '#999' }}>
            {annotations.map((ann) => `<<${ann}>>`).join(' ')}
          </div>
        )}
        {/* 类名 + 泛型 */}
        <div>
          {data.label}
          {generics && (
            <span style={{ fontStyle: 'italic' }}>{`~${generics}~`}</span>
          )}
        </div>
      </div>

      {/* 属性列表 */}
      {fields.length > 0 && (
        <div
          className="class-box-fields"
          style={{
            padding: '4px 8px',
            borderBottom: methods.length > 0 ? `1px solid ${borderColor}` : 'none',
          }}
        >
          {fields.map((member, i) => (
            <div key={`field-${i}`} style={{ fontFamily: 'monospace', padding: '1px 0' }}>
              {formatAttribute(member)}
            </div>
          ))}
        </div>
      )}

      {/* 方法列表 */}
      {methods.length > 0 && (
        <div className="class-box-methods" style={{ padding: '4px 8px' }}>
          {methods.map((member, i) => (
            <div key={`method-${i}`} style={{ fontFamily: 'monospace', padding: '1px 0' }}>
              {formatMethod(member)}
            </div>
          ))}
        </div>
      )}

      {/* 空类提示 */}
      {fields.length === 0 && methods.length === 0 && (
        <div style={{ padding: '4px 8px', color: '#999', fontStyle: 'italic' }}>
          （空类）
        </div>
      )}
    </div>
  );
});

ClassBoxComponent.displayName = 'ClassBox';

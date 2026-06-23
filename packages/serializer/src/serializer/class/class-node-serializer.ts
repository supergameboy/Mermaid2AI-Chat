/**
 * 类节点序列化器 — MermaidNode (class-box) → Mermaid class 代码
 *
 * 单一职责：将类节点序列化为 Mermaid classDiagram 类定义语法
 *
 * 语法:
 *   class ClassName {
 *     <<interface>>
 *     +attr: Type
 *     -privateAttr: Type
 *     #protectedAttr: Type
 *     ~packageAttr: Type
 *     +staticAttr: Type*
 *     +abstractMethod(): ReturnType*
 *     -method(): void
 *   }
 *
 * 数据流:
 *   MermaidNode (type='class-box')
 *     → serializeClassNode(node, indent)
 *     → 处理 stereotype/annotations/generics/members
 *     → 输出 Mermaid class 代码块
 */

import type {
  MermaidNode,
  NodeMember,
  ClassVisibility,
  MermaidNodeData,
} from '../../types.js';

// ============================================================
// 常量
// ============================================================

/** Class stereotype → Mermaid 注解语法（`<<stereotype>>`） */
const STEREOTYPE_TO_ANNOTATION: Readonly<Record<string, string>> = {
  interface: '<<interface>>',
  abstract: '<<abstract>>',
  annotation: '<<annotation>>',
  enum: '<<enum>>',
  protocol: '<<protocol>>',
  exception: '<<exception>>',
  metaclass: '<<metaclass>>',
  stereotype: '<<stereotype>>',
};

/** 可见性符号映射 */
const VISIBILITY_SYMBOL: Readonly<Record<ClassVisibility, string>> = {
  '+': '+',
  '-': '-',
  '#': '#',
  '~': '~',
  '': '',
};

// ============================================================
// 公共 API
// ============================================================

/**
 * 序列化类节点为 Mermaid class 代码
 *
 * @param node - 类节点 (type='class-box')
 * @param indent - 缩进（用于 namespace 内的类，默认空字符串）
 * @returns Mermaid class 代码块（含 `class ... { ... }` 或单行 `class Name`）
 */
export function serializeClassNode(node: MermaidNode, indent = ''): string {
  const { data } = node;
  const label = data.label;
  const members = data.members ?? [];
  const stereotype = readField<string>(data, 'stereotype');
  const annotations = readField<string[]>(data, 'annotations') ?? [];
  const generics = readField<string>(data, 'generics');

  // 类名（含泛型，mermaid 使用 ~Type~ 语法）
  const classNameWithGenerics = generics ? `${label}~${generics}~` : label;

  // 收集需要输出的注解（去重：stereotype 对应的注解 + 其他 annotations）
  const annotationsToOutput = collectAnnotations(stereotype, annotations);

  // 无成员且无注解时，输出单行类声明
  if (members.length === 0 && annotationsToOutput.length === 0) {
    return `${indent}class ${classNameWithGenerics}`;
  }

  // 有成员或注解时，输出多行类定义
  const lines: string[] = [];
  lines.push(`${indent}class ${classNameWithGenerics} {`);

  // 注解（stereotype，如 `<<interface>>`）
  for (const annotation of annotationsToOutput) {
    lines.push(`${indent}  ${annotation}`);
  }

  // 成员（属性和方法，按 NodeMember[] 顺序输出）
  for (const member of members) {
    lines.push(`${indent}  ${serializeMember(member)}`);
  }

  lines.push(`${indent}}`);

  return lines.join('\n');
}

// ============================================================
// 内部实现
// ============================================================

/**
 * 序列化单个类成员为 Mermaid 代码行
 *
 * 属性格式: `[visibility]name[: Type][classifier]`
 *   - classifier: `*` (static) / `$` (abstract)
 *
 * 方法格式: `[visibility]name(parameters)[: ReturnType][classifier]`
 *   - parameters: 方法参数列表（如 "param1: Type, param2: Type"）
 *   - classifier: `*` (static) / `$` (abstract)
 */
function serializeMember(member: NodeMember): string {
  const visibility = VISIBILITY_SYMBOL[member.visibility] ?? '';
  const classifier = member.isStatic ? '*' : member.isAbstract ? '$' : '';

  if (member.isMethod) {
    // 方法: visibility + name(parameters) + : ReturnType + classifier
    const params = member.parameters ?? '';
    const returnType = member.returnType ? `: ${member.returnType}` : '';
    return `${visibility}${member.name}(${params})${returnType}${classifier}`;
  }

  // 属性: visibility + name + : Type + classifier
  const type = member.type ? `: ${member.type}` : '';
  return `${visibility}${member.name}${type}${classifier}`;
}

/**
 * 收集需要输出的注解
 *
 * 规则:
 *   - 如果 stereotype 存在，输出对应的 `<<stereotype>>`
 *   - 如果 annotations 包含非 stereotype 的注解，也输出 `<<annotation>>`
 *   - 去重：避免 stereotype 对应的注解被重复输出
 */
function collectAnnotations(
  stereotype: string | undefined,
  annotations: string[],
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  // 输出 stereotype 对应的注解
  if (stereotype) {
    const annotation = STEREOTYPE_TO_ANNOTATION[stereotype];
    if (annotation) {
      result.push(annotation);
      seen.add(stereotype.toLowerCase());
    }
  }

  // 输出其他 annotations（非 stereotype 的注解）
  for (const ann of annotations) {
    const lower = ann.toLowerCase().trim();
    if (seen.has(lower)) {
      continue;
    }
    // 跳过已经被 stereotype 覆盖的注解
    if (STEREOTYPE_TO_ANNOTATION[lower]) {
      continue;
    }
    result.push(`<<${ann}>>`);
    seen.add(lower);
  }

  return result;
}

/** 安全读取 MermaidNodeData 的扩展字段 */
function readField<T>(data: MermaidNodeData, key: string): T | undefined {
  const value = (data as Record<string, unknown>)[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as T;
}

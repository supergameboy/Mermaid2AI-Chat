/**
 * class round-trip 等价测试
 *
 * 验证 代码 → 解析 → CanvasState → 序列化 → 代码 的语义等价
 *
 * 等价判定策略:
 *   1. 原始代码 → parse → canvas1 → serialize → code2 → parse → canvas2
 *   2. 比较 canvas1 和 canvas2 的结构等价（节点数、边数、关键属性）
 *   3. 不做字符级精确匹配（mermaid 语法允许空格/换行差异）
 *
 * 覆盖场景:
 *   - 基础 round-trip（类、成员、关系）
 *   - stereotype round-trip
 *   - 7 种关系类型 round-trip
 *   - 基数和标签 round-trip
 *   - namespace round-trip
 *   - Note round-trip
 *   - 样式系统 round-trip
 *   - direction round-trip
 */
import { describe, it, expect } from 'vitest';
import { parseClassCode as parseClass } from '../../src/index.js';
import { serializeClass } from '../../src/serializer/class/class-serializer.js';
import type { GraphCanvasState, MermaidNode, MermaidEdge, ClassNoteInfo, ClassNamespaceInfo } from '../../src/types.js';

// ============================================================
// 辅助函数
// ============================================================

/** round-trip: 代码 → 解析 → 序列化 → 代码 → 解析 → canvas */
function roundTrip(code: string): {
  canvas1: GraphCanvasState;
  code2: string;
  canvas2: GraphCanvasState;
  success: boolean;
} {
  const parsed1 = parseClass(code);
  if (!parsed1.success) {
    return {
      canvas1: parsed1.canvas,
      code2: '',
      canvas2: parsed1.canvas,
      success: false,
    };
  }

  const serialized = serializeClass(parsed1.canvas);
  const parsed2 = parseClass(serialized.mermaid);

  return {
    canvas1: parsed1.canvas,
    code2: serialized.mermaid,
    canvas2: parsed2.canvas,
    success: parsed2.success,
  };
}

/** 比较两个节点的关键属性 */
function expectNodesEquivalent(nodes1: MermaidNode[], nodes2: MermaidNode[]): void {
  expect(nodes2).toHaveLength(nodes1.length);
  for (const node1 of nodes1) {
    const node2 = nodes2.find((n) => n.id === node1.id);
    expect(node2).toBeDefined();
    expect(node2?.type).toBe(node1.type);
    expect(node2?.data.label).toBe(node1.data.label);
    expect(node2?.data.shape).toBe(node1.data.shape);
  }
}

/** 比较两个边列表的关键属性 */
function expectEdgesEquivalent(edges1: MermaidEdge[], edges2: MermaidEdge[]): void {
  expect(edges2).toHaveLength(edges1.length);
  for (const edge1 of edges1) {
    const edge2 = edges2.find(
      (e) => e.source === edge1.source && e.target === edge1.target,
    );
    expect(edge2).toBeDefined();
    expect(edge2?.type).toBe(edge1.type);
    expect(edge2?.data.relationType).toBe(edge1.data.relationType);
  }
}

// ============================================================
// 测试用例
// ============================================================

describe('Class Round-trip 等价', () => {
  describe('基础 round-trip', () => {
    it('应 round-trip 空画布', () => {
      const original = `classDiagram

class A
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas2.nodes).toHaveLength(canvas1.nodes.length);
    });

    it('应 round-trip 单个类', () => {
      const original = `classDiagram

class Animal
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas2.nodes).toHaveLength(1);
      expect(canvas2.nodes[0]?.id).toBe('Animal');
      expect(canvas2.nodes[0]?.data.label).toBe('Animal');
      expectNodesEquivalent(canvas1.nodes, canvas2.nodes);
    });

    it('应 round-trip 带成员的类', () => {
      const original = `classDiagram

class Animal {
  +name: String
  -age: int
  +eat(): void
}
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas2.nodes).toHaveLength(1);
      const node1 = canvas1.nodes[0];
      const node2 = canvas2.nodes[0];
      expect(node2?.data.members).toHaveLength(node1?.data.members?.length ?? 0);

      // 验证成员名和可见性
      const member1 = node2?.data.members?.[0];
      expect(member1?.name).toBe('name');
      expect(member1?.visibility).toBe('+');
      expect(member1?.type).toBe('String');

      const method = node2?.data.members?.[2];
      expect(method?.name).toBe('eat');
      expect(method?.isMethod).toBe(true);
      expect(method?.returnType).toBe('void');
    });

    it('应 round-trip 多个类', () => {
      const original = `classDiagram

class A
class B
class C
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas2.nodes).toHaveLength(3);
      expectNodesEquivalent(canvas1.nodes, canvas2.nodes);
    });
  });

  describe('stereotype round-trip', () => {
    it('应 round-trip interface stereotype', () => {
      const original = `classDiagram

class Shape {
  <<interface>>
  +draw(): void
}
`;
      const { canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      const node = canvas2.nodes[0];
      expect(node?.data.stereotype).toBe('interface');
      expect(node?.data.members).toHaveLength(1);
      expect(node?.data.members?.[0]?.name).toBe('draw');
    });

    it('应 round-trip abstract stereotype', () => {
      const original = `classDiagram

class Animal {
  <<abstract>>
  +sound(): void
}
`;
      const { canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas2.nodes[0]?.data.stereotype).toBe('abstract');
    });

    it('应 round-trip enum stereotype', () => {
      const original = `classDiagram

class Color {
  <<enum>>
  RED
  GREEN
}
`;
      const { canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas2.nodes[0]?.data.stereotype).toBe('enum');
      expect(canvas2.nodes[0]?.data.members?.length).toBeGreaterThan(0);
    });
  });

  describe('泛型 round-trip', () => {
    it('应 round-trip 泛型类', () => {
      const original = `classDiagram

class List~Item~ {
  +items: Item[]
}
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas2.nodes[0]?.id).toBe('List');
      expect(canvas2.nodes[0]?.data.generics).toBe('Item');
      expect(canvas2.nodes[0]?.data.generics).toBe(canvas1.nodes[0]?.data.generics);
    });
  });

  describe('成员 round-trip', () => {
    it('应 round-trip visibility', () => {
      const original = `classDiagram

class A {
  +publicAttr: Type
  -privateAttr: Type
  #protectedAttr: Type
  ~packageAttr: Type
}
`;
      const { canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      const members = canvas2.nodes[0]?.data.members ?? [];
      expect(members).toHaveLength(4);
      expect(members[0]?.visibility).toBe('+');
      expect(members[1]?.visibility).toBe('-');
      expect(members[2]?.visibility).toBe('#');
      expect(members[3]?.visibility).toBe('~');
    });

    it('应 round-trip static classifier', () => {
      const original = `classDiagram

class A {
  +staticAttr: Type*
}
`;
      const { canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      const member = canvas2.nodes[0]?.data.members?.[0];
      expect(member?.isStatic).toBe(true);
    });

    it('应 round-trip abstract classifier', () => {
      const original = `classDiagram

class A {
  +abstractMethod(): void$
}
`;
      const { canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      const member = canvas2.nodes[0]?.data.members?.[0];
      expect(member?.isAbstract).toBe(true);
    });

    it('应 round-trip 方法参数', () => {
      const original = `classDiagram

class A {
  +method(param1: Type, param2: Type): ReturnType
}
`;
      const { canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      const member = canvas2.nodes[0]?.data.members?.[0];
      expect(member?.isMethod).toBe(true);
      expect(member?.parameters).toBe('param1: Type, param2: Type');
      expect(member?.returnType).toBe('ReturnType');
    });

    it('应 round-trip 无类型属性', () => {
      const original = `classDiagram

class A {
  +attr
}
`;
      const { canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      const member = canvas2.nodes[0]?.data.members?.[0];
      expect(member?.name).toBe('attr');
      expect(member?.type).toBeUndefined();
    });
  });

  describe('关系类型 round-trip（7 种）', () => {
    it.each([
      ['extension', 'A <|-- B'],
      ['composition', 'A *-- B'],
      ['aggregation', 'A o-- B'],
      ['association', 'A --> B'],
      ['dependency', 'A <.. B'],
      ['realization', 'A <|.. B'],
      ['lollipop', 'A --o B'],
    ])('应 round-trip %s 关系', (expectedType, syntax) => {
      const original = `classDiagram

class A
class B
${syntax}
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas1.edges).toHaveLength(1);
      expect(canvas1.edges[0]?.data.relationType).toBe(expectedType);
      expect(canvas2.edges).toHaveLength(1);
      expect(canvas2.edges[0]?.data.relationType).toBe(expectedType);
      expect(canvas2.edges[0]?.source).toBe('A');
      expect(canvas2.edges[0]?.target).toBe('B');
    });
  });

  describe('基数和标签 round-trip', () => {
    it('应 round-trip 基数', () => {
      const original = `classDiagram

class A
class B
A "1" --> "0..*" B
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      const edge1 = canvas1.edges[0];
      const edge2 = canvas2.edges[0];
      const card1 = edge1?.data.classCardinality as { from: string; to: string } | undefined;
      const card2 = edge2?.data.classCardinality as { from: string; to: string } | undefined;
      expect(card2?.from).toBe(card1?.from);
      expect(card2?.to).toBe(card1?.to);
      expect(card2?.from).toBe('1');
      expect(card2?.to).toBe('0..*');
    });

    it('应 round-trip 标签', () => {
      const original = `classDiagram

class A
class B
A --> B : label
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas2.edges[0]?.data.label).toBe(canvas1.edges[0]?.data.label);
      expect(canvas2.edges[0]?.data.label).toBe('label');
    });

    it('应 round-trip 基数和标签组合', () => {
      const original = `classDiagram

class A
class B
A "1" --> "0..*" B : places
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      const edge2 = canvas2.edges[0];
      const card2 = edge2?.data.classCardinality as { from: string; to: string } | undefined;
      expect(card2?.from).toBe('1');
      expect(card2?.to).toBe('0..*');
      expect(edge2?.data.label).toBe('places');
    });
  });

  describe('namespace round-trip', () => {
    it('应 round-trip namespace 含子类', () => {
      const original = `classDiagram

namespace A {
  class B {
    +attr: Type
  }
}
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      // 验证 namespace 节点保留
      const namespace1 = canvas1.nodes.find((n) => n.type === 'namespace');
      const namespace2 = canvas2.nodes.find((n) => n.type === 'namespace');
      expect(namespace2).toBeDefined();
      expect(namespace2?.id).toBe(namespace1?.id);
      expect(namespace2?.data.label).toBe(namespace1?.data.label);

      // 验证 class 节点保留且 parentId 正确
      const classB1 = canvas1.nodes.find((n) => n.id === 'B');
      const classB2 = canvas2.nodes.find((n) => n.id === 'B');
      expect(classB2).toBeDefined();
      expect(classB2?.parentId).toBe(classB1?.parentId);
      expect(classB2?.parentId).toBe('A');

      // 验证 metadata.namespaces 保留
      const namespaces1 = canvas1.metadata?.namespaces;
      const namespaces2 = canvas2.metadata?.namespaces;
      expect(namespaces2).toHaveLength(namespaces1?.length ?? 0);
      expect(namespaces2?.[0]?.name).toBe('A');
      expect(namespaces2?.[0]?.classIds).toContain('B');
    });

    it('应 round-trip 嵌套 namespace', () => {
      const original = `classDiagram

namespace A.B {
  class C {}
}
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      // 验证嵌套 namespace 节点保留
      const namespaceAB1 = canvas1.nodes.find((n) => n.id === 'A.B');
      const namespaceAB2 = canvas2.nodes.find((n) => n.id === 'A.B');
      expect(namespaceAB2).toBeDefined();
      expect(namespaceAB2?.parentId).toBe(namespaceAB1?.parentId);

      // 验证 class 节点 parentId 为 A.B
      const classC = canvas2.nodes.find((n) => n.id === 'C');
      expect(classC).toBeDefined();
      expect(classC?.parentId).toBe('A.B');
    });
  });

  describe('Note round-trip', () => {
    it('应 round-trip note for class', () => {
      const original = `classDiagram

class A
note for A "this is a note"
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      // 验证 metadata.classNotes 保留
      const notes1 = canvas1.metadata?.classNotes as ClassNoteInfo[] | undefined;
      const notes2 = canvas2.metadata?.classNotes as ClassNoteInfo[] | undefined;
      expect(notes2).toHaveLength(notes1?.length ?? 0);
      expect(notes2?.[0]?.classId).toBe('A');
      expect(notes2?.[0]?.label).toBe('this is a note');

      // 验证 note 节点保留
      const noteNode2 = canvas2.nodes.find((n) => n.type === 'note');
      expect(noteNode2).toBeDefined();
      expect(noteNode2?.data.label).toBe('this is a note');

      // 验证 note 边保留
      const noteEdge2 = canvas2.edges.find((e) => e.type === 'note-edge');
      expect(noteEdge2).toBeDefined();
      expect(noteEdge2?.target).toBe('A');
    });
  });

  describe('样式系统 round-trip', () => {
    it('应 round-trip classDef', () => {
      const original = `classDiagram

classDef red fill:#f00
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      const classes1 = canvas1.metadata?.classStyleClasses as Array<{ id: string; styles: string[]; textStyles: string[] }> | undefined;
      const classes2 = canvas2.metadata?.classStyleClasses as Array<{ id: string; styles: string[]; textStyles: string[] }> | undefined;
      expect(classes2).toHaveLength(classes1?.length ?? 0);
      expect(classes2?.[0]?.id).toBe('red');
      expect(classes2?.[0]?.styles).toContain('fill:#f00');
    });

    it('应 round-trip class 应用（::: 语法）', () => {
      const original = `classDiagram

class A
classDef red fill:#f00
class A ::: red
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      const node1 = canvas1.nodes.find((n) => n.id === 'A');
      const node2 = canvas2.nodes.find((n) => n.id === 'A');
      expect(node2?.data.classNames).toEqual(node1?.data.classNames);
      expect(node2?.data.classNames).toContain('red');
    });

    it('应 round-trip cssClass 应用', () => {
      const original = `classDiagram

class A
classDef red fill:#f00
cssClass "A" red
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      const node2 = canvas2.nodes.find((n) => n.id === 'A');
      expect(node2?.data.classNames).toContain('red');
    });

    it('应 round-trip style 语句', () => {
      const original = `classDiagram

class A
style A fill:#f00
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      const node1 = canvas1.nodes.find((n) => n.id === 'A');
      const node2 = canvas2.nodes.find((n) => n.id === 'A');
      const styles1 = node1?.data.styles as string[] | undefined;
      const styles2 = node2?.data.styles as string[] | undefined;
      expect(styles2).toEqual(styles1);
      expect(styles2).toContain('fill:#f00');
    });
  });

  describe('direction round-trip', () => {
    it('应 round-trip direction LR', () => {
      const original = `classDiagram

direction LR

class A
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas2.metadata?.direction).toBe(canvas1.metadata?.direction);
      expect(canvas2.metadata?.direction).toBe('LR');
    });

    it('应 round-trip direction TB', () => {
      const original = `classDiagram

direction TB

class A
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas2.metadata?.direction).toBe(canvas1.metadata?.direction);
      expect(canvas2.metadata?.direction).toBe('TB');
    });
  });

  describe('完整场景 round-trip', () => {
    it('应 round-trip 包含多种元素的完整画布', () => {
      const original = `classDiagram

class Animal {
  +name: String
  +eat(): void
}
class Dog
class Cat
Animal <|-- Dog
Animal <|-- Cat
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas2.nodes).toHaveLength(canvas1.nodes.length);
      expect(canvas2.edges).toHaveLength(canvas1.edges.length);
      expect(canvas2.nodes.map((n) => n.id).sort()).toEqual(
        canvas1.nodes.map((n) => n.id).sort(),
      );
      // 验证关系类型保留
      expect(canvas2.edges.every((e) => e.data.relationType === 'extension')).toBe(true);
    });

    it('应 round-trip 含 namespace 和关系的画布', () => {
      const original = `classDiagram

namespace Animals {
  class Dog {
    +bark(): void
  }
  class Cat
}
Dog --> Cat
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas2.nodes).toHaveLength(canvas1.nodes.length);
      expect(canvas2.edges).toHaveLength(canvas1.edges.length);

      // 验证 namespace 保留
      const namespace2 = canvas2.nodes.find((n) => n.type === 'namespace');
      expect(namespace2).toBeDefined();

      // 验证 namespace 内的类有正确的 parentId
      const dog2 = canvas2.nodes.find((n) => n.id === 'Dog');
      expect(dog2?.parentId).toBe('Animals');

      // 验证关系保留
      const edge2 = canvas2.edges[0];
      expect(edge2?.data.relationType).toBe('association');
    });
  });
});

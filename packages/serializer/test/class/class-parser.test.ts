/**
 * class-parser 行为验证测试
 *
 * 验证 parseClass 的行为：
 *   - 类定义（基本类、带成员的类、stereotype、泛型）
 *   - 成员解析（visibility、static/abstract classifier、方法参数、属性）
 *   - 关系类型（7 种：extension/composition/aggregation/association/dependency/realization/lollipop）
 *   - 关系基数和标签
 *   - namespace（嵌套、点号命名空间）
 *   - Note 注释
 *   - 样式系统（classDef、class 应用、style）
 *   - 边界场景（非法语法）
 */
import { describe, it, expect } from 'vitest';
import { parseClassCode as parseClass } from '../../src/index.js';
import type { MermaidNode, MermaidEdge, ClassNoteInfo, ClassNamespaceInfo } from '../../src/types.js';

/** 从 canvas 中按 id 查找节点 */
function findNode(nodes: MermaidNode[], id: string): MermaidNode | undefined {
  return nodes.find((n) => n.id === id);
}

/** 从 canvas 中按 source+target 查找边 */
function findEdge(edges: MermaidEdge[], source: string, target: string): MermaidEdge | undefined {
  return edges.find((e) => e.source === source && e.target === target);
}

describe('ClassParser 行为验证', () => {
  describe('类定义', () => {
    it('should parse class definition', () => {
      const code = `classDiagram

class Animal
`;
      const result = parseClass(code);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.canvas.diagramType).toBe('classDiagram');
      expect(result.canvas.nodes).toHaveLength(1);

      const node = result.canvas.nodes[0];
      expect(node?.id).toBe('Animal');
      expect(node?.data.label).toBe('Animal');
      expect(node?.data.shape).toBe('class-box');
      expect(node?.type).toBe('class-box');
    });

    it('should parse class with members', () => {
      const code = `classDiagram

class Animal {
  +name: String
  -age: int
  +eat(): void
}
`;
      const result = parseClass(code);

      expect(result.success).toBe(true);
      expect(result.canvas.nodes).toHaveLength(1);

      const node = result.canvas.nodes[0];
      expect(node?.data.members).toHaveLength(3);

      // 属性 +name: String
      const attr1 = node?.data.members?.[0];
      expect(attr1?.name).toBe('name');
      expect(attr1?.type).toBe('String');
      expect(attr1?.visibility).toBe('+');
      expect(attr1?.isMethod).toBe(false);

      // 属性 -age: int
      const attr2 = node?.data.members?.[1];
      expect(attr2?.name).toBe('age');
      expect(attr2?.type).toBe('int');
      expect(attr2?.visibility).toBe('-');

      // 方法 +eat(): void
      const method = node?.data.members?.[2];
      expect(method?.name).toBe('eat');
      expect(method?.visibility).toBe('+');
      expect(method?.returnType).toBe('void');
      expect(method?.isMethod).toBe(true);
    });

    it('should parse stereotype interface', () => {
      const code = `classDiagram

class Shape {
  <<interface>>
  +draw(): void
}
`;
      const result = parseClass(code);

      expect(result.success).toBe(true);
      const node = result.canvas.nodes[0];
      expect(node?.data.stereotype).toBe('interface');
      expect(node?.data.annotations).toContain('interface');
    });

    it('should parse stereotype abstract', () => {
      const code = `classDiagram

class Animal {
  <<abstract>>
  +sound(): void
}
`;
      const result = parseClass(code);

      expect(result.success).toBe(true);
      const node = result.canvas.nodes[0];
      expect(node?.data.stereotype).toBe('abstract');
    });

    it('should parse stereotype enum', () => {
      const code = `classDiagram

class Color {
  <<enum>>
  RED
  GREEN
}
`;
      const result = parseClass(code);

      expect(result.success).toBe(true);
      const node = result.canvas.nodes[0];
      expect(node?.data.stereotype).toBe('enum');
    });

    it('should parse generics class', () => {
      const code = `classDiagram

class List~Item~ {
  +items: Item[]
}
`;
      const result = parseClass(code);

      expect(result.success).toBe(true);
      const node = result.canvas.nodes[0];
      expect(node?.id).toBe('List');
      expect(node?.data.label).toBe('List');
      expect(node?.data.generics).toBe('Item');
    });
  });

  describe('成员解析', () => {
    it('should parse visibility + (public)', () => {
      const code = `classDiagram

class A {
  +attr: Type
}
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);
      const member = result.canvas.nodes[0]?.data.members?.[0];
      expect(member?.visibility).toBe('+');
    });

    it('should parse visibility - (private)', () => {
      const code = `classDiagram

class A {
  -attr: Type
}
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);
      const member = result.canvas.nodes[0]?.data.members?.[0];
      expect(member?.visibility).toBe('-');
    });

    it('should parse visibility # (protected)', () => {
      const code = `classDiagram

class A {
  #attr: Type
}
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);
      const member = result.canvas.nodes[0]?.data.members?.[0];
      expect(member?.visibility).toBe('#');
    });

    it('should parse visibility ~ (package)', () => {
      const code = `classDiagram

class A {
  ~attr: Type
}
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);
      const member = result.canvas.nodes[0]?.data.members?.[0];
      expect(member?.visibility).toBe('~');
    });

    it('should parse static classifier *', () => {
      const code = `classDiagram

class A {
  +staticAttr: Type*
}
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);
      const member = result.canvas.nodes[0]?.data.members?.[0];
      expect(member?.isStatic).toBe(true);
    });

    it('should parse abstract classifier $', () => {
      const code = `classDiagram

class A {
  +abstractMethod(): void$
}
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);
      const member = result.canvas.nodes[0]?.data.members?.[0];
      expect(member?.isAbstract).toBe(true);
    });

    it('should parse method with parameters', () => {
      const code = `classDiagram

class A {
  +method(param1: Type, param2: Type): ReturnType
}
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);
      const member = result.canvas.nodes[0]?.data.members?.[0];
      expect(member?.isMethod).toBe(true);
      expect(member?.name).toBe('method');
      expect(member?.parameters).toBe('param1: Type, param2: Type');
      expect(member?.returnType).toBe('ReturnType');
    });

    it('should parse attribute without type', () => {
      const code = `classDiagram

class A {
  +attr
}
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);
      const member = result.canvas.nodes[0]?.data.members?.[0];
      expect(member?.name).toBe('attr');
      expect(member?.type).toBeUndefined();
    });
  });

  describe('关系类型（7 种）', () => {
    it('should parse extension relation <|--', () => {
      const code = `classDiagram

class A
class B
A <|-- B
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);
      expect(result.canvas.edges).toHaveLength(1);
      const edge = result.canvas.edges[0];
      expect(edge?.data.relationType).toBe('extension');
      expect(edge?.source).toBe('A');
      expect(edge?.target).toBe('B');
    });

    it('should parse composition relation *--', () => {
      const code = `classDiagram

class A
class B
A *-- B
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);
      const edge = result.canvas.edges[0];
      expect(edge?.data.relationType).toBe('composition');
    });

    it('should parse aggregation relation o--', () => {
      const code = `classDiagram

class A
class B
A o-- B
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);
      const edge = result.canvas.edges[0];
      expect(edge?.data.relationType).toBe('aggregation');
    });

    it('should parse association relation -->', () => {
      const code = `classDiagram

class A
class B
A --> B
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);
      const edge = result.canvas.edges[0];
      expect(edge?.data.relationType).toBe('association');
    });

    it('should parse dependency relation <..', () => {
      const code = `classDiagram

class A
class B
A <.. B
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);
      const edge = result.canvas.edges[0];
      expect(edge?.data.relationType).toBe('dependency');
      expect(edge?.data.lineType).toBe('dotted');
    });

    it('should parse realization relation <|..', () => {
      const code = `classDiagram

class A
class B
A <|.. B
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);
      const edge = result.canvas.edges[0];
      expect(edge?.data.relationType).toBe('realization');
      expect(edge?.data.lineType).toBe('dotted');
    });

    it('should parse lollipop relation --o', () => {
      const code = `classDiagram

class A
class B
A --o B
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);
      const edge = result.canvas.edges[0];
      expect(edge?.data.relationType).toBe('lollipop');
    });
  });

  describe('关系基数和标签', () => {
    it('should parse cardinality', () => {
      const code = `classDiagram

class A
class B
A "1" --> "0..*" B
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);
      const edge = result.canvas.edges[0];
      const cardinality = edge?.data.classCardinality as { from: string; to: string } | undefined;
      expect(cardinality).toBeDefined();
      expect(cardinality?.from).toBe('1');
      expect(cardinality?.to).toBe('0..*');
    });

    it('should parse label', () => {
      const code = `classDiagram

class A
class B
A --> B : label
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);
      const edge = result.canvas.edges[0];
      expect(edge?.data.label).toBe('label');
      expect(edge?.data.relationLabel).toBe('label');
    });

    it('should parse cardinality and label', () => {
      const code = `classDiagram

class A
class B
A "1" --> "0..*" B : places
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);
      const edge = result.canvas.edges[0];
      const cardinality = edge?.data.classCardinality as { from: string; to: string } | undefined;
      expect(cardinality?.from).toBe('1');
      expect(cardinality?.to).toBe('0..*');
      expect(edge?.data.label).toBe('places');
    });
  });

  describe('namespace', () => {
    it('should parse namespace', () => {
      const code = `classDiagram

namespace A {
  class B {}
}
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);

      // 验证 namespace 节点存在
      const namespaceNode = findNode(result.canvas.nodes, 'A');
      expect(namespaceNode).toBeDefined();
      expect(namespaceNode?.type).toBe('namespace');

      // 验证 class 节点存在且 parentId 为 namespace
      const classNode = findNode(result.canvas.nodes, 'B');
      expect(classNode).toBeDefined();
      expect(classNode?.parentId).toBe('A');

      // 验证 metadata.namespaces
      const namespaces = result.canvas.metadata?.namespaces as ClassNamespaceInfo[] | undefined;
      expect(namespaces).toHaveLength(1);
      expect(namespaces?.[0]?.name).toBe('A');
      expect(namespaces?.[0]?.classIds).toContain('B');
    });

    it('should parse dotted namespace', () => {
      const code = `classDiagram

namespace A.B {
  class C {}
}
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);

      // 验证嵌套 namespace 节点存在
      const namespaceA = findNode(result.canvas.nodes, 'A');
      expect(namespaceA).toBeDefined();
      const namespaceAB = findNode(result.canvas.nodes, 'A.B');
      expect(namespaceAB).toBeDefined();
      expect(namespaceAB?.parentId).toBe('A');

      // 验证 class 节点存在且 parentId 为 A.B
      const classNode = findNode(result.canvas.nodes, 'C');
      expect(classNode).toBeDefined();
      expect(classNode?.parentId).toBe('A.B');
    });
  });

  describe('Note', () => {
    it('should parse note for class', () => {
      const code = `classDiagram

class A
note for A "this is a note"
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);

      // 验证 metadata.classNotes
      const notes = result.canvas.metadata?.classNotes as ClassNoteInfo[] | undefined;
      expect(notes).toBeDefined();
      expect(notes).toHaveLength(1);
      expect(notes?.[0]?.classId).toBe('A');
      expect(notes?.[0]?.label).toBe('this is a note');

      // 验证 note 节点存在
      const noteNode = result.canvas.nodes.find((n) => n.type === 'note');
      expect(noteNode).toBeDefined();
      expect(noteNode?.data.label).toBe('this is a note');

      // 验证 note 边存在（note → class）
      const noteEdge = result.canvas.edges.find((e) => e.type === 'note-edge');
      expect(noteEdge).toBeDefined();
      expect(noteEdge?.source).toBe(noteNode?.id);
      expect(noteEdge?.target).toBe('A');
    });
  });

  describe('样式系统', () => {
    it('should parse classDef', () => {
      const code = `classDiagram

classDef red fill:#f00
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);

      const styleClasses = result.canvas.metadata?.classStyleClasses as Array<{ id: string; styles: string[]; textStyles: string[] }> | undefined;
      expect(styleClasses).toBeDefined();
      expect(styleClasses).toHaveLength(1);
      expect(styleClasses?.[0]?.id).toBe('red');
      expect(styleClasses?.[0]?.styles).toContain('fill:#f00');
    });

    it('should parse class application with ::: separator', () => {
      const code = `classDiagram

class A
classDef red fill:#f00
class A ::: red
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);

      const node = findNode(result.canvas.nodes, 'A');
      expect(node?.data.classNames).toContain('red');
    });

    it('should parse cssClass application', () => {
      const code = `classDiagram

class A
classDef red fill:#f00
cssClass "A" red
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);

      const node = findNode(result.canvas.nodes, 'A');
      expect(node?.data.classNames).toContain('red');
    });

    it('should parse style statement', () => {
      const code = `classDiagram

class A
style A fill:#f00
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);

      const node = findNode(result.canvas.nodes, 'A');
      const styles = node?.data.styles as string[] | undefined;
      expect(styles).toBeDefined();
      expect(styles).toContain('fill:#f00');
    });
  });

  describe('direction', () => {
    it('should parse direction LR', () => {
      const code = `classDiagram

direction LR

class A
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);
      expect(result.canvas.metadata?.direction).toBe('LR');
    });

    it('should parse direction TB', () => {
      const code = `classDiagram

direction TB

class A
`;
      const result = parseClass(code);
      expect(result.success).toBe(true);
      expect(result.canvas.metadata?.direction).toBe('TB');
    });
  });

  describe('边界场景', () => {
    it('should return success=false for invalid syntax', () => {
      const code = `classDiagram

@@@invalid@@@
`;
      const result = parseClass(code);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.canvas.diagramType).toBe('classDiagram');
      expect(result.canvas.nodes).toHaveLength(0);
      expect(result.canvas.edges).toHaveLength(0);
    });

    it('should parse multiple classes and relations', () => {
      const code = `classDiagram

class Animal {
  +name: String
  +eat(): void
}
class Dog
class Cat
Animal <|-- Dog
Animal <|-- Cat
`;
      const result = parseClass(code);

      expect(result.success).toBe(true);
      expect(result.canvas.nodes).toHaveLength(3);
      expect(result.canvas.edges).toHaveLength(2);

      const animal = findNode(result.canvas.nodes, 'Animal');
      expect(animal?.data.members).toHaveLength(2);

      const edges = result.canvas.edges;
      expect(edges.every((e) => e.data.relationType === 'extension')).toBe(true);
    });
  });
});

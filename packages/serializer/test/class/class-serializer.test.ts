/**
 * class-serializer 行为验证测试
 *
 * 验证 serializeClass 的行为：
 *   - 基本序列化（空画布、类节点、stereotype、泛型）
 *   - 成员序列化（visibility、static/abstract、方法参数、属性）
 *   - 关系序列化（7 种关系类型）
 *   - 基数和标签序列化
 *   - namespace 序列化（含嵌套）
 *   - Note 序列化
 *   - 样式系统（classDef、class 应用、style）
 *   - direction 序列化
 *   - 边界场景（非 classDiagram 类型）
 */
import { describe, it, expect } from 'vitest';
import { serializeClass } from '../../src/serializer/class/class-serializer.js';
import type {
  GraphCanvasState,
  MermaidNode,
  MermaidEdge,
  NodeMember,
  ClassRelationType,
  ClassLineType,
  MermaidNodeData,
  MermaidEdgeData,
} from '../../src/types.js';

// ============================================================
// 辅助函数
// ============================================================

/** 创建 class CanvasState */
function createClassCanvas(
  nodes: MermaidNode[] = [],
  edges: MermaidEdge[] = [],
  metadata: Record<string, unknown> = {},
  direction?: string,
): GraphCanvasState {
  return {
    diagramType: 'classDiagram',
    nodes,
    edges,
    ...(direction ? { direction: direction as GraphCanvasState['direction'] } : {}),
    metadata,
  };
}

/** 创建类节点 */
function createClassNode(
  id: string,
  options: {
    label?: string;
    members?: NodeMember[];
    stereotype?: string;
    annotations?: string[];
    generics?: string;
    classNames?: string[];
    styles?: string[];
    parentId?: string;
  } = {},
): MermaidNode {
  const {
    label,
    members,
    stereotype,
    annotations,
    generics,
    classNames,
    styles,
    parentId,
  } = options;
  const data: MermaidNodeData = {
    label: label ?? id,
    shape: 'class-box',
    ...(members ? { members } : {}),
    ...(stereotype ? { stereotype } : {}),
    ...(annotations ? { annotations } : {}),
    ...(generics ? { generics } : {}),
    ...(classNames ? { classNames } : {}),
    ...(styles ? { styles } : {}),
  };
  return {
    id,
    type: 'class-box',
    position: { x: 0, y: 0 },
    data,
    ...(parentId ? { parentId, extent: 'parent' as const } : {}),
  };
}

/** 创建 namespace 节点 */
function createNamespaceNode(id: string, label?: string, parentId?: string): MermaidNode {
  return {
    id,
    type: 'namespace',
    position: { x: 0, y: 0 },
    data: {
      label: label ?? id,
      shape: 'rect',
    },
    ...(parentId ? { parentId, extent: 'parent' as const } : {}),
  };
}

/** 创建关系边 */
function createRelationEdge(
  id: string,
  source: string,
  target: string,
  relationType: ClassRelationType,
  options: {
    lineType?: ClassLineType;
    label?: string;
    cardinality?: { from: string; to: string };
  } = {},
): MermaidEdge {
  const { lineType = 'line', label, cardinality } = options;
  const data: MermaidEdgeData = {
    edgeStyle: lineType === 'dotted' ? 'dotted' : 'line',
    relationType,
    lineType,
    ...(label ? { label, relationLabel: label } : {}),
    ...(cardinality ? { classCardinality: cardinality } : {}),
  };
  return {
    id,
    source,
    target,
    type: 'class-relation',
    data,
  };
}

/** 创建成员 */
function createMember(
  name: string,
  options: {
    visibility?: '+' | '-' | '#' | '~' | '';
    isMethod?: boolean;
    type?: string;
    returnType?: string;
    parameters?: string;
    isStatic?: boolean;
    isAbstract?: boolean;
  } = {},
): NodeMember {
  const {
    visibility = '+',
    isMethod = false,
    type,
    returnType,
    parameters,
    isStatic = false,
    isAbstract = false,
  } = options;
  return {
    name,
    visibility,
    isStatic,
    isAbstract,
    isMethod,
    ...(type !== undefined ? { type } : {}),
    ...(returnType !== undefined ? { returnType } : {}),
    ...(parameters !== undefined ? { parameters } : {}),
  };
}

// ============================================================
// 测试用例
// ============================================================

describe('ClassSerializer 行为验证', () => {
  describe('基本序列化', () => {
    it('应序列化空画布为 classDiagram 头', () => {
      const canvas = createClassCanvas();
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toBe('classDiagram\n');
    });

    it('应拒绝非 classDiagram 类型', () => {
      const canvas = {
        diagramType: 'flowchart' as const,
        nodes: [],
        edges: [],
        direction: 'TB' as const,
      };
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(1);
      expect(result.mermaid).toBe('');
    });

    it('应序列化无成员的类节点为单行声明', () => {
      const canvas = createClassCanvas([createClassNode('Animal')]);
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('class Animal');
    });

    it('应序列化带成员的类节点为多行块', () => {
      const canvas = createClassCanvas([
        createClassNode('Animal', {
          members: [
            createMember('name', { visibility: '+', type: 'String' }),
            createMember('age', { visibility: '-', type: 'int' }),
            createMember('eat', { visibility: '+', isMethod: true, returnType: 'void' }),
          ],
        }),
      ]);
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('class Animal {');
      expect(result.mermaid).toContain('+name: String');
      expect(result.mermaid).toContain('-age: int');
      expect(result.mermaid).toContain('+eat(): void');
      expect(result.mermaid).toContain('}');
    });
  });

  describe('stereotype 序列化', () => {
    it('应序列化 interface stereotype', () => {
      const canvas = createClassCanvas([
        createClassNode('Shape', {
          stereotype: 'interface',
          annotations: ['interface'],
          members: [createMember('draw', { visibility: '+', isMethod: true, returnType: 'void' })],
        }),
      ]);
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('<<interface>>');
      expect(result.mermaid).toContain('+draw(): void');
    });

    it('应序列化 abstract stereotype', () => {
      const canvas = createClassCanvas([
        createClassNode('Animal', {
          stereotype: 'abstract',
          annotations: ['abstract'],
          members: [createMember('sound', { visibility: '+', isMethod: true, returnType: 'void' })],
        }),
      ]);
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('<<abstract>>');
    });

    it('应序列化 enum stereotype', () => {
      const canvas = createClassCanvas([
        createClassNode('Color', {
          stereotype: 'enum',
          annotations: ['enum'],
        }),
      ]);
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('<<enum>>');
    });
  });

  describe('泛型序列化', () => {
    it('应序列化泛型类为 List~Item~ 语法', () => {
      const canvas = createClassCanvas([
        createClassNode('List', {
          generics: 'Item',
          members: [createMember('items', { visibility: '+', type: 'Item[]' })],
        }),
      ]);
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('class List~Item~');
    });
  });

  describe('成员序列化', () => {
    it('应序列化 + visibility', () => {
      const canvas = createClassCanvas([
        createClassNode('A', {
          members: [createMember('attr', { visibility: '+', type: 'Type' })],
        }),
      ]);
      const result = serializeClass(canvas);

      expect(result.mermaid).toContain('+attr: Type');
    });

    it('应序列化 - visibility', () => {
      const canvas = createClassCanvas([
        createClassNode('A', {
          members: [createMember('attr', { visibility: '-', type: 'Type' })],
        }),
      ]);
      const result = serializeClass(canvas);

      expect(result.mermaid).toContain('-attr: Type');
    });

    it('应序列化 # visibility', () => {
      const canvas = createClassCanvas([
        createClassNode('A', {
          members: [createMember('attr', { visibility: '#', type: 'Type' })],
        }),
      ]);
      const result = serializeClass(canvas);

      expect(result.mermaid).toContain('#attr: Type');
    });

    it('应序列化 ~ visibility', () => {
      const canvas = createClassCanvas([
        createClassNode('A', {
          members: [createMember('attr', { visibility: '~', type: 'Type' })],
        }),
      ]);
      const result = serializeClass(canvas);

      expect(result.mermaid).toContain('~attr: Type');
    });

    it('应序列化 static classifier *', () => {
      const canvas = createClassCanvas([
        createClassNode('A', {
          members: [createMember('staticAttr', { visibility: '+', type: 'Type', isStatic: true })],
        }),
      ]);
      const result = serializeClass(canvas);

      expect(result.mermaid).toContain('+staticAttr: Type*');
    });

    it('应序列化 abstract classifier $', () => {
      const canvas = createClassCanvas([
        createClassNode('A', {
          members: [createMember('abstractMethod', {
            visibility: '+',
            isMethod: true,
            returnType: 'void',
            isAbstract: true,
          })],
        }),
      ]);
      const result = serializeClass(canvas);

      expect(result.mermaid).toContain('+abstractMethod(): void$');
    });

    it('应序列化方法参数', () => {
      const canvas = createClassCanvas([
        createClassNode('A', {
          members: [createMember('method', {
            visibility: '+',
            isMethod: true,
            parameters: 'param1: Type, param2: Type',
            returnType: 'ReturnType',
          })],
        }),
      ]);
      const result = serializeClass(canvas);

      expect(result.mermaid).toContain('+method(param1: Type, param2: Type): ReturnType');
    });

    it('应序列化无类型属性', () => {
      const canvas = createClassCanvas([
        createClassNode('A', {
          members: [createMember('attr', { visibility: '+', type: undefined })],
        }),
      ]);
      const result = serializeClass(canvas);

      expect(result.mermaid).toContain('+attr');
      expect(result.mermaid).not.toContain('+attr:');
    });
  });

  describe('关系序列化（7 种类型）', () => {
    it('应序列化 extension 关系为 <|--', () => {
      const canvas = createClassCanvas(
        [createClassNode('A'), createClassNode('B')],
        [createRelationEdge('e1', 'A', 'B', 'extension')],
      );
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('A <|-- B');
    });

    it('应序列化 composition 关系为 *--', () => {
      const canvas = createClassCanvas(
        [createClassNode('A'), createClassNode('B')],
        [createRelationEdge('e1', 'A', 'B', 'composition')],
      );
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('A *-- B');
    });

    it('应序列化 aggregation 关系为 o--', () => {
      const canvas = createClassCanvas(
        [createClassNode('A'), createClassNode('B')],
        [createRelationEdge('e1', 'A', 'B', 'aggregation')],
      );
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('A o-- B');
    });

    it('应序列化 association 关系为 -->', () => {
      const canvas = createClassCanvas(
        [createClassNode('A'), createClassNode('B')],
        [createRelationEdge('e1', 'A', 'B', 'association')],
      );
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('A --> B');
    });

    it('应序列化 dependency 关系为 <..', () => {
      const canvas = createClassCanvas(
        [createClassNode('A'), createClassNode('B')],
        [createRelationEdge('e1', 'A', 'B', 'dependency', { lineType: 'dotted' })],
      );
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('A <.. B');
    });

    it('应序列化 realization 关系为 <|..', () => {
      const canvas = createClassCanvas(
        [createClassNode('A'), createClassNode('B')],
        [createRelationEdge('e1', 'A', 'B', 'realization', { lineType: 'dotted' })],
      );
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('A <|.. B');
    });

    it('应序列化 lollipop 关系为 --o', () => {
      const canvas = createClassCanvas(
        [createClassNode('A'), createClassNode('B')],
        [createRelationEdge('e1', 'A', 'B', 'lollipop')],
      );
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('A --o B');
    });
  });

  describe('基数和标签序列化', () => {
    it('应序列化基数', () => {
      const canvas = createClassCanvas(
        [createClassNode('A'), createClassNode('B')],
        [createRelationEdge('e1', 'A', 'B', 'association', {
          cardinality: { from: '1', to: '0..*' },
        })],
      );
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('"1"');
      expect(result.mermaid).toContain('"0..*"');
      expect(result.mermaid).toContain('A "1" --> "0..*" B');
    });

    it('应序列化标签', () => {
      const canvas = createClassCanvas(
        [createClassNode('A'), createClassNode('B')],
        [createRelationEdge('e1', 'A', 'B', 'association', { label: 'places' })],
      );
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('A --> B : places');
    });

    it('应序列化基数和标签', () => {
      const canvas = createClassCanvas(
        [createClassNode('A'), createClassNode('B')],
        [createRelationEdge('e1', 'A', 'B', 'association', {
          cardinality: { from: '1', to: '0..*' },
          label: 'places',
        })],
      );
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('A "1" --> "0..*" B : places');
    });
  });

  describe('namespace 序列化', () => {
    it('应序列化 namespace 含子类', () => {
      const canvas = createClassCanvas([
        createNamespaceNode('A'),
        createClassNode('B', {
          members: [createMember('attr', { visibility: '+', type: 'Type' })],
          parentId: 'A',
        }),
      ]);
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('namespace A {');
      expect(result.mermaid).toContain('class B {');
      expect(result.mermaid).toContain('+attr: Type');
      expect(result.mermaid).toContain('}');
    });

    it('应序列化嵌套 namespace', () => {
      const canvas = createClassCanvas([
        createNamespaceNode('A'),
        createNamespaceNode('A.B', 'A.B', 'A'),
        createClassNode('C', { parentId: 'A.B' }),
      ]);
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('namespace A {');
      expect(result.mermaid).toContain('namespace A.B {');
      expect(result.mermaid).toContain('class C');
    });
  });

  describe('Note 序列化', () => {
    it('应从 metadata.classNotes 序列化 note', () => {
      const canvas = createClassCanvas(
        [createClassNode('A')],
        [],
        {
          classNotes: [{
            classId: 'A',
            position: 'top',
            label: 'this is a note',
          }],
        },
      );
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('note for A "this is a note"');
    });

    it('应转义 note 文本中的双引号', () => {
      const canvas = createClassCanvas(
        [createClassNode('A')],
        [],
        {
          classNotes: [{
            classId: 'A',
            position: 'top',
            label: 'say "hello"',
          }],
        },
      );
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('note for A "say \\"hello\\""');
    });

    it('应从 note 节点和 note 边推断序列化', () => {
      const canvas = createClassCanvas(
        [
          createClassNode('A'),
          {
            id: 'note-1',
            type: 'note',
            position: { x: 0, y: 0 },
            data: { label: 'inferred note', shape: 'note' },
          },
        ],
        [
          {
            id: 'edge-note-1-A',
            source: 'note-1',
            target: 'A',
            type: 'note-edge',
            data: { edgeStyle: 'dotted' },
          },
        ],
      );
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('note for A "inferred note"');
    });
  });

  describe('样式系统序列化', () => {
    it('应序列化 classDef 语句', () => {
      const canvas = createClassCanvas(
        [],
        [],
        {
          classStyleClasses: [{
            id: 'red',
            styles: ['fill:#f00'],
            textStyles: [],
          }],
        },
      );
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('classDef red fill:#f00');
    });

    it('应序列化 classDef 含多个样式', () => {
      const canvas = createClassCanvas(
        [],
        [],
        {
          classStyleClasses: [{
            id: 'red',
            styles: ['fill:#f00', 'stroke:#900'],
            textStyles: [],
          }],
        },
      );
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('classDef red fill:#f00,stroke:#900');
    });

    it('应序列化 class 应用语句', () => {
      const canvas = createClassCanvas([
        createClassNode('A', { classNames: ['red'] }),
      ]);
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('class A ::: red');
    });

    it('应序列化多个 class 应用', () => {
      const canvas = createClassCanvas([
        createClassNode('A', { classNames: ['red', 'bold'] }),
      ]);
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('class A ::: red');
      expect(result.mermaid).toContain('class A ::: bold');
    });

    it('应序列化 style 语句', () => {
      const canvas = createClassCanvas([
        createClassNode('A', { styles: ['fill:#f00'] }),
      ]);
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('style A fill:#f00');
    });

    it('应序列化 style 含多个样式', () => {
      const canvas = createClassCanvas([
        createClassNode('A', { styles: ['fill:#f00', 'stroke:#900'] }),
      ]);
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('style A fill:#f00,stroke:#900');
    });
  });

  describe('direction 序列化', () => {
    it('应从 metadata.direction 序列化 direction', () => {
      const canvas = createClassCanvas(
        [createClassNode('A')],
        [],
        { direction: 'LR' },
      );
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('direction LR');
    });

    it('应从 canvas.direction 序列化 direction', () => {
      const canvas = createClassCanvas(
        [createClassNode('A')],
        [],
        {},
        'TB',
      );
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('direction TB');
    });
  });

  describe('无障碍信息序列化', () => {
    it('应序列化 accTitle 和 accDescription', () => {
      const canvas = createClassCanvas(
        [createClassNode('A')],
        [],
        {
          accTitle: 'My Title',
          accDescription: 'My Description',
        },
      );
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('accTitle: My Title');
      expect(result.mermaid).toContain('accDescr: My Description');
    });
  });

  describe('完整画布序列化', () => {
    it('应序列化包含多种元素的完整画布', () => {
      const canvas = createClassCanvas(
        [
          createClassNode('Animal', {
            members: [
              createMember('name', { visibility: '+', type: 'String' }),
              createMember('eat', { visibility: '+', isMethod: true, returnType: 'void' }),
            ],
          }),
          createClassNode('Dog'),
          createClassNode('Cat'),
        ],
        [
          createRelationEdge('e1', 'Animal', 'Dog', 'extension'),
          createRelationEdge('e2', 'Animal', 'Cat', 'extension'),
        ],
        { direction: 'LR' },
      );
      const result = serializeClass(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('classDiagram');
      expect(result.mermaid).toContain('direction LR');
      expect(result.mermaid).toContain('class Animal {');
      expect(result.mermaid).toContain('+name: String');
      expect(result.mermaid).toContain('+eat(): void');
      expect(result.mermaid).toContain('class Dog');
      expect(result.mermaid).toContain('class Cat');
      expect(result.mermaid).toContain('Animal <|-- Dog');
      expect(result.mermaid).toContain('Animal <|-- Cat');
    });
  });
});

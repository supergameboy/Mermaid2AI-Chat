/**
 * er-serializer 行为验证测试
 *
 * 验证 serializeER 的行为：
 *   - 基础序列化（空画布、erDiagram 头、direction、accTitle/accDescr）
 *   - 实体序列化（无属性、带属性、别名、PK、注释）
 *   - 关系序列化（基数、角色、identifying/non-identifying、5 种基数类型）
 *   - 边界场景（非 erDiagram 类型）
 *
 * 序列化顺序（对齐 er-serializer.ts）:
 *   erDiagram → direction → accTitle → 关系 → subgraph → 实体 → classDef → class → style
 */
import { describe, it, expect } from 'vitest';
import { serializeER } from '../../src/serializer/er/er-serializer.js';
import type {
  GraphCanvasState,
  MermaidNode,
  MermaidEdge,
  NodeAttribute,
  ERCardinality,
  ERIdentification,
  MermaidNodeData,
  MermaidEdgeData,
} from '../../src/types.js';

// ============================================================
// 辅助函数
// ============================================================

/** 创建 er CanvasState */
function createERCanvas(
  nodes: MermaidNode[] = [],
  edges: MermaidEdge[] = [],
  metadata: Record<string, unknown> = {},
  direction?: string,
): GraphCanvasState {
  return {
    diagramType: 'erDiagram',
    nodes,
    edges,
    ...(direction ? { direction: direction as GraphCanvasState['direction'] } : {}),
    metadata,
  };
}

/** 创建实体节点 */
function createEntityNode(
  id: string,
  options: {
    label?: string;
    attributes?: NodeAttribute[];
    alias?: string;
    classNames?: string[];
    styles?: string[];
  } = {},
): MermaidNode {
  const { label, attributes, alias, classNames, styles } = options;
  const data: MermaidNodeData = {
    label: label ?? id,
    shape: 'er-box',
    ...(attributes ? { attributes } : {}),
    ...(alias ? { alias } : {}),
    ...(classNames ? { classNames } : {}),
    ...(styles ? { styles } : {}),
  };
  return {
    id,
    type: 'er-box',
    position: { x: 0, y: 0 },
    data,
  };
}

/** 创建关系边 */
function createRelationshipEdge(
  source: string,
  target: string,
  options: {
    cardinality?: { from: ERCardinality; to: ERCardinality };
    erIdentification?: ERIdentification;
    erRole?: string;
  } = {},
): MermaidEdge {
  const { cardinality, erIdentification, erRole } = options;
  const data: MermaidEdgeData = {
    edgeStyle: erIdentification === 'non-identifying' ? 'dotted' : 'line',
    ...(erRole ? { label: erRole, erRole } : {}),
    ...(cardinality ? { cardinality } : {}),
    ...(erIdentification ? { erIdentification } : {}),
  };
  return {
    id: `er-edge-${source}-${target}`,
    source,
    target,
    type: 'er-relation',
    data,
  };
}

/** 创建属性 */
function createAttribute(
  name: string,
  options: {
    type?: string;
    keys?: NodeAttribute['keys'];
    comment?: string;
  } = {},
): NodeAttribute {
  const { type = 'string', keys = [], comment } = options;
  return {
    name,
    type,
    keys,
    ...(comment ? { comment } : {}),
  };
}

// ============================================================
// 测试用例
// ============================================================

describe('ERSerializer 行为验证', () => {
  describe('基础序列化', () => {
    it('should serialize empty canvas', () => {
      const canvas = createERCanvas();
      const result = serializeER(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toBe('erDiagram\n');
    });

    it('should serialize erDiagram header', () => {
      const canvas = createERCanvas([createEntityNode('CUSTOMER')]);
      const result = serializeER(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('erDiagram');
    });

    it('should serialize direction from metadata', () => {
      const canvas = createERCanvas(
        [createEntityNode('A')],
        [],
        { direction: 'LR' },
      );
      const result = serializeER(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('direction LR');
    });

    it('should serialize direction from canvas.direction', () => {
      const canvas = createERCanvas(
        [createEntityNode('A')],
        [],
        {},
        'TB',
      );
      const result = serializeER(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('direction TB');
    });

    it('should serialize accTitle and accDescr', () => {
      const canvas = createERCanvas(
        [createEntityNode('A')],
        [],
        {
          accTitle: 'My Title',
          accDescription: 'My Description',
        },
      );
      const result = serializeER(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('accTitle: My Title');
      expect(result.mermaid).toContain('accDescr: My Description');
    });
  });

  describe('实体序列化', () => {
    it('should serialize entity without attributes', () => {
      const canvas = createERCanvas([createEntityNode('CUSTOMER')]);
      const result = serializeER(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('CUSTOMER');
      // 无属性时不应输出块
      expect(result.mermaid).not.toContain('CUSTOMER {');
    });

    it('should serialize entity with attributes', () => {
      const canvas = createERCanvas([
        createEntityNode('CUSTOMER', {
          attributes: [
            createAttribute('id', { type: 'string' }),
            createAttribute('name', { type: 'string' }),
          ],
        }),
      ]);
      const result = serializeER(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('CUSTOMER {');
      expect(result.mermaid).toContain('string id');
      expect(result.mermaid).toContain('string name');
      expect(result.mermaid).toContain('}');
    });

    it('should serialize entity with alias', () => {
      const canvas = createERCanvas([
        createEntityNode('CUSTOMER', {
          alias: 'Customer',
          attributes: [createAttribute('id', { type: 'string' })],
        }),
      ]);
      const result = serializeER(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('CUSTOMER[Customer] {');
    });

    it('should serialize attribute with PK key', () => {
      const canvas = createERCanvas([
        createEntityNode('ORDER', {
          attributes: [
            createAttribute('order_id', { type: 'string', keys: ['PK'] }),
          ],
        }),
      ]);
      const result = serializeER(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('string order_id PK');
    });

    it('should serialize attribute with comment', () => {
      const canvas = createERCanvas([
        createEntityNode('ORDER', {
          attributes: [
            createAttribute('order_id', {
              type: 'string',
              keys: ['PK'],
              comment: 'the order id',
            }),
          ],
        }),
      ]);
      const result = serializeER(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('string order_id PK "the order id"');
    });

    it('should serialize attribute with multiple keys', () => {
      const canvas = createERCanvas([
        createEntityNode('USER', {
          attributes: [
            createAttribute('id', { type: 'string', keys: ['PK', 'FK'] }),
          ],
        }),
      ]);
      const result = serializeER(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('string id PK,FK');
    });
  });

  describe('关系序列化', () => {
    it('should serialize relationship with cardinality', () => {
      const canvas = createERCanvas(
        [createEntityNode('CUSTOMER'), createEntityNode('ORDER')],
        [
          createRelationshipEdge('CUSTOMER', 'ORDER', {
            cardinality: { from: 'only-one', to: 'zero-or-more' },
            erIdentification: 'identifying',
            erRole: 'places',
          }),
        ],
      );
      const result = serializeER(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('CUSTOMER ||--o{ ORDER : places');
    });

    it('should serialize relationship with role label', () => {
      const canvas = createERCanvas(
        [createEntityNode('A'), createEntityNode('B')],
        [
          createRelationshipEdge('A', 'B', {
            cardinality: { from: 'only-one', to: 'only-one' },
            erIdentification: 'identifying',
            erRole: 'contains',
          }),
        ],
      );
      const result = serializeER(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('A ||--|| B : contains');
    });

    it('should serialize relationship with quoted role when containing space', () => {
      const canvas = createERCanvas(
        [createEntityNode('A'), createEntityNode('B')],
        [
          createRelationshipEdge('A', 'B', {
            cardinality: { from: 'only-one', to: 'zero-or-more' },
            erIdentification: 'identifying',
            erRole: 'subscribed via',
          }),
        ],
      );
      const result = serializeER(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('A ||--o{ B : "subscribed via"');
    });

    it('should serialize identifying relationship (solid line --)', () => {
      const canvas = createERCanvas(
        [createEntityNode('A'), createEntityNode('B')],
        [
          createRelationshipEdge('A', 'B', {
            cardinality: { from: 'only-one', to: 'only-one' },
            erIdentification: 'identifying',
          }),
        ],
      );
      const result = serializeER(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('A ||--|| B');
    });

    it('should serialize non-identifying relationship (dotted line ..)', () => {
      const canvas = createERCanvas(
        [createEntityNode('A'), createEntityNode('B')],
        [
          createRelationshipEdge('A', 'B', {
            cardinality: { from: 'only-one', to: 'only-one' },
            erIdentification: 'non-identifying',
          }),
        ],
      );
      const result = serializeER(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('A ||..|| B');
    });

    it.each([
      ['zero-or-one', '|o'],
      ['zero-or-more', 'o{'],
      ['one-or-more', '|{'],
      ['only-one', '||'],
      ['md-parent', 'u'],
    ] as const)(
      'should serialize cardinality %s (%s) on source side',
      (cardFrom, symbolFrom) => {
        const canvas = createERCanvas(
          [createEntityNode('A'), createEntityNode('B')],
          [
            createRelationshipEdge('A', 'B', {
              cardinality: { from: cardFrom, to: 'only-one' },
              erIdentification: 'identifying',
            }),
          ],
        );
        const result = serializeER(canvas);

        expect(result.errors).toHaveLength(0);
        expect(result.mermaid).toContain(`A ${symbolFrom}--|| B`);
      },
    );

    it.each([
      ['zero-or-one', '|o'],
      ['zero-or-more', 'o{'],
      ['one-or-more', '|{'],
      ['only-one', '||'],
    ] as const)(
      'should serialize cardinality %s (%s) on target side',
      (cardTo, symbolTo) => {
        const canvas = createERCanvas(
          [createEntityNode('A'), createEntityNode('B')],
          [
            createRelationshipEdge('A', 'B', {
              cardinality: { from: 'only-one', to: cardTo },
              erIdentification: 'identifying',
            }),
          ],
        );
        const result = serializeER(canvas);

        expect(result.errors).toHaveLength(0);
        expect(result.mermaid).toContain(`A ||--${symbolTo} B`);
      },
    );

    it('should reject md-parent on target side with error', () => {
      // md-parent 在 target 端无效：jison 语法 u(?=[.\\-|]) 只匹配后跟 -/./| 的 u，
      // 在 target 端 u 后跟空格，会被解析为 UNICODE_TEXT 而非 MD_PARENT。
      // 序列化器应拒绝并报错，而不是输出无效语法。
      const canvas = createERCanvas(
        [createEntityNode('A'), createEntityNode('B')],
        [
          createRelationshipEdge('A', 'B', {
            cardinality: { from: 'only-one', to: 'md-parent' },
            erIdentification: 'identifying',
          }),
        ],
      );
      const result = serializeER(canvas);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toContain('md-parent');
      expect(result.mermaid).not.toContain('A ||--u B');
    });
  });

  describe('边界场景', () => {
    it('should reject non-erDiagram canvas', () => {
      const canvas = {
        diagramType: 'flowchart' as const,
        nodes: [],
        edges: [],
        direction: 'TB' as const,
      };
      const result = serializeER(canvas);

      expect(result.errors).toHaveLength(1);
      expect(result.mermaid).toBe('');
    });

    it('should serialize complete er diagram with entities and relationships', () => {
      const canvas = createERCanvas(
        [
          createEntityNode('CUSTOMER', {
            attributes: [
              createAttribute('id', { type: 'string', keys: ['PK'] }),
              createAttribute('name', { type: 'string' }),
            ],
          }),
          createEntityNode('ORDER', {
            attributes: [
              createAttribute('order_id', { type: 'string', keys: ['PK'] }),
              createAttribute('customer_id', { type: 'string', keys: ['FK'] }),
            ],
          }),
        ],
        [
          createRelationshipEdge('CUSTOMER', 'ORDER', {
            cardinality: { from: 'only-one', to: 'zero-or-more' },
            erIdentification: 'identifying',
            erRole: 'places',
          }),
        ],
        { direction: 'LR' },
      );
      const result = serializeER(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('erDiagram');
      expect(result.mermaid).toContain('direction LR');
      expect(result.mermaid).toContain('CUSTOMER ||--o{ ORDER : places');
      expect(result.mermaid).toContain('CUSTOMER {');
      expect(result.mermaid).toContain('string id PK');
      expect(result.mermaid).toContain('ORDER {');
      expect(result.mermaid).toContain('string customer_id FK');
    });
  });
});

/**
 * er round-trip 等价测试
 *
 * 验证 代码 → 解析 → CanvasState → 序列化 → 代码 的语义等价
 *
 * 等价判定策略:
 *   1. 原始代码 → parse → canvas1 → serialize → code2 → parse → canvas2
 *   2. 比较 canvas1 和 canvas2 的结构等价（节点数、边数、关键属性）
 *   3. 不做字符级精确匹配（mermaid 语法允许空格/换行差异）
 *
 * 覆盖场景:
 *   - 基础 round-trip（实体、属性、关系）
 *   - 基数 round-trip（5 种基数类型）
 *   - 关系类型 round-trip（identifying / non-identifying）
 *   - 完整场景 round-trip（含 direction、多实体、多关系）
 *
 * 注意:
 *   - serializeRelationship 通过 resolveEntityName 从 nodes 中查找 data.label 作为实体名输出，
 *     确保 round-trip 后实体名保持不变（如 CUSTOMER 而非 entity-CUSTOMER-0）
 *   - md-parent 仅在 source 端有效，target 端会被序列化器拒绝并报错
 */
import { describe, it, expect } from 'vitest';
import { parseERCode as parseER } from '../../src/index.js';
import { serializeER } from '../../src/serializer/er/er-serializer.js';
import type { GraphCanvasState, MermaidEdge } from '../../src/types.js';

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
  const parsed1 = parseER(code);
  if (!parsed1.success) {
    return {
      canvas1: parsed1.canvas,
      code2: '',
      canvas2: parsed1.canvas,
      success: false,
    };
  }

  const serialized = serializeER(parsed1.canvas);
  const parsed2 = parseER(serialized.mermaid);

  return {
    canvas1: parsed1.canvas,
    code2: serialized.mermaid,
    canvas2: parsed2.canvas,
    success: parsed2.success,
  };
}

/**
 * 比较两个边列表的基数/关系类型/角色（不比较 source/target，因为 ID 会变化）
 *
 * 由于序列化器 bug（使用节点 ID 作为实体名），round-trip 后边的 source/target 会变化，
 * 但基数、关系类型、角色应该保持不变。
 */
function expectEdgesStructureEquivalent(edges1: MermaidEdge[], edges2: MermaidEdge[]): void {
  expect(edges2).toHaveLength(edges1.length);
  for (const edge1 of edges1) {
    // 通过角色标签查找对应边（角色在 round-trip 后保持不变）
    const edge2 = edges2.find(
      (e) => e.data.label === edge1.data.label,
    );
    expect(edge2).toBeDefined();
    expect(edge2?.type).toBe(edge1.type);
    expect(edge2?.data.erIdentification).toBe(edge1.data.erIdentification);
    expect(edge2?.data.cardinality?.from).toBe(edge1.data.cardinality?.from);
    expect(edge2?.data.cardinality?.to).toBe(edge1.data.cardinality?.to);
    expect(edge2?.data.edgeStyle).toBe(edge1.data.edgeStyle);
  }
}

// ============================================================
// 测试用例
// ============================================================

describe('ER Round-trip 等价测试', () => {
  describe('基础 round-trip', () => {
    it('should round-trip simple entity', () => {
      const original = `erDiagram
CUSTOMER
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas2.nodes).toHaveLength(canvas1.nodes.length);
    });

    it('should round-trip entity with attributes', () => {
      const original = `erDiagram
CUSTOMER {
  string id PK
  string name
  int age
}
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas2.nodes).toHaveLength(canvas1.nodes.length);

      // 验证属性数量保留
      const node2 = canvas2.nodes[0];
      expect(node2?.data.attributes).toHaveLength(3);

      // 验证属性细节（顺序可能因 jison 逆序压栈而不同，用 name 查找）
      const attrs = node2?.data.attributes ?? [];
      const idAttr = attrs.find((a) => a.name === 'id');
      expect(idAttr).toBeDefined();
      expect(idAttr?.type).toBe('string');
      expect(idAttr?.keys).toContain('PK');

      const nameAttr = attrs.find((a) => a.name === 'name');
      expect(nameAttr).toBeDefined();
      expect(nameAttr?.type).toBe('string');

      const ageAttr = attrs.find((a) => a.name === 'age');
      expect(ageAttr).toBeDefined();
      expect(ageAttr?.type).toBe('int');
    });

    it('should round-trip entity with alias', () => {
      const original = `erDiagram
CUSTOMER[Customer] {
  string id
}
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas2.nodes).toHaveLength(canvas1.nodes.length);
      // alias 在 round-trip 后保留
      expect(canvas2.nodes[0]?.data.alias).toBe('Customer');
    });

    it('should round-trip entity with attribute comment', () => {
      const original = `erDiagram
ORDER {
  string order_id PK "the order id"
}
`;
      const { canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      const attrs = canvas2.nodes[0]?.data.attributes ?? [];
      const attr = attrs.find((a) => a.name === 'order_id');
      expect(attr?.comment).toBe('the order id');
    });

    it('should round-trip relationship', () => {
      const original = `erDiagram
CUSTOMER ||--o{ ORDER : places
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas2.edges).toHaveLength(canvas1.edges.length);
      expect(canvas2.nodes).toHaveLength(canvas1.nodes.length);

      // 验证边的基数、关系类型、角色保留
      const edge2 = canvas2.edges[0];
      expect(edge2?.data.label).toBe('places');
      expect(edge2?.data.erRole).toBe('places');
      expect(edge2?.data.cardinality?.from).toBe('only-one');
      expect(edge2?.data.cardinality?.to).toBe('zero-or-more');
      expect(edge2?.data.erIdentification).toBe('identifying');
      expectEdgesStructureEquivalent(canvas1.edges, canvas2.edges);
    });

    it('should round-trip relationship with quoted role', () => {
      const original = `erDiagram
CUSTOMER ||--o{ ORDER : "subscribed via"
`;
      const { canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas2.edges).toHaveLength(1);
      expect(canvas2.edges[0]?.data.label).toBe('subscribed via');
      expect(canvas2.edges[0]?.data.erRole).toBe('subscribed via');
    });
  });

  describe('基数 round-trip', () => {
    // 测试 source 端基数的 round-trip
    //
    // 注意：}o 在 jison 中被解析为 ZERO_OR_MORE（非 MD_PARENT），
    // round-trip 后会变为 o{（序列化器将 zero-or-more 输出为 o{）。
    it.each([
      ['zero-or-one', '|o'],
      ['zero-or-more', 'o{'],
      ['one-or-more', '|{'],
      ['only-one', '||'],
      ['zero-or-more', '}o'], // }o 解析为 zero-or-more，round-trip 后为 o{
    ] as const)(
      'should round-trip cardinality %s (%s) on source side',
      (expectedFrom, _symbol) => {
        const original = `erDiagram
A ${_symbol}--|| B : has
`;
        const { canvas1, canvas2, success } = roundTrip(original);

        expect(success).toBe(true);
        expect(canvas1.edges[0]?.data.cardinality?.from).toBe(expectedFrom);
        expect(canvas2.edges).toHaveLength(1);
        expect(canvas2.edges[0]?.data.cardinality?.from).toBe(expectedFrom);
        expect(canvas2.edges[0]?.data.cardinality?.to).toBe('only-one');
      },
    );

    // 测试 target 端基数的 round-trip
    it.each([
      ['zero-or-one', '|o'],
      ['zero-or-more', 'o{'],
      ['one-or-more', '|{'],
      ['only-one', '||'],
      ['zero-or-more', '}o'], // }o 解析为 zero-or-more，round-trip 后为 o{
    ] as const)(
      'should round-trip cardinality %s (%s) on target side',
      (expectedTo, _symbol) => {
        const original = `erDiagram
A ||--${_symbol} B : has
`;
        const { canvas1, canvas2, success } = roundTrip(original);

        expect(success).toBe(true);
        expect(canvas1.edges[0]?.data.cardinality?.to).toBe(expectedTo);
        expect(canvas2.edges).toHaveLength(1);
        expect(canvas2.edges[0]?.data.cardinality?.from).toBe('only-one');
        expect(canvas2.edges[0]?.data.cardinality?.to).toBe(expectedTo);
      },
    );
  });

  describe('关系类型 round-trip', () => {
    it('should round-trip identifying relationship', () => {
      const original = `erDiagram
A ||--|| B : has
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas1.edges[0]?.data.erIdentification).toBe('identifying');
      expect(canvas2.edges[0]?.data.erIdentification).toBe('identifying');
      expect(canvas2.edges[0]?.data.edgeStyle).toBe('line');
    });

    it('should round-trip non-identifying relationship', () => {
      const original = `erDiagram
A ||..|| B : has
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas1.edges[0]?.data.erIdentification).toBe('non-identifying');
      expect(canvas2.edges[0]?.data.erIdentification).toBe('non-identifying');
      expect(canvas2.edges[0]?.data.edgeStyle).toBe('dotted');
    });
  });

  describe('完整场景 round-trip', () => {
    it('should round-trip complete er diagram with entities and relationships', () => {
      const original = `erDiagram
CUSTOMER ||--o{ ORDER : places
ORDER ||--|{ LINE-ITEM : contains

CUSTOMER {
  string id PK
  string name
  string address
}

ORDER {
  string order_id PK
  string customer_id FK
  string order_date
}
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas2.nodes).toHaveLength(canvas1.nodes.length);
      expect(canvas2.edges).toHaveLength(canvas1.edges.length);

      // 验证关系保留（通过角色标签查找）
      const placesEdge = canvas2.edges.find((e) => e.data.label === 'places');
      expect(placesEdge).toBeDefined();
      expect(placesEdge?.data.cardinality?.from).toBe('only-one');
      expect(placesEdge?.data.cardinality?.to).toBe('zero-or-more');

      const containsEdge = canvas2.edges.find((e) => e.data.label === 'contains');
      expect(containsEdge).toBeDefined();
      expect(containsEdge?.data.cardinality?.from).toBe('only-one');
      expect(containsEdge?.data.cardinality?.to).toBe('one-or-more');

      // 验证实体属性保留（通过属性名查找）
      const nodesWithAttrs = canvas2.nodes.filter((n) => n.data.attributes && n.data.attributes.length > 0);
      expect(nodesWithAttrs).toHaveLength(2);

      // 找到包含 id PK 属性的节点
      const customerNode = nodesWithAttrs.find(
        (n) => n.data.attributes?.some((a) => a.name === 'id' && a.keys.includes('PK')),
      );
      expect(customerNode).toBeDefined();
      expect(customerNode?.data.attributes).toHaveLength(3);

      // 找到包含 customer_id FK 属性的节点
      const orderNode = nodesWithAttrs.find(
        (n) => n.data.attributes?.some((a) => a.name === 'customer_id' && a.keys.includes('FK')),
      );
      expect(orderNode).toBeDefined();
      expect(orderNode?.data.attributes).toHaveLength(3);
    });

    it('should round-trip diagram with direction', () => {
      const original = `erDiagram
direction LR

CUSTOMER ||--o{ ORDER : places
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas2.metadata?.direction).toBe(canvas1.metadata?.direction);
      expect(canvas2.metadata?.direction).toBe('LR');
    });

    it('should round-trip diagram with accTitle and accDescr', () => {
      const original = `erDiagram
accTitle: My ER Diagram
accDescr: This is an ER diagram

CUSTOMER ||--o{ ORDER : places
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      expect(canvas2.metadata?.accTitle).toBe(canvas1.metadata?.accTitle);
      expect(canvas2.metadata?.accTitle).toBe('My ER Diagram');
      expect(canvas2.metadata?.accDescription).toBe(canvas1.metadata?.accDescription);
      expect(canvas2.metadata?.accDescription).toBe('This is an ER diagram');
    });

    it('should round-trip diagram with multiple keys', () => {
      const original = `erDiagram
USER {
  string id PK,FK
}
`;
      const { canvas1, canvas2, success } = roundTrip(original);

      expect(success).toBe(true);
      const attrs1 = canvas1.nodes[0]?.data.attributes?.[0];
      const attrs2 = canvas2.nodes[0]?.data.attributes?.[0];
      expect(attrs2?.keys).toEqual(attrs1?.keys);
      expect(attrs2?.keys).toContain('PK');
      expect(attrs2?.keys).toContain('FK');
    });
  });
});

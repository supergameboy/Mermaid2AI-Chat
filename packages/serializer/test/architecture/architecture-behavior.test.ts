/**
 * architecture 行为验证测试 — M7
 *
 * 验证 architecture 解析器、序列化器的行为符合官方 mermaid architecture-beta 标准
 * 覆盖：官方语法、service/junction/group/edge、icon/title、in group、边方向、round-trip、边界
 *
 * 测试策略：行为验证（不测试实现细节，只测试接口和行为）
 */

import { describe, it, expect } from 'vitest';
import { parseArchitectureCode } from '../../src/parser/architecture/architecture-parser.js';
import { serializeArchitecture } from '../../src/serializer/architecture-serializer.js';
import type { GraphCanvasState, ArchitectureDirection } from '../../src/types.js';

// ============================================================
// 辅助函数
// ============================================================

/** 解析代码并返回 CanvasState（断言成功） */
function parse(code: string): GraphCanvasState {
  const result = parseArchitectureCode(code);
  expect(result.success).toBe(true);
  return result.canvas as GraphCanvasState;
}

/** round-trip: 代码 → 解析 → 序列化 → 代码 */
function roundTrip(code: string): { canvas: GraphCanvasState; code2: string } {
  const parsed = parseArchitectureCode(code);
  if (!parsed.success) {
    throw new Error(`解析失败: ${parsed.errors.map((e) => e.message).join(', ')}`);
  }
  const serialized = serializeArchitecture(parsed.canvas as GraphCanvasState);
  if (serialized.errors.length > 0) {
    throw new Error(`序列化失败: ${serialized.errors.map((e) => e.message).join(', ')}`);
  }
  return {
    canvas: parsed.canvas as GraphCanvasState,
    code2: serialized.mermaid,
  };
}

// ============================================================
// 基本解析
// ============================================================

describe('基本解析', () => {
  it('应解析空 architecture-beta', () => {
    const canvas = parse('architecture-beta');
    expect(canvas.diagramType).toBe('architecture');
    expect(canvas.nodes).toHaveLength(0);
    expect(canvas.edges).toHaveLength(0);
  });

  it('应解析单个 service', () => {
    const canvas = parse('architecture-beta\nservice db');
    expect(canvas.nodes).toHaveLength(1);
    expect(canvas.nodes[0]?.id).toBe('db');
    expect(canvas.nodes[0]?.type).toBe('arch-service');
    expect(canvas.nodes[0]?.data.shape).toBe('arch-service');
  });

  it('应解析单个 junction', () => {
    const canvas = parse('architecture-beta\njunction fanout');
    expect(canvas.nodes).toHaveLength(1);
    expect(canvas.nodes[0]?.id).toBe('fanout');
    expect(canvas.nodes[0]?.type).toBe('arch-junction');
    expect(canvas.nodes[0]?.data.archIsJunction).toBe(true);
  });

  it('应解析单个 group', () => {
    const canvas = parse('architecture-beta\ngroup api');
    expect(canvas.metadata?.groups).toHaveLength(1);
    expect(canvas.metadata?.groups?.[0]?.id).toBe('api');
  });
});

// ============================================================
// icon 和 title 支持
// ============================================================

describe('icon 和 title', () => {
  it('应解析 service 带 icon', () => {
    const canvas = parse('architecture-beta\nservice db(database)');
    expect(canvas.nodes[0]?.data.archIcon).toBe('database');
  });

  it('应解析 service 带 icon 和 title', () => {
    const canvas = parse('architecture-beta\nservice db(database)[Database]');
    expect(canvas.nodes[0]?.data.archIcon).toBe('database');
    expect(canvas.nodes[0]?.data.label).toBe('Database');
  });

  it('应解析 service 仅带 title', () => {
    const canvas = parse('architecture-beta\nservice db[My Database]');
    expect(canvas.nodes[0]?.data.label).toBe('My Database');
  });

  it('应解析 group 带 icon 和 title', () => {
    const canvas = parse('architecture-beta\ngroup api(cloud)[API Layer]');
    // v4 根因修复：icon 从 node.data.archIcon 派生（不再从 metadata.groups[i].icon 读取）
    const groupNode = canvas.nodes.find((n) => n.id === 'api');
    expect(groupNode?.data.archIcon).toBe('cloud');
    expect(groupNode?.data.label).toBe('API Layer');
    expect(groupNode?.type).toBe('arch-group');
  });
});

// ============================================================
// in group 语法
// ============================================================

describe('in group 语法', () => {
  it('应解析 service in group', () => {
    const canvas = parse('architecture-beta\ngroup api\nservice db in api');
    const db = canvas.nodes.find((n) => n.id === 'db');
    expect(db?.parentId).toBe('api');
    expect(db?.extent).toBe('parent');
  });

  it('应解析 junction in group', () => {
    const canvas = parse('architecture-beta\ngroup api\njunction fanout in api');
    const fanout = canvas.nodes.find((n) => n.id === 'fanout');
    expect(fanout?.parentId).toBe('api');
  });

  it('应将 group 成员通过 parentId 派生（v4：移除 nodeIds）', () => {
    const canvas = parse('architecture-beta\ngroup api\nservice db in api\nservice cache in api');
    const apiGroup = canvas.metadata?.groups?.[0];
    expect(apiGroup?.id).toBe('api');
    // v4：成员通过 parentId 派生，不再存储在 nodeIds
    const db = canvas.nodes.find((n) => n.id === 'db');
    const cache = canvas.nodes.find((n) => n.id === 'cache');
    expect(db?.parentId).toBe('api');
    expect(cache?.parentId).toBe('api');
  });
});

// ============================================================
// 边方向（L/R/T/B）
// ============================================================

describe('边方向', () => {
  it('应解析 A:L -- R:B 边', () => {
    const canvas = parse('architecture-beta\nservice a\nservice b\na:L -- R:b');
    expect(canvas.edges).toHaveLength(1);
    const edge = canvas.edges[0];
    expect(edge?.source).toBe('a');
    expect(edge?.target).toBe('b');
    expect(edge?.sourceHandle).toBe('left');
    expect(edge?.targetHandle).toBe('right');
  });

  it('应解析 A:T -- B:B 边', () => {
    const canvas = parse('architecture-beta\nservice a\nservice b\na:T -- B:b');
    expect(canvas.edges[0]?.sourceHandle).toBe('top');
    expect(canvas.edges[0]?.targetHandle).toBe('bottom');
  });

  it('应解析带箭头的边 A:L --> R:B', () => {
    const canvas = parse('architecture-beta\nservice a\nservice b\na:L --> R:b');
    expect(canvas.edges[0]?.data.edgeStyle).toBe('arrow');
    expect(canvas.edges[0]?.data.archEdge?.rhsInto).toBe(true);
  });

  it('应解析无箭头的边 A:L -- R:B', () => {
    const canvas = parse('architecture-beta\nservice a\nservice b\na:L -- R:b');
    expect(canvas.edges[0]?.data.edgeStyle).toBe('line');
    expect(canvas.edges[0]?.data.archEdge?.rhsInto).toBe(false);
  });

  it('应解析带标题的边 A:L -- R:B : Title', () => {
    const canvas = parse('architecture-beta\nservice a\nservice b\na:L -- R:b : My Title');
    expect(canvas.edges[0]?.data.archEdge?.title).toBe('My Title');
  });

  // v4 修复：支持 <-- 和 <--> 边
  it('应解析左箭头边 A:L <-- R:B', () => {
    const canvas = parse('architecture-beta\nservice a\nservice b\na:L <-- R:b');
    expect(canvas.edges).toHaveLength(1);
    expect(canvas.edges[0]?.data.archEdge?.lhsInto).toBe(true);
    expect(canvas.edges[0]?.data.archEdge?.rhsInto).toBe(false);
    expect(canvas.edges[0]?.data.edgeStyle).toBe('arrow');
  });

  it('应解析双向箭头边 A:L <--> R:B', () => {
    const canvas = parse('architecture-beta\nservice a\nservice b\na:L <--> R:b');
    expect(canvas.edges).toHaveLength(1);
    expect(canvas.edges[0]?.data.archEdge?.lhsInto).toBe(true);
    expect(canvas.edges[0]?.data.archEdge?.rhsInto).toBe(true);
    expect(canvas.edges[0]?.data.edgeStyle).toBe('arrow');
  });
});

// ============================================================
// 序列化
// ============================================================

describe('序列化', () => {
  it('应序列化空 canvas', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'architecture',
      nodes: [],
      edges: [],
    };
    const result = serializeArchitecture(canvas);
    expect(result.mermaid).toBe('architecture-beta');
    expect(result.errors).toHaveLength(0);
  });

  it('应序列化 service', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'architecture',
      nodes: [{
        id: 'db',
        type: 'arch-service',
        position: { x: 0, y: 0 },
        data: { label: 'db', shape: 'arch-service' },
      }],
      edges: [],
    };
    const result = serializeArchitecture(canvas);
    expect(result.mermaid).toContain('service db');
  });

  it('应序列化 service 带 icon 和 title', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'architecture',
      nodes: [{
        id: 'db',
        type: 'arch-service',
        position: { x: 0, y: 0 },
        data: {
          label: 'Database',
          shape: 'arch-service',
          archIcon: 'database',
        },
      }],
      edges: [],
    };
    const result = serializeArchitecture(canvas);
    expect(result.mermaid).toContain('service db(database)[Database]');
  });

  it('应序列化 junction', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'architecture',
      nodes: [{
        id: 'fanout',
        type: 'arch-junction',
        position: { x: 0, y: 0 },
        data: { label: 'fanout', shape: 'arch-junction', archIsJunction: true },
      }],
      edges: [],
    };
    const result = serializeArchitecture(canvas);
    expect(result.mermaid).toContain('junction fanout');
  });

  it('应序列化 group', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'architecture',
      nodes: [{
        id: 'api',
        type: 'arch-group',
        position: { x: 0, y: 0 },
        // v4 根因修复：icon 存储在 node.data.archIcon（不再在 metadata.groups[i].icon）
        data: { label: 'API Layer', shape: 'arch-group', archIcon: 'cloud' },
      }],
      edges: [],
      metadata: {
        groups: [{ id: 'api' }],
      },
    };
    const result = serializeArchitecture(canvas);
    expect(result.mermaid).toContain('group api(cloud)[API Layer]');
  });

  it('应序列化 service in group', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'architecture',
      nodes: [{
        id: 'db',
        type: 'arch-service',
        position: { x: 0, y: 0 },
        parentId: 'api',
        extent: 'parent',
        data: { label: 'db', shape: 'arch-service' },
      }],
      edges: [],
    };
    const result = serializeArchitecture(canvas);
    expect(result.mermaid).toContain('service db in api');
  });

  it('应序列化边（无箭头）', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'architecture',
      nodes: [
        { id: 'a', type: 'arch-service', position: { x: 0, y: 0 }, data: { label: 'a', shape: 'arch-service' } },
        { id: 'b', type: 'arch-service', position: { x: 200, y: 0 }, data: { label: 'b', shape: 'arch-service' } },
      ],
      edges: [{
        id: 'e1',
        source: 'a',
        target: 'b',
        type: 'smoothstep',
        sourceHandle: 'left',
        targetHandle: 'right',
        data: {
          edgeStyle: 'line',
          archEdge: {
            lhsId: 'a',
            lhsDir: 'L' as ArchitectureDirection,
            lhsInto: false,
            rhsId: 'b',
            rhsDir: 'R' as ArchitectureDirection,
            rhsInto: false,
          },
        },
      }],
    };
    const result = serializeArchitecture(canvas);
    expect(result.mermaid).toContain('a:L -- R:b');
  });

  it('应序列化边（带箭头）', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'architecture',
      nodes: [
        { id: 'a', type: 'arch-service', position: { x: 0, y: 0 }, data: { label: 'a', shape: 'arch-service' } },
        { id: 'b', type: 'arch-service', position: { x: 200, y: 0 }, data: { label: 'b', shape: 'arch-service' } },
      ],
      edges: [{
        id: 'e1',
        source: 'a',
        target: 'b',
        type: 'smoothstep',
        sourceHandle: 'left',
        targetHandle: 'right',
        data: {
          edgeStyle: 'arrow',
          archEdge: {
            lhsId: 'a',
            lhsDir: 'L' as ArchitectureDirection,
            lhsInto: false,
            rhsId: 'b',
            rhsDir: 'R' as ArchitectureDirection,
            rhsInto: true,
          },
        },
      }],
    };
    const result = serializeArchitecture(canvas);
    expect(result.mermaid).toContain('a:L --> R:b');
  });

  it('应序列化边（带标题）', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'architecture',
      nodes: [
        { id: 'a', type: 'arch-service', position: { x: 0, y: 0 }, data: { label: 'a', shape: 'arch-service' } },
        { id: 'b', type: 'arch-service', position: { x: 200, y: 0 }, data: { label: 'b', shape: 'arch-service' } },
      ],
      edges: [{
        id: 'e1',
        source: 'a',
        target: 'b',
        type: 'smoothstep',
        sourceHandle: 'left',
        targetHandle: 'right',
        data: {
          edgeStyle: 'line',
          archEdge: {
            lhsId: 'a',
            lhsDir: 'L' as ArchitectureDirection,
            lhsInto: false,
            rhsId: 'b',
            rhsDir: 'R' as ArchitectureDirection,
            rhsInto: false,
            title: 'Connection',
          },
        },
      }],
    };
    const result = serializeArchitecture(canvas);
    expect(result.mermaid).toContain('a:L -- R:b : Connection');
  });

  // v4 修复：序列化 <-- 和 <--> 边
  it('应序列化左箭头边（<--）', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'architecture',
      nodes: [
        { id: 'a', type: 'arch-service', position: { x: 0, y: 0 }, data: { label: 'a', shape: 'arch-service' } },
        { id: 'b', type: 'arch-service', position: { x: 200, y: 0 }, data: { label: 'b', shape: 'arch-service' } },
      ],
      edges: [{
        id: 'e1',
        source: 'a',
        target: 'b',
        type: 'smoothstep',
        sourceHandle: 'left',
        targetHandle: 'right',
        data: {
          edgeStyle: 'arrow',
          archEdge: {
            lhsId: 'a',
            lhsDir: 'L' as ArchitectureDirection,
            lhsInto: true,
            rhsId: 'b',
            rhsDir: 'R' as ArchitectureDirection,
            rhsInto: false,
          },
        },
      }],
    };
    const result = serializeArchitecture(canvas);
    expect(result.mermaid).toContain('a:L <-- R:b');
  });

  it('应序列化双向箭头边（<-->）', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'architecture',
      nodes: [
        { id: 'a', type: 'arch-service', position: { x: 0, y: 0 }, data: { label: 'a', shape: 'arch-service' } },
        { id: 'b', type: 'arch-service', position: { x: 200, y: 0 }, data: { label: 'b', shape: 'arch-service' } },
      ],
      edges: [{
        id: 'e1',
        source: 'a',
        target: 'b',
        type: 'smoothstep',
        sourceHandle: 'left',
        targetHandle: 'right',
        data: {
          edgeStyle: 'arrow',
          archEdge: {
            lhsId: 'a',
            lhsDir: 'L' as ArchitectureDirection,
            lhsInto: true,
            rhsId: 'b',
            rhsDir: 'R' as ArchitectureDirection,
            rhsInto: true,
          },
        },
      }],
    };
    const result = serializeArchitecture(canvas);
    expect(result.mermaid).toContain('a:L <--> R:b');
  });
});

// ============================================================
// Round-trip
// ============================================================

describe('Round-trip', () => {
  it('空代码 round-trip', () => {
    const { code2 } = roundTrip('architecture-beta');
    expect(code2).toBe('architecture-beta');
  });

  it('单个 service round-trip', () => {
    const { code2 } = roundTrip('architecture-beta\nservice db');
    expect(code2).toContain('service db');
  });

  it('service 带 icon 和 title round-trip', () => {
    const { code2 } = roundTrip('architecture-beta\nservice db(database)[Database]');
    expect(code2).toContain('service db(database)[Database]');
  });

  it('junction round-trip', () => {
    const { code2 } = roundTrip('architecture-beta\njunction fanout');
    expect(code2).toContain('junction fanout');
  });

  it('group round-trip', () => {
    const { code2 } = roundTrip('architecture-beta\ngroup api(cloud)[API]');
    expect(code2).toContain('group api(cloud)[API]');
  });

  it('service in group round-trip', () => {
    const { code2 } = roundTrip('architecture-beta\ngroup api\nservice db in api');
    expect(code2).toContain('group api');
    expect(code2).toContain('service db in api');
  });

  it('嵌套 group round-trip（父 group 先输出）', () => {
    // v4：sortGroupsByNesting 确保父 group 先于子 group 输出
    const { code2, canvas } = roundTrip('architecture-beta\ngroup outer\ngroup inner in outer\nservice db in inner');
    // 验证父 group 先输出
    const outerIdx = code2.indexOf('group outer');
    const innerIdx = code2.indexOf('group inner in outer');
    expect(outerIdx).toBeGreaterThanOrEqual(0);
    expect(innerIdx).toBeGreaterThan(outerIdx);
    // 验证内容完整
    expect(code2).toContain('group outer');
    expect(code2).toContain('group inner in outer');
    expect(code2).toContain('service db in inner');
    // 验证嵌套关系
    const innerNode = canvas.nodes.find((n) => n.id === 'inner');
    expect(innerNode?.parentId).toBe('outer');
    const dbNode = canvas.nodes.find((n) => n.id === 'db');
    expect(dbNode?.parentId).toBe('inner');
  });

  it('边 round-trip（无箭头）', () => {
    const { code2 } = roundTrip('architecture-beta\nservice a\nservice b\na:L -- R:b');
    expect(code2).toContain('a:L -- R:b');
  });

  it('边 round-trip（带箭头）', () => {
    const { code2 } = roundTrip('architecture-beta\nservice a\nservice b\na:L --> R:b');
    expect(code2).toContain('a:L --> R:b');
  });

  it('边 round-trip（带标题）', () => {
    const { code2 } = roundTrip('architecture-beta\nservice a\nservice b\na:L -- R:b : My Title');
    expect(code2).toContain('a:L -- R:b : My Title');
  });

  // v4 修复：<-- 和 <--> 边 round-trip
  it('边 round-trip（左箭头 <--）', () => {
    const { code2, canvas } = roundTrip('architecture-beta\nservice a\nservice b\na:L <-- R:b');
    expect(code2).toContain('a:L <-- R:b');
    const edge = canvas.edges[0];
    expect(edge?.data.archEdge?.lhsInto).toBe(true);
    expect(edge?.data.archEdge?.rhsInto).toBe(false);
  });

  it('边 round-trip（双向箭头 <-->）', () => {
    const { code2, canvas } = roundTrip('architecture-beta\nservice a\nservice b\na:L <--> R:b');
    expect(code2).toContain('a:L <--> R:b');
    const edge = canvas.edges[0];
    expect(edge?.data.archEdge?.lhsInto).toBe(true);
    expect(edge?.data.archEdge?.rhsInto).toBe(true);
  });
});

// ============================================================
// 完整官方示例
// ============================================================

describe('完整架构示例', () => {
  it('应解析完整架构（services + junctions + groups + edges）', () => {
    const code = `architecture-beta
service db(database)[Database]
service server(server)[Server]
service cache(cache)[Cache]
junction fanout
group api(cloud)[API]
service web(web)[Web] in api
service auth(auth)[Auth] in api
db:L -- R:server
server:T -- B:cache
server:R -- L:fanout
fanout:T -- B:web
fanout:R -- L:auth`;
    const canvas = parse(code);

    expect(canvas.nodes).toHaveLength(7); // db, server, cache, fanout, web, auth + api(group 作为节点)
    expect(canvas.edges).toHaveLength(5);
    expect(canvas.metadata?.groups).toHaveLength(1);

    // 验证 group 成员（v4：通过 parentId 派生，不再存储在 nodeIds）
    const apiGroup = canvas.metadata?.groups?.[0];
    expect(apiGroup?.id).toBe('api');

    // 验证 web 和 auth 的 parentId
    const web = canvas.nodes.find((n) => n.id === 'web');
    const auth = canvas.nodes.find((n) => n.id === 'auth');
    expect(web?.parentId).toBe('api');
    expect(auth?.parentId).toBe('api');
  });

  it('完整架构 round-trip 应保持一致', () => {
    const code = `architecture-beta
service db(database)[Database]
service server(server)[Server]
junction fanout
db:L -- R:server
server:R -- L:fanout`;
    const { code2 } = roundTrip(code);

    // round-trip 后应包含所有元素
    expect(code2).toContain('architecture-beta');
    expect(code2).toContain('service db(database)[Database]');
    expect(code2).toContain('service server(server)[Server]');
    expect(code2).toContain('junction fanout');
    expect(code2).toContain('db:L -- R:server');
    expect(code2).toContain('server:R -- L:fanout');
  });
});

// ============================================================
// 边界和错误
// ============================================================

describe('边界和错误', () => {
  it('应处理空字符串', () => {
    const result = parseArchitectureCode('');
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('应处理缺少 architecture-beta 关键字', () => {
    const result = parseArchitectureCode('service db');
    expect(result.success).toBe(false);
  });

  it('应处理未知关键字', () => {
    const result = parseArchitectureCode('architecture-beta\nunknown_keyword foo');
    // 不应崩溃，应有错误
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('应处理边引用不存在的节点', () => {
    // 边引用的节点不存在时，仍然应该解析（节点缺失是用户错误，不是解析器错误）
    const canvas = parse('architecture-beta\nservice a\na:L -- R:b');
    expect(canvas.edges).toHaveLength(1);
    expect(canvas.edges[0]?.source).toBe('a');
    expect(canvas.edges[0]?.target).toBe('b');
  });
});

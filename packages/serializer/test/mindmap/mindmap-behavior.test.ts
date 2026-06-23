/**
 * mindmap 行为验证测试 — M6
 *
 * 验证 mindmap 解析器、序列化器的行为符合官方 mermaid 标准
 * 覆盖：官方示例、7 种形状、icon/class 装饰、树形结构、round-trip、边界
 *
 * 测试策略：行为验证（不测试实现细节，只测试接口和行为）
 */

import { describe, it, expect } from 'vitest';
import { parseMindmapCode } from '../../src/parser/mindmap/mindmap-parser.js';
import { serializeMindmap } from '../../src/serializer/mindmap-serializer.js';
import type { GraphCanvasState, MindmapNodeType } from '../../src/types.js';

// ============================================================
// 辅助函数
// ============================================================

/** 解析代码并返回 CanvasState（断言成功） */
function parse(code: string): GraphCanvasState {
  const result = parseMindmapCode(code);
  expect(result.success).toBe(true);
  return result.canvas as GraphCanvasState;
}

/** 获取节点的 mindmapType */
function getMindmapType(canvas: GraphCanvasState, nodeId: string): MindmapNodeType | undefined {
  const node = canvas.nodes.find((n) => n.id === nodeId);
  return node?.data.mindmapType;
}

/** 获取节点的 parentId */
function getParentId(canvas: GraphCanvasState, nodeId: string): string | undefined {
  const node = canvas.nodes.find((n) => n.id === nodeId);
  return node?.parentId;
}

/** round-trip: 代码 → 解析 → 序列化 → 代码 → 解析 → canvas */
function roundTrip(code: string): {
  canvas1: GraphCanvasState;
  code2: string;
  canvas2: GraphCanvasState;
  success: boolean;
} {
  const parsed1 = parseMindmapCode(code);
  if (!parsed1.success) {
    throw new Error(`第一次解析失败: ${parsed1.errors.map((e) => e.message).join(', ')}`);
  }

  const serialized = serializeMindmap(parsed1.canvas);
  if (serialized.errors.length > 0) {
    throw new Error(`序列化失败: ${serialized.errors.map((e) => e.message).join(', ')}`);
  }

  const parsed2 = parseMindmapCode(serialized.mermaid);
  return {
    canvas1: parsed1.canvas as GraphCanvasState,
    code2: serialized.mermaid,
    canvas2: parsed2.canvas as GraphCanvasState,
    success: parsed2.success,
  };
}

// ============================================================
// 官方示例对照
// ============================================================

describe('官方示例对照', () => {
  it('应正确解析 Basic Mindmap 示例', () => {
    const code = `mindmap
  root((mindmap))
    Origins
      Long history
      ::icon(fa fa-book)
      Popularisation
        British popular psychology author Tony Buzan
    Research
      On effectiveness<br/>and features
      On Automatic creation
      ::icon(fa fa-spinner)
    Tools
      Pen and paper
      Mermaid
      ::icon(fa fa-pen)
    Uses
        Creative thinking
        Collaborative brainstorming
        Visual thinking
        ::icon(fa fa-lightbulb)
    Conclusion
      ::icon(fa fa-star)
      Despite the simplicity of the method<br/>it can be a powerful tool`;

    const canvas = parse(code);

    // 应有 root 节点
    const root = canvas.nodes.find((n) => {
      const data = n.data as GraphCanvasState['nodes'][number]['data'] & { isRoot?: boolean };
      return data.isRoot === true;
    });
    expect(root).toBeDefined();
    expect(root?.data.label).toBe('mindmap');
    expect(root?.data.mindmapType).toBe('circle');

    // 应有多个子节点
    expect(canvas.nodes.length).toBeGreaterThan(5);
  });

  it('应正确解析 7 种形状的节点', () => {
    const code = `mindmap
  root{{Root}}
    default_node
    rect_node[Rect]
    rounded_node(Rounded)
    circle_node((Circle))
    cloud_node)Cloud(
    bang_node))Bang(
    hexagon_node{{Hexagon}}`;

    const canvas = parse(code);

    // root 节点（hexagon 形状）
    const root = canvas.nodes.find((n) => {
      const data = n.data as GraphCanvasState['nodes'][number]['data'] & { isRoot?: boolean };
      return data.isRoot === true;
    });
    expect(root).toBeDefined();
    expect(root?.data.mindmapType).toBe('hexagon');

    // 验证 7 种形状
    expect(getMindmapType(canvas, '0')).toBe('hexagon'); // root
    expect(getMindmapType(canvas, '1')).toBe('default'); // default_node
    expect(getMindmapType(canvas, '2')).toBe('rect'); // rect_node
    expect(getMindmapType(canvas, '3')).toBe('rounded'); // rounded_node
    expect(getMindmapType(canvas, '4')).toBe('circle'); // circle_node
    expect(getMindmapType(canvas, '5')).toBe('cloud'); // cloud_node
    expect(getMindmapType(canvas, '6')).toBe('bang'); // bang_node
    expect(getMindmapType(canvas, '7')).toBe('hexagon'); // hexagon_node
  });

  it('应正确解析 icon 装饰', () => {
    const code = `mindmap
  root((Root))
    Child1
    ::icon(fa fa-book)
    Child2`;

    const canvas = parse(code);

    // Child1 应有 icon
    const child1 = canvas.nodes.find((n) => n.data.label === 'Child1');
    expect(child1).toBeDefined();
    expect(child1?.data.mindmapIcon).toBe('fa fa-book');
  });

  it('应正确解析 class 装饰', () => {
    const code = `mindmap
  root((Root))
    Child1
    :::myClass
    Child2`;

    const canvas = parse(code);

    // Child1 应有 class
    const child1 = canvas.nodes.find((n) => n.data.label === 'Child1');
    expect(child1).toBeDefined();
    expect(child1?.data.mindmapClass).toBe('myClass');
  });
});

// ============================================================
// 树形结构验证
// ============================================================

describe('树形结构验证', () => {
  it('应正确构建 parentId 关系（树形结构）', () => {
    const code = `mindmap
  root((Root))
    Child1
      Grandchild1
      Grandchild2
    Child2`;

    const canvas = parse(code);

    // root 无 parentId
    const root = canvas.nodes.find((n) => n.data.label === 'Root');
    expect(root?.parentId).toBeUndefined();

    // Child1 和 Child2 的 parentId 是 root
    const child1 = canvas.nodes.find((n) => n.data.label === 'Child1');
    const child2 = canvas.nodes.find((n) => n.data.label === 'Child2');
    expect(child1?.parentId).toBe(root?.id);
    expect(child2?.parentId).toBe(root?.id);

    // Grandchild1 和 Grandchild2 的 parentId 是 Child1
    const grandchild1 = canvas.nodes.find((n) => n.data.label === 'Grandchild1');
    const grandchild2 = canvas.nodes.find((n) => n.data.label === 'Grandchild2');
    expect(grandchild1?.parentId).toBe(child1?.id);
    expect(grandchild2?.parentId).toBe(child1?.id);
  });

  it('应正确处理多层嵌套', () => {
    const code = `mindmap
  root((Root))
    Level1
      Level2
        Level3
          Level4`;

    const canvas = parse(code);

    expect(canvas.nodes.length).toBe(5);
    expect(getParentId(canvas, '1')).toBe('0'); // Level1 → root
    expect(getParentId(canvas, '2')).toBe('1'); // Level2 → Level1
    expect(getParentId(canvas, '3')).toBe('2'); // Level3 → Level2
    expect(getParentId(canvas, '4')).toBe('3'); // Level4 → Level3
  });

  it('应正确处理多分支树', () => {
    const code = `mindmap
  root((Root))
    BranchA
      LeafA1
      LeafA2
    BranchB
      LeafB1
      LeafB2`;

    const canvas = parse(code);

    // root 有 2 个直接子节点
    const rootChildren = canvas.nodes.filter((n) => n.parentId === '0');
    expect(rootChildren.length).toBe(2);

    // BranchA 有 2 个子节点
    const branchA = canvas.nodes.find((n) => n.data.label === 'BranchA');
    const branchAChildren = canvas.nodes.filter((n) => n.parentId === branchA?.id);
    expect(branchAChildren.length).toBe(2);

    // BranchB 有 2 个子节点
    const branchB = canvas.nodes.find((n) => n.data.label === 'BranchB');
    const branchBChildren = canvas.nodes.filter((n) => n.parentId === branchB?.id);
    expect(branchBChildren.length).toBe(2);
  });
});

// ============================================================
// Round-trip 验证
// ============================================================

describe('Round-trip 验证', () => {
  it('简单 mindmap 应支持 round-trip', () => {
    const code = `mindmap
  root((Root))
    Child1
    Child2`;

    const result = roundTrip(code);
    expect(result.success).toBe(true);
    expect(result.canvas2.nodes.length).toBe(result.canvas1.nodes.length);
  });

  it('7 种形状应支持 round-trip', () => {
    const code = `mindmap
  root((Root))
    default_node
    rect_node[Rect]
    rounded_node(Rounded)
    circle_node((Circle))
    cloud_node)Cloud(
    bang_node))Bang(
    hexagon_node{{Hexagon}}`;

    const result = roundTrip(code);
    expect(result.success).toBe(true);

    // 验证形状保持一致
    const types1 = result.canvas1.nodes.map((n) => n.data.mindmapType);
    const types2 = result.canvas2.nodes.map((n) => n.data.mindmapType);
    expect(types2).toEqual(types1);
  });

  it('icon 装饰应支持 round-trip', () => {
    const code = `mindmap
  root((Root))
    Child1
    ::icon(fa fa-book)
    Child2`;

    const result = roundTrip(code);
    expect(result.success).toBe(true);

    // 验证 icon 保持一致
    const icon1 = result.canvas1.nodes.map((n) => n.data.mindmapIcon).filter(Boolean);
    const icon2 = result.canvas2.nodes.map((n) => n.data.mindmapIcon).filter(Boolean);
    expect(icon2).toEqual(icon1);
  });

  it('class 装饰应支持 round-trip', () => {
    const code = `mindmap
  root((Root))
    Child1
    :::myClass
    Child2`;

    const result = roundTrip(code);
    expect(result.success).toBe(true);

    // 验证 class 保持一致
    const class1 = result.canvas1.nodes.map((n) => n.data.mindmapClass).filter(Boolean);
    const class2 = result.canvas2.nodes.map((n) => n.data.mindmapClass).filter(Boolean);
    expect(class2).toEqual(class1);
  });

  it('多层嵌套应支持 round-trip', () => {
    const code = `mindmap
  root((Root))
    Level1
      Level2
        Level3
          Level4`;

    const result = roundTrip(code);
    expect(result.success).toBe(true);
    expect(result.canvas2.nodes.length).toBe(result.canvas1.nodes.length);

    // 验证 parentId 关系保持一致
    const parents1 = result.canvas1.nodes.map((n) => n.parentId);
    const parents2 = result.canvas2.nodes.map((n) => n.parentId);
    expect(parents2).toEqual(parents1);
  });

  it('官方示例应支持 round-trip', () => {
    const code = `mindmap
  root((mindmap))
    Origins
      Long history
      ::icon(fa fa-book)
      Popularisation
    Research
      On effectiveness
    Tools
      Pen and paper
      Mermaid`;

    const result = roundTrip(code);
    expect(result.success).toBe(true);
    expect(result.canvas2.nodes.length).toBe(result.canvas1.nodes.length);
  });
});

// ============================================================
// 边界情况
// ============================================================

describe('边界情况', () => {
  it('空 mindmap 应返回空 canvas', () => {
    const result = parseMindmapCode('mindmap');
    expect(result.success).toBe(true);
    const canvas = result.canvas as GraphCanvasState;
    expect(canvas.nodes.length).toBe(0);
    expect(canvas.edges.length).toBe(0);
  });

  it('只有 root 的 mindmap 应正确解析', () => {
    const code = `mindmap
  root((Root))`;

    const canvas = parse(code);
    expect(canvas.nodes.length).toBe(1);
    expect(canvas.nodes[0]?.data.label).toBe('Root');
    expect(canvas.nodes[0]?.data.mindmapType).toBe('circle');
  });

  it('default 形状节点应正确解析', () => {
    const code = `mindmap
  root
    child1
    child2`;

    const canvas = parse(code);
    // root 是 default 形状
    expect(canvas.nodes[0]?.data.mindmapType).toBe('default');
    expect(canvas.nodes[0]?.data.label).toBe('root');
  });

  it('应正确处理带空白的 label', () => {
    const code = `mindmap
  root((Root Node))
    Child Node 1
    Child Node 2`;

    const canvas = parse(code);
    expect(canvas.nodes[0]?.data.label).toBe('Root Node');
    expect(canvas.nodes[1]?.data.label).toBe('Child Node 1');
    expect(canvas.nodes[2]?.data.label).toBe('Child Node 2');
  });

  it('多 root 应报错（官方规定只能有一个 root）', () => {
    const code = `mindmap
  root1
  root2`;

    const result = parseMindmapCode(code);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.message).toContain('root');
  });
});

// ============================================================
// 序列化验证
// ============================================================

describe('序列化验证', () => {
  it('应正确序列化 7 种形状语法', () => {
    const code = `mindmap
  root((Root))
    default_node
    rect_node[Rect]
    rounded_node(Rounded)
    circle_node((Circle))
    cloud_node)Cloud(
    bang_node))Bang(
    hexagon_node{{Hexagon}}`;

    const canvas = parse(code);
    const result = serializeMindmap(canvas);
    expect(result.errors.length).toBe(0);

    // 验证序列化后的代码包含正确的形状语法
    expect(result.mermaid).toContain('mindmap');
    expect(result.mermaid).toContain('root((Root))');
    expect(result.mermaid).toContain('rect_node[Rect]');
    expect(result.mermaid).toContain('rounded_node(Rounded)');
    expect(result.mermaid).toContain('circle_node((Circle))');
    expect(result.mermaid).toContain('cloud_node)Cloud)');
    expect(result.mermaid).toContain('bang_node))Bang)');
    expect(result.mermaid).toContain('hexagon_node{{Hexagon}}');
  });

  it('应正确序列化 icon 装饰行', () => {
    const code = `mindmap
  root((Root))
    Child1
    ::icon(fa fa-book)
    Child2`;

    const canvas = parse(code);
    const result = serializeMindmap(canvas);
    expect(result.errors.length).toBe(0);
    expect(result.mermaid).toContain('::icon(fa fa-book)');
  });

  it('应正确序列化 class 装饰行', () => {
    const code = `mindmap
  root((Root))
    Child1
    :::myClass
    Child2`;

    const canvas = parse(code);
    const result = serializeMindmap(canvas);
    expect(result.errors.length).toBe(0);
    expect(result.mermaid).toContain(':::myClass');
  });

  it('应正确序列化缩进层级', () => {
    const code = `mindmap
  root((Root))
    Level1
      Level2
        Level3`;

    const canvas = parse(code);
    const result = serializeMindmap(canvas);
    expect(result.errors.length).toBe(0);

    const lines = result.mermaid.split('\n');
    // root 在 level 0（无缩进）
    expect(lines.some((l) => l === 'root((Root))')).toBe(true);
    // Level1 在 level 1（2 空格缩进）
    expect(lines.some((l) => l === '  Level1')).toBe(true);
    // Level2 在 level 2（4 空格缩进）
    expect(lines.some((l) => l === '    Level2')).toBe(true);
    // Level3 在 level 3（6 空格缩进）
    expect(lines.some((l) => l === '      Level3')).toBe(true);
  });

  it('空 canvas 应序列化为仅 header', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'mindmap',
      nodes: [],
      edges: [],
    };

    const result = serializeMindmap(canvas);
    expect(result.errors.length).toBe(0);
    expect(result.mermaid).toBe('mindmap');
  });

  it('非 mindmap 类型应返回错误', () => {
    const canvas = {
      diagramType: 'flowchart',
      nodes: [],
      edges: [],
      direction: 'TB',
    } as unknown as GraphCanvasState;

    const result = serializeMindmap(canvas);
    expect(result.errors.length).toBe(1);
    expect(result.mermaid).toBe('');
  });
});

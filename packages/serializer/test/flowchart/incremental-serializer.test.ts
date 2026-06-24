/**
 * 增量序列化器测试 — M1-14
 *
 * 验证 isIncrementalChange() 和 applyIncrementalChanges() 的行为
 *
 * 测试覆盖:
 *   1. isIncrementalChange: 属性级变更（增量）vs 结构级变更（全量）
 *   2. applyIncrementalChanges: 基于 _sourceLine 的行级替换
 *   3. 回退逻辑: 无法增量时返回 null
 *   4. 格式保留: 注释、空行、缩进、顺序保留
 *
 * 测试策略: 行为验证（不测试实现细节，只测试接口和行为）
 */
import { describe, it, expect } from 'vitest';
import { parseFlowchartCode } from '../../src/parser/flowchart/flowchart-parser.js';
import {
  isIncrementalChange,
  applyIncrementalChanges,
} from '../../src/serializer/flowchart/incremental-serializer.js';
import type { GraphCanvasState, MermaidNode, MermaidEdge } from '../../src/types.js';

// ============================================================
// 辅助函数
// ============================================================

/** 解析代码并返回 CanvasState（断言成功） */
function parse(code: string): GraphCanvasState {
  const result = parseFlowchartCode(code);
  expect(result.success).toBe(true);
  return result.canvas as GraphCanvasState;
}

/** 深拷贝 CanvasState（避免引用共享） */
function cloneCanvas(canvas: GraphCanvasState): GraphCanvasState {
  return {
    ...canvas,
    nodes: canvas.nodes.map((n) => ({
      ...n,
      data: { ...n.data },
      ...(n.parentId ? { parentId: n.parentId } : {}),
    })),
    edges: canvas.edges.map((e) => ({
      ...e,
      data: { ...e.data },
    })),
    metadata: canvas.metadata ? { ...canvas.metadata } : undefined,
    rawCode: canvas.rawCode,
  };
}

/** 修改节点 label */
function mutateNodeLabel(canvas: GraphCanvasState, nodeId: string, newLabel: string): void {
  const node = canvas.nodes.find((n) => n.id === nodeId);
  if (node) {
    node.data.label = newLabel;
  }
}

/** 修改节点 shape */
function mutateNodeShape(canvas: GraphCanvasState, nodeId: string, newShape: MermaidNode['data']['shape']): void {
  const node = canvas.nodes.find((n) => n.id === nodeId);
  if (node) {
    node.data.shape = newShape;
    node.type = newShape;
  }
}

/** 修改边 label */
function mutateEdgeLabel(canvas: GraphCanvasState, edgeIndex: number, newLabel: string): void {
  const edge = canvas.edges[edgeIndex];
  if (edge) {
    edge.data.label = newLabel;
  }
}

/** 添加节点（结构级变更） */
function addNode(canvas: GraphCanvasState, id: string, label: string): void {
  canvas.nodes.push({
    id,
    type: 'rect',
    position: { x: 0, y: 0 },
    data: { label, shape: 'rect' },
  });
}

/** 删除节点（结构级变更） */
function removeNode(canvas: GraphCanvasState, nodeId: string): void {
  const idx = canvas.nodes.findIndex((n) => n.id === nodeId);
  if (idx >= 0) {
    canvas.nodes.splice(idx, 1);
  }
}

/** 添加边（结构级变更） */
function addEdge(canvas: GraphCanvasState, id: string, source: string, target: string): void {
  canvas.edges.push({
    id,
    source,
    target,
    data: { edgeStyle: 'arrow' },
  });
}

/** 删除边（结构级变更） */
function removeEdge(canvas: GraphCanvasState, edgeIndex: number): void {
  canvas.edges.splice(edgeIndex, 1);
}

// ============================================================
// 1. isIncrementalChange: 属性级变更（应返回 true）
// ============================================================

describe('isIncrementalChange - 属性级变更', () => {
  it('节点 label 修改 → 增量', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    mutateNodeLabel(curr, 'A', 'Hi');

    expect(isIncrementalChange(curr, prev)).toBe(true);
  });

  it('节点 shape 修改 → 增量', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    mutateNodeShape(curr, 'A', 'rounded');

    expect(isIncrementalChange(curr, prev)).toBe(true);
  });

  it('边 label 修改 → 增量', () => {
    const code = `flowchart TD
    A[Hello] -->|Yes| B[World]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    mutateEdgeLabel(curr, 0, 'No');

    expect(isIncrementalChange(curr, prev)).toBe(true);
  });

  it('节点 style 修改 → 增量', () => {
    const code = `flowchart TD
    A[Hello]
    style A fill:#f00`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    const nodeA = curr.nodes.find((n) => n.id === 'A');
    if (nodeA) {
      (nodeA.data as Record<string, unknown>).styles = ['fill:#00f'];
    }

    expect(isIncrementalChange(curr, prev)).toBe(true);
  });

  it('无变更 → 增量（属性级，但无实际修改）', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);

    expect(isIncrementalChange(curr, prev)).toBe(true);
  });
});

// ============================================================
// 2. isIncrementalChange: 结构级变更（应返回 false）
// ============================================================

describe('isIncrementalChange - 结构级变更', () => {
  it('无前一次状态 → 结构级', () => {
    const code = `flowchart TD
    A[Hello]`;
    const curr = parse(code);

    expect(isIncrementalChange(curr, undefined)).toBe(false);
  });

  it('图类型变更 → 结构级', () => {
    const code = `flowchart TD
    A[Hello]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    curr.diagramType = 'sequenceDiagram' as GraphCanvasState['diagramType'];

    expect(isIncrementalChange(curr, prev)).toBe(false);
  });

  it('节点数量增加 → 结构级', () => {
    const code = `flowchart TD
    A[Hello]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    addNode(curr, 'B', 'World');

    expect(isIncrementalChange(curr, prev)).toBe(false);
  });

  it('节点数量减少 → 结构级', () => {
    const code = `flowchart TD
    A[Hello]
    B[World]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    removeNode(curr, 'B');

    expect(isIncrementalChange(curr, prev)).toBe(false);
  });

  it('边数量增加 → 结构级', () => {
    const code = `flowchart TD
    A[Hello]
    B[World]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    addEdge(curr, 'e1', 'A', 'B');

    expect(isIncrementalChange(curr, prev)).toBe(false);
  });

  it('边数量减少 → 结构级', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    removeEdge(curr, 0);

    expect(isIncrementalChange(curr, prev)).toBe(false);
  });

  it('节点 id 集合变更（替换） → 结构级', () => {
    const code = `flowchart TD
    A[Hello]
    B[World]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    removeNode(curr, 'B');
    addNode(curr, 'C', 'New');

    // 数量相同但 id 集合不同
    expect(isIncrementalChange(curr, prev)).toBe(false);
  });

  it('节点 parentId 变更（subgraph 结构变更）→ 结构级', () => {
    const code = `flowchart TD
    subgraph grp
      A[Hello]
    end
    B[World]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    const nodeB = curr.nodes.find((n) => n.id === 'B');
    if (nodeB) {
      nodeB.parentId = 'grp';
    }

    expect(isIncrementalChange(curr, prev)).toBe(false);
  });

  it('边 source 变更 → 结构级', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]
    C[New]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    curr.edges[0].source = 'C';

    expect(isIncrementalChange(curr, prev)).toBe(false);
  });

  it('边 target 变更 → 结构级', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]
    C[New]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    curr.edges[0].target = 'C';

    expect(isIncrementalChange(curr, prev)).toBe(false);
  });
});

// ============================================================
// 3. applyIncrementalChanges: 行级替换验证
// ============================================================

describe('applyIncrementalChanges - 行级替换', () => {
  it('节点 label 修改 → 替换对应行，保留其他行', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    mutateNodeLabel(curr, 'A', 'Hi');

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    expect(result).toContain('A[Hi]');
    expect(result).toContain('B[World]');
    expect(result).toContain('A[Hi] --> B[World]');
    // 保留 direction 行
    expect(result).toContain('flowchart TD');
  });

  it('节点 shape 修改 → 替换对应行', () => {
    const code = `flowchart TD
    A[Hello]
    B[World]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    mutateNodeShape(curr, 'A', 'rounded');

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    expect(result).toContain('A(Hello)');
    expect(result).toContain('B[World]');
  });

  it('边 label 修改 → 替换对应行', () => {
    const code = `flowchart TD
    A[Hello] -->|Yes| B[World]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    mutateEdgeLabel(curr, 0, 'No');

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    expect(result).toContain('A[Hello] -->|No| B[World]');
    expect(result).not.toContain('Yes');
  });

  it('多节点同时修改 label → 替换多行', () => {
    const code = `flowchart TD
    A[Hello]
    B[World]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    mutateNodeLabel(curr, 'A', 'New1');
    mutateNodeLabel(curr, 'B', 'New2');

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    expect(result).toContain('A[New1]');
    expect(result).toContain('B[New2]');
  });

  it('无变更 → 返回原始代码（不做修改）', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);

    const result = applyIncrementalChanges(code, curr, prev);
    // 无变更时返回原始代码（modified=false，返回 rawCode）
    expect(result).toBe(code);
  });
});

// ============================================================
// 4. applyIncrementalChanges: 格式保留验证
// ============================================================

describe('applyIncrementalChanges - 格式保留', () => {
  it('应保留空行', () => {
    const code = `flowchart TD

    A[Hello]

    B[World]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    mutateNodeLabel(curr, 'A', 'Hi');

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    // 空行应保留（原始格式不变）
    const resultLines = result!.split('\n');
    // Line 0: flowchart TD, Line 1: empty, Line 2: A[Hi], Line 3: empty, Line 4: B[World]
    expect(resultLines[0]).toBe('flowchart TD');
    expect(resultLines[1]).toBe('');
    expect(resultLines[2]).toBe('    A[Hi]');
    expect(resultLines[3]).toBe('');
    expect(resultLines[4]).toBe('    B[World]');
  });

  it('应保留原始缩进', () => {
    const code = `flowchart TD
      A[Hello] --> B[World]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    mutateNodeLabel(curr, 'A', 'Hi');

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    // 缩进应保留
    expect(result).toContain('      A[Hi] --> B[World]');
  });

  it('应保留节点顺序', () => {
    const code = `flowchart TD
    A[First]
    B[Second]
    C[Third]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    mutateNodeLabel(curr, 'B', 'Modified');

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    const lines = result!.split('\n');
    // 顺序: A, B, C 不变
    expect(lines[1].trim()).toContain('A[First]');
    expect(lines[2].trim()).toContain('B[Modified]');
    expect(lines[3].trim()).toContain('C[Third]');
  });

  it('应保留 subgraph 结构', () => {
    const code = `flowchart TB
    subgraph dev
      a1[a] --> a2[b]
    end`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    mutateNodeLabel(curr, 'a1', 'modified');

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    expect(result).toContain('subgraph dev');
    expect(result).toContain('a1[modified]');
    expect(result).toContain('a2[b]');
    expect(result).toContain('end');
  });

  // Bug8: 方向变更应通过增量序列化更新 flowchart 方向行
  it('Bug8: 方向变更 → 更新 flowchart 方向行，保留其他行格式', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    curr.direction = 'LR';

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    // 方向行应更新为 LR
    expect(result).toContain('flowchart LR');
    expect(result).not.toContain('flowchart TD');
    // 其他行应保留
    expect(result).toContain('A[Hello] --> B[World]');
  });

  it('Bug8: 方向变更 TB→BT → 更新方向行', () => {
    const code = `flowchart TB
    A[Hello]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    curr.direction = 'BT';

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    expect(result).toContain('flowchart BT');
    expect(result).not.toContain('flowchart TB');
  });

  it('Bug8: 方向变更保留注释和空行', () => {
    const code = `flowchart TD
    %% This is a comment

    A[Hello]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    curr.direction = 'RL';

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    expect(result).toContain('flowchart RL');
    // 注释和空行应保留
    expect(result).toContain('%% This is a comment');
    expect(result).toContain('A[Hello]');
  });

  it('Bug8: graph 关键字方向变更保留原关键字', () => {
    const code = `graph TD
    A[Hello]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    curr.direction = 'LR';

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    // Bug7: 保留用户原始关键字 graph，不强制改写为 flowchart
    expect(result).toContain('graph LR');
    expect(result).not.toContain('flowchart');
  });
});

// ============================================================
// 5. applyIncrementalChanges: 回退逻辑验证
// ============================================================

describe('applyIncrementalChanges - 回退逻辑', () => {
  it('无前一次状态 → 返回 null（回退全量）', () => {
    const code = `flowchart TD
    A[Hello]`;
    const curr = parse(code);

    const result = applyIncrementalChanges(code, curr, undefined);
    expect(result).toBeNull();
  });

  it('Bug7: 节点增加 → 增量追加顶点定义行', () => {
    const code = `flowchart TD
    A[Hello]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    addNode(curr, 'B', 'World');

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    expect(result).toContain('A[Hello]');
    expect(result).toContain('B[World]');
    // 保留原始行
    expect(result).toContain('flowchart TD');
  });

  it('Bug7: 边删除 → 增量删除边定义行', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    removeEdge(curr, 0);

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    // 边定义行被删除，但顶点定义保留
    expect(result).not.toContain('-->');
    expect(result).toContain('flowchart TD');
  });

  it('Bug7: 删除 subgraph → 完整移除 subgraph ... end 块，不残留 end', () => {
    const code = `flowchart TD
    subgraph sg1[SubGraph]
      A[Hello]
      B[World]
    end
    C[Top]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    // 删除子图及其所有子节点（模拟真实删除行为）
    removeNode(curr, 'sg1');
    removeNode(curr, 'A');
    removeNode(curr, 'B');

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    expect(result).not.toContain('subgraph sg1');
    expect(result).not.toContain(/\bend\b/); // 不应残留任何 end
    expect(result).toContain('C[Top]');
    expect(result).toContain('flowchart TD');

    // 重新解析结果，不应出现 got 'end' 错误
    const reparsed = parseFlowchartCode(result!);
    expect(reparsed.success).toBe(true);
  });

  it('Bug7: 删除嵌套 subgraph → 仅移除目标子图块，保留外层结构', () => {
    const code = `flowchart TD
    subgraph outer[Outer]
      subgraph inner[Inner]
        A[Hello]
      end
      B[World]
    end
    C[Top]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    // 删除内层子图及其子节点
    removeNode(curr, 'inner');
    removeNode(curr, 'A');

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    expect(result).not.toContain('subgraph inner');
    expect(result).toContain('subgraph outer');
    expect(result).toContain('B[World]');
    expect(result).toContain('C[Top]');

    // 重新解析结果，不应出现 got 'end' 错误
    const reparsed = parseFlowchartCode(result!);
    expect(reparsed.success).toBe(true);
  });

  it('Bug7: 先删除子图前普通节点、再删除子图 → 仍能正确定位 subgraph 块', () => {
    const code = `flowchart TD
    A[Hello]
    subgraph sg[SubGraph]
      B[World]
    end
    C[Top]`;
    // 第一次增量：删除 A
    const firstPrev = parse(code);
    const firstCurr = cloneCanvas(firstPrev);
    removeNode(firstCurr, 'A');
    const firstResult = applyIncrementalChanges(code, firstCurr, firstPrev);
    expect(firstResult).not.toBeNull();

    // 第二次增量：在上次结果基础上删除子图 sg
    const secondPrev = parse(firstResult!);
    const secondCurr = cloneCanvas(secondPrev);
    removeNode(secondCurr, 'sg');
    removeNode(secondCurr, 'B');
    const secondResult = applyIncrementalChanges(firstResult!, secondCurr, secondPrev);
    expect(secondResult).not.toBeNull();
    expect(secondResult).not.toContain('subgraph sg');
    expect(secondResult).not.toContain(/\bend\b/);
    expect(secondResult).toContain('C[Top]');

    const reparsed = parseFlowchartCode(secondResult!);
    expect(reparsed.success).toBe(true);
  });

  it('Bug7: 画布连续操作场景下删除子图 → _sourceLine 可能已过时，应通过 ID 定位 subgraph 块', () => {
    const originalCode = `flowchart TD
    A[Hello]
    subgraph sg[SubGraph]
      B[World]
    end
    C[Top]`;
    const codeAfterDeleteA = `flowchart TD
    subgraph sg[SubGraph]
      B[World]
    end
    C[Top]`;

    // 模拟真实画布操作：_sourceLine 仍来自原始解析，但 rawCode 已更新
    const prev = parse(originalCode);
    const curr = cloneCanvas(prev);
    removeNode(curr, 'sg');
    removeNode(curr, 'B');

    const result = applyIncrementalChanges(codeAfterDeleteA, curr, prev);
    expect(result).not.toBeNull();
    expect(result).not.toContain('subgraph sg');
    expect(result).not.toContain(/\bend\b/);
    expect(result).toContain('C[Top]');

    const reparsed = parseFlowchartCode(result!);
    expect(reparsed.success).toBe(true);
  });

  it('无 rawCode 时仍可尝试增量（基于传入的 rawCode 参数）', () => {
    const code = `flowchart TD
    A[Hello]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    mutateNodeLabel(curr, 'A', 'Hi');
    // 删除 curr.rawCode（模拟无 rawCode 场景）
    curr.rawCode = undefined;

    // applyIncrementalChanges 接受 rawCode 作为参数，不依赖 canvas.rawCode
    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    expect(result).toContain('A[Hi]');
  });
});

// ============================================================
// 6. applyIncrementalChanges: 边样式修改验证
// ============================================================

describe('applyIncrementalChanges - 边样式修改', () => {
  it('边 edgeStyle 修改 → 增量替换', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    curr.edges[0].data.edgeStyle = 'dotted-arrow';

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    // 边符号应从 --> 变为 -.->，顶点定义保留
    expect(result).toContain('A[Hello] -.-> B[World]');
  });

  it('边 interpolate 修改 → 增量替换', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    (curr.edges[0].data as Record<string, unknown>).interpolate = 'basis';

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    // interpolate 不影响边行本身，但应触发增量序列化
    expect(result).toContain('A[Hello] --> B[World]');
  });
});

// ============================================================
// 7. _sourceLine 推断验证
// ============================================================

describe('_sourceLine 推断', () => {
  it('解析后节点应有 _sourceLine', () => {
    const code = `flowchart TD
    A[Hello]
    B[World]`;
    const canvas = parse(code);

    const nodeA = canvas.nodes.find((n) => n.id === 'A');
    const nodeB = canvas.nodes.find((n) => n.id === 'B');
    expect(nodeA).toBeDefined();
    expect(nodeB).toBeDefined();

    const lineA = (nodeA?.data as Record<string, unknown>)._sourceLine;
    const lineB = (nodeB?.data as Record<string, unknown>)._sourceLine;
    expect(lineA).toBe(1); // 第 2 行（0-based）
    expect(lineB).toBe(2); // 第 3 行（0-based）
  });

  it('解析后边应有 _sourceLine', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]`;
    const canvas = parse(code);

    const edge = canvas.edges[0];
    expect(edge).toBeDefined();

    const line = (edge.data as Record<string, unknown>)._sourceLine;
    expect(line).toBe(1); // 第 2 行（0-based）
  });

  it('解析后 subgraph 节点应有 _sourceLine', () => {
    const code = `flowchart TB
    subgraph dev
      a1[a]
    end`;
    const canvas = parse(code);

    const devNode = canvas.nodes.find((n) => n.id === 'dev');
    expect(devNode).toBeDefined();

    const line = (devNode?.data as Record<string, unknown>)._sourceLine;
    expect(line).toBe(1); // subgraph 行
  });

  it('注释行不应被分配 _sourceLine', () => {
    const code = `flowchart TD
%% comment
    A[Hello]`;
    const canvas = parse(code);

    const nodeA = canvas.nodes.find((n) => n.id === 'A');
    const line = (nodeA?.data as Record<string, unknown>)._sourceLine;
    // A 在第 3 行（0-based 2），跳过注释行
    expect(line).toBe(2);
  });
});

// ============================================================
// 8. Bug9: 删除边/节点时保留幸存顶点定义
// ============================================================

describe('Bug9: 删除边/节点时保留幸存顶点定义', () => {
  it('删除单边行时，target 顶点定义应保留为独立行', () => {
    const code = `flowchart TD
    A --> B{World}`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    removeEdge(curr, 0);

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    // 边符号应被删除
    expect(result).not.toContain('-->');
    // B 的顶点定义应保留
    expect(result).toContain('B{World}');

    // 重新解析应成功
    const reparsed = parseFlowchartCode(result!);
    expect(reparsed.success).toBe(true);
    const nodeB = reparsed.canvas.nodes.find((n) => n.id === 'B');
    expect(nodeB?.data.shape).toBe('diamond');
    expect(nodeB?.data.label).toBe('World');
  });

  it('删除边行时，source 和 target 顶点定义都应保留', () => {
    const code = `flowchart TD
    A[Hello] --> B{World}`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    removeEdge(curr, 0);

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    expect(result).not.toContain('-->');
    expect(result).toContain('A[Hello]');
    expect(result).toContain('B{World}');

    const reparsed = parseFlowchartCode(result!);
    expect(reparsed.success).toBe(true);
  });

  it('删除节点时，其关联边行中的幸存顶点定义应保留', () => {
    const code = `flowchart TD
    N[准备] --> O[调用验证]
    O --> P{验证通过?}`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    // 删除 O 及其关联边
    removeNode(curr, 'O');
    for (let i = curr.edges.length - 1; i >= 0; i--) {
      const e = curr.edges[i];
      if (e.source === 'O' || e.target === 'O') {
        curr.edges.splice(i, 1);
      }
    }

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    // O 应被删除
    expect(result).not.toContain('O[');
    // 与 O 关联的边应被删除
    expect(result).not.toContain('--> O');
    expect(result).not.toContain('O -->');
    // P 的顶点定义应作为独立行保留
    expect(result).toContain('P{验证通过?}');

    const reparsed = parseFlowchartCode(result!);
    expect(reparsed.success).toBe(true);
    const nodeP = reparsed.canvas.nodes.find((n) => n.id === 'P');
    expect(nodeP).toBeDefined();
    expect(nodeP?.data.shape).toBe('diamond');
  });

  it('删除子图内节点时，子图内幸存顶点定义应保留', () => {
    const code = `flowchart TB
    subgraph Validate
        N[准备] --> O[调用验证]
        O --> P{验证通过?}
    end`;
    const prev = parse(code);
    const curr = cloneCanvas(prev);
    removeNode(curr, 'O');
    for (let i = curr.edges.length - 1; i >= 0; i--) {
      const e = curr.edges[i];
      if (e.source === 'O' || e.target === 'O') {
        curr.edges.splice(i, 1);
      }
    }

    const result = applyIncrementalChanges(code, curr, prev);
    expect(result).not.toBeNull();
    expect(result).not.toContain('O[');
    expect(result).toContain('subgraph Validate');
    expect(result).toContain('P{验证通过?}');
    expect(result).toContain('end');

    const reparsed = parseFlowchartCode(result!);
    expect(reparsed.success).toBe(true);
  });

  it('连续删除后，幸存顶点的 _sourceLine 应指向新位置', () => {
    const code = `flowchart TD
    A[Hello] --> B{World}
    B --> C[Done]`;
    const prev = parse(code);

    // 第一次删除：移除 B --> C
    const curr1 = cloneCanvas(prev);
    const edgeIdx1 = curr1.edges.findIndex((e) => e.source === 'B' && e.target === 'C');
    removeEdge(curr1, edgeIdx1);

    const result1 = applyIncrementalChanges(code, curr1, prev);
    expect(result1).not.toBeNull();
    expect(result1).toContain('C[Done]');

    // 第二次删除：移除 A --> B
    const prev2 = parse(result1!);
    const curr2 = cloneCanvas(prev2);
    const edgeIdx2 = curr2.edges.findIndex((e) => e.source === 'A' && e.target === 'B');
    removeEdge(curr2, edgeIdx2);

    const result2 = applyIncrementalChanges(result1!, curr2, prev2);
    expect(result2).not.toBeNull();
    expect(result2).toContain('A[Hello]');
    expect(result2).toContain('B{World}');
    expect(result2).toContain('C[Done]');
    expect(result2).not.toContain('-->');

    const reparsed = parseFlowchartCode(result2!);
    expect(reparsed.success).toBe(true);
  });
});

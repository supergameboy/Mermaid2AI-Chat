/**
 * state 行为验证测试 — M5-6
 *
 * 验证 stateDiagram-v2 解析器、序列化器的行为符合官方 mermaid 标准
 * 覆盖：官方示例、状态类型覆盖、转换关系、复合状态、Note、classDef/style、round-trip
 *
 * 测试策略：行为验证（不测试实现细节，只测试接口和行为）
 */

import { describe, it, expect } from 'vitest';
import { parseState } from '../../src/parser/state/state-parser.js';
import { serializeState } from '../../src/serializer/state-serializer.js';
import type { GraphCanvasState, StateNodeType } from '../../src/types.js';

// ============================================================
// 辅助函数
// ============================================================

/** 解析代码并返回 CanvasState（断言成功） */
function parse(code: string): GraphCanvasState {
  const result = parseState(code);
  expect(result.success).toBe(true);
  return result.canvas as GraphCanvasState;
}

/** 获取节点状态类型 */
function getStateType(canvas: GraphCanvasState, nodeId: string): StateNodeType | undefined {
  const node = canvas.nodes.find((n) => n.id === nodeId);
  return node?.data.stateType;
}

/** round-trip: 代码 → 解析 → 序列化 → 代码 → 解析 → canvas */
function roundTrip(code: string): {
  canvas1: GraphCanvasState;
  code2: string;
  canvas2: GraphCanvasState;
  success: boolean;
} {
  const parsed1 = parseState(code);
  if (!parsed1.success) {
    throw new Error(`第一次解析失败: ${parsed1.errors.map((e) => e.message).join(', ')}`);
  }

  const serialized = serializeState(parsed1.canvas);
  if (serialized.errors.length > 0) {
    throw new Error(`序列化失败: ${serialized.errors.map((e) => e.message).join(', ')}`);
  }

  const parsed2 = parseState(serialized.mermaid);
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
  it('应正确解析 Basic State Diagram 示例', () => {
    const code = `stateDiagram-v2
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]`;

    const canvas = parse(code);

    // 4 个状态节点（Still, Moving, Crash + start/end 通过 [*] 处理）
    const namedStates = canvas.nodes.filter((n) => n.data.stateType === 'default' || n.data.stateType === undefined);
    expect(namedStates.length).toBeGreaterThanOrEqual(3);

    // 应有 start 和 end 节点（[*] 解析为 start/end）
    const startNode = canvas.nodes.find((n) => n.data.stateType === 'start');
    const endNode = canvas.nodes.find((n) => n.data.stateType === 'end');
    expect(startNode).toBeDefined();
    expect(endNode).toBeDefined();

    // 6 条转换关系
    expect(canvas.edges).toHaveLength(6);
  });

  it('应正确解析 Order Lifecycle with Composite States 示例', () => {
    const code = `stateDiagram-v2
    direction LR
    [*] --> Placed
    Placed --> Paid : payment received
    Placed --> Cancelled : customer cancels
    Paid --> Fulfilment

    state Fulfilment {
        [*] --> Packing
        Packing --> Shipped : handed to courier
        Shipped --> [*]
    }

    Fulfilment --> Delivered : courier confirms
    Delivered --> [*]
    Cancelled --> [*]

    note right of Paid
        Payment can be card,
        wallet, or bank transfer
    end note`;

    const canvas = parse(code);

    // 顶层状态：Placed, Paid, Cancelled, Fulfilment, Delivered + start/end
    const topLevelStates = canvas.nodes.filter((n) => n.parentId === undefined);
    expect(topLevelStates.length).toBeGreaterThanOrEqual(5);

    // 复合状态 Fulfilment
    const composites = canvas.metadata?.composites;
    expect(composites).toBeDefined();
    const fulfilmentComposite = composites?.find((c) => c.stateId === 'Fulfilment');
    expect(fulfilmentComposite).toBeDefined();
    expect(fulfilmentComposite?.childStateIds).toContain('Packing');
    expect(fulfilmentComposite?.childStateIds).toContain('Shipped');

    // Note
    const notes = canvas.metadata?.stateNotes;
    expect(notes).toBeDefined();
    expect(notes?.length).toBe(1);
    expect(notes?.[0].stateId).toBe('Paid');
    expect(notes?.[0].position).toBe('right of');

    // direction LR
    expect(canvas.metadata?.stateDirection).toBe('LR');
  });

  it('应正确解析 Choice and Concurrency 示例', () => {
    const code = `stateDiagram-v2
    state battery_check <<choice>>
    [*] --> PowerOn
    PowerOn --> battery_check
    battery_check --> LowPowerMode : battery < 20%
    battery_check --> Active : battery >= 20%

    state Active {
        [*] --> Playing
        Playing --> Paused : pause
        Paused --> Playing : play
        --
        [*] --> ScreenOn
        ScreenOn --> ScreenDimmed : idle 30s
        ScreenDimmed --> ScreenOn : touch
    }

    LowPowerMode --> [*] : power off
    Active --> [*] : power off`;

    const canvas = parse(code);

    // choice 状态
    const choiceNode = canvas.nodes.find((n) => n.id === 'battery_check');
    expect(choiceNode).toBeDefined();
    expect(choiceNode?.data.stateType).toBe('choice');

    // 复合状态 Active（含并发区域 --）
    const activeComposite = canvas.metadata?.composites?.find((c) => c.stateId === 'Active');
    expect(activeComposite).toBeDefined();
    expect(activeComposite?.childStateIds).toContain('Playing');
    expect(activeComposite?.childStateIds).toContain('Paused');
    expect(activeComposite?.childStateIds).toContain('ScreenOn');
    expect(activeComposite?.childStateIds).toContain('ScreenDimmed');

    // 应有 divider 节点（-- 分隔符）
    const dividerNodes = canvas.nodes.filter((n) => n.data.stateType === 'divider');
    expect(dividerNodes.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// 状态类型覆盖（7 种）
// ============================================================

describe('状态类型覆盖', () => {
  it('应正确解析 default 状态', () => {
    const code = `stateDiagram-v2
    [*] --> State1
    State1 --> [*]`;
    const canvas = parse(code);
    const node = canvas.nodes.find((n) => n.id === 'State1');
    expect(node).toBeDefined();
    expect(node?.data.stateType ?? 'default').toBe('default');
  });

  it('应正确解析 start 状态（[*] 作为 source）', () => {
    const code = `stateDiagram-v2
    [*] --> State1`;
    const canvas = parse(code);
    const startNode = canvas.nodes.find((n) => n.data.stateType === 'start');
    expect(startNode).toBeDefined();
  });

  it('应正确解析 end 状态（[*] 作为 target）', () => {
    const code = `stateDiagram-v2
    State1 --> [*]`;
    const canvas = parse(code);
    const endNode = canvas.nodes.find((n) => n.data.stateType === 'end');
    expect(endNode).toBeDefined();
  });

  it('应正确解析 choice 状态（<<choice>>）', () => {
    const code = `stateDiagram-v2
    state check <<choice>>
    [*] --> check
    check --> A : yes
    check --> B : no`;
    const canvas = parse(code);
    expect(getStateType(canvas, 'check')).toBe('choice');
  });

  it('应正确解析 fork 状态（<<fork>>）', () => {
    const code = `stateDiagram-v2
    state fork1 <<fork>>
    [*] --> fork1
    fork1 --> A
    fork1 --> B`;
    const canvas = parse(code);
    expect(getStateType(canvas, 'fork1')).toBe('fork');
  });

  it('应正确解析 join 状态（<<join>>）', () => {
    const code = `stateDiagram-v2
    state join1 <<join>>
    A --> join1
    B --> join1
    join1 --> [*]`;
    const canvas = parse(code);
    expect(getStateType(canvas, 'join1')).toBe('join');
  });
});

// ============================================================
// 转换关系
// ============================================================

describe('转换关系', () => {
  it('应解析带标签的转换', () => {
    const code = `stateDiagram-v2
    [*] --> Idle
    Idle --> Active : start
    Active --> Idle : stop
    Idle --> [*]`;
    const canvas = parse(code);

    const startEdge = canvas.edges.find((e) => e.data.label === 'start');
    const stopEdge = canvas.edges.find((e) => e.data.label === 'stop');
    expect(startEdge).toBeDefined();
    expect(stopEdge).toBeDefined();
  });

  it('应解析 [*] 作为 source/target 的转换', () => {
    const code = `stateDiagram-v2
    [*] --> A
    A --> [*]`;
    const canvas = parse(code);

    // 2 条边
    expect(canvas.edges).toHaveLength(2);

    // 应有 start 和 end 节点
    const startNode = canvas.nodes.find((n) => n.data.stateType === 'start');
    const endNode = canvas.nodes.find((n) => n.data.stateType === 'end');
    expect(startNode).toBeDefined();
    expect(endNode).toBeDefined();
  });
});

// ============================================================
// 复合状态
// ============================================================

describe('复合状态', () => {
  it('应解析复合状态及其子状态', () => {
    const code = `stateDiagram-v2
    [*] --> Outer
    state Outer {
        [*] --> Inner1
        Inner1 --> Inner2
        Inner2 --> [*]
    }
    Outer --> [*]`;
    const canvas = parse(code);

    const composite = canvas.metadata?.composites?.find((c) => c.stateId === 'Outer');
    expect(composite).toBeDefined();
    expect(composite?.childStateIds).toContain('Inner1');
    expect(composite?.childStateIds).toContain('Inner2');
  });

  it('应解析嵌套复合状态', () => {
    const code = `stateDiagram-v2
    [*] --> A
    state A {
        [*] --> B
        state B {
            [*] --> C
            C --> [*]
        }
        B --> [*]
    }
    A --> [*]`;
    const canvas = parse(code);

    const compositeA = canvas.metadata?.composites?.find((c) => c.stateId === 'A');
    const compositeB = canvas.metadata?.composites?.find((c) => c.stateId === 'B');
    expect(compositeA).toBeDefined();
    expect(compositeB).toBeDefined();
    expect(compositeA?.childStateIds).toContain('B');
    expect(compositeB?.childStateIds).toContain('C');
  });

  it('应解析复合状态内的并发区域（-- 分隔符）', () => {
    const code = `stateDiagram-v2
    [*] --> Active
    state Active {
        [*] --> Playing
        Playing --> Paused
        --
        [*] --> ScreenOn
        ScreenOn --> ScreenOff
    }
    Active --> [*]`;
    const canvas = parse(code);

    const composite = canvas.metadata?.composites?.find((c) => c.stateId === 'Active');
    expect(composite).toBeDefined();
    expect(composite?.childStateIds).toContain('Playing');
    expect(composite?.childStateIds).toContain('Paused');
    expect(composite?.childStateIds).toContain('ScreenOn');
    expect(composite?.childStateIds).toContain('ScreenOff');

    // 应有 divider 节点
    const dividers = canvas.nodes.filter((n) => n.data.stateType === 'divider');
    expect(dividers.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// Note
// ============================================================

describe('Note', () => {
  it('应解析 note right of', () => {
    const code = `stateDiagram-v2
    [*] --> State1
    note right of State1
        This is a note
    end note
    State1 --> [*]`;
    const canvas = parse(code);

    const notes = canvas.metadata?.stateNotes;
    expect(notes).toBeDefined();
    expect(notes?.length).toBe(1);
    expect(notes?.[0].stateId).toBe('State1');
    expect(notes?.[0].position).toBe('right of');
    expect(notes?.[0].label).toContain('This is a note');
  });

  it('应解析 note left of', () => {
    const code = `stateDiagram-v2
    [*] --> State1
    note left of State1
        Left note
    end note
    State1 --> [*]`;
    const canvas = parse(code);

    const notes = canvas.metadata?.stateNotes;
    expect(notes?.[0].position).toBe('left of');
  });
});

// ============================================================
// classDef / style
// ============================================================

describe('classDef / style', () => {
  it('应解析 classDef 定义', () => {
    const code = `stateDiagram-v2
    [*] --> State1
    classDef red fill:#f00,stroke:#333
    State1 --> [*]`;
    const canvas = parse(code);

    const classDefs = canvas.metadata?.stateClassDefs;
    expect(classDefs).toBeDefined();
    expect(classDefs?.length).toBe(1);
    expect(classDefs?.[0].name).toBe('red');
    expect(classDefs?.[0].style).toContain('fill:#f00');
  });

  it('应解析 style 语句', () => {
    const code = `stateDiagram-v2
    [*] --> State1
    style State1 fill:#f9f,stroke:#333
    State1 --> [*]`;
    const canvas = parse(code);

    const node = canvas.nodes.find((n) => n.id === 'State1');
    expect(node).toBeDefined();
    // style 语句存储在节点的 style 字段或 styles 扩展字段
    const style = node?.data.style;
    const styles = (node?.data as Record<string, unknown>).styles as string[] | undefined;
    expect(style !== undefined || styles !== undefined).toBe(true);
  });
});

// ============================================================
// direction
// ============================================================

describe('direction', () => {
  it('应解析 direction LR', () => {
    const code = `stateDiagram-v2
    direction LR
    [*] --> A
    A --> [*]`;
    const canvas = parse(code);
    expect(canvas.metadata?.stateDirection).toBe('LR');
  });

  it('应解析 direction TB', () => {
    const code = `stateDiagram-v2
    direction TB
    [*] --> A
    A --> [*]`;
    const canvas = parse(code);
    expect(canvas.metadata?.stateDirection).toBe('TB');
  });
});

// ============================================================
// Round-trip 等价测试
// ============================================================

describe('Round-trip 等价', () => {
  it('基础 round-trip 应保持等价', () => {
    const code = `stateDiagram-v2
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]`;

    const result = roundTrip(code);
    expect(result.success).toBe(true);

    // 节点数等价
    expect(result.canvas2.nodes.length).toBe(result.canvas1.nodes.length);
    // 边数等价
    expect(result.canvas2.edges.length).toBe(result.canvas1.edges.length);
  });

  it('带标签的转换 round-trip 应保持等价', () => {
    const code = `stateDiagram-v2
    [*] --> Idle
    Idle --> Active : start
    Active --> Idle : stop
    Idle --> [*]`;

    const result = roundTrip(code);
    expect(result.success).toBe(true);
    expect(result.canvas2.edges.length).toBe(result.canvas1.edges.length);

    // 标签应保持
    const labels1 = result.canvas1.edges.map((e) => e.data.label).filter(Boolean).sort();
    const labels2 = result.canvas2.edges.map((e) => e.data.label).filter(Boolean).sort();
    expect(labels2).toEqual(labels1);
  });

  it('复合状态 round-trip 应保持等价', () => {
    const code = `stateDiagram-v2
    [*] --> Placed
    Placed --> Paid : payment received
    Paid --> Fulfilment

    state Fulfilment {
        [*] --> Packing
        Packing --> Shipped : handed to courier
        Shipped --> [*]
    }

    Fulfilment --> Delivered : courier confirms
    Delivered --> [*]`;

    const result = roundTrip(code);
    expect(result.success).toBe(true);

    // 复合状态应保持
    const composites1 = result.canvas1.metadata?.composites ?? [];
    const composites2 = result.canvas2.metadata?.composites ?? [];
    expect(composites2.length).toBe(composites1.length);

    // 子状态应保持
    for (const c1 of composites1) {
      const c2 = composites2.find((c) => c.stateId === c1.stateId);
      expect(c2).toBeDefined();
      expect(c2?.childStateIds.length).toBe(c1.childStateIds.length);
    }
  });

  it('choice 状态 round-trip 应保持等价', () => {
    const code = `stateDiagram-v2
    state check <<choice>>
    [*] --> check
    check --> A : yes
    check --> B : no
    A --> [*]
    B --> [*]`;

    const result = roundTrip(code);
    expect(result.success).toBe(true);

    // choice 状态类型应保持
    const choice1 = result.canvas1.nodes.find((n) => n.data.stateType === 'choice');
    const choice2 = result.canvas2.nodes.find((n) => n.data.stateType === 'choice');
    expect(choice1).toBeDefined();
    expect(choice2).toBeDefined();
  });

  it('Note round-trip 应保持等价', () => {
    const code = `stateDiagram-v2
    [*] --> State1
    note right of State1
        This is a note
    end note
    State1 --> [*]`;

    const result = roundTrip(code);
    expect(result.success).toBe(true);

    const notes1 = result.canvas1.metadata?.stateNotes ?? [];
    const notes2 = result.canvas2.metadata?.stateNotes ?? [];
    expect(notes2.length).toBe(notes1.length);
    if (notes1.length > 0 && notes2.length > 0) {
      expect(notes2[0].position).toBe(notes1[0].position);
    }
  });
});

// ============================================================
// 边界场景
// ============================================================

describe('边界场景', () => {
  it('应处理空状态图（仅 direction）', () => {
    const code = `stateDiagram-v2
    direction LR`;
    const canvas = parse(code);
    expect(canvas.diagramType).toBe('stateDiagram');
    expect(canvas.nodes).toHaveLength(0);
    expect(canvas.edges).toHaveLength(0);
  });

  it('应处理只有 start/end 的最小状态图', () => {
    const code = `stateDiagram-v2
    [*] --> [*]`;
    const canvas = parse(code);
    expect(canvas.edges).toHaveLength(1);
    // 应有 start 和 end 节点
    expect(canvas.nodes.some((n) => n.data.stateType === 'start')).toBe(true);
    expect(canvas.nodes.some((n) => n.data.stateType === 'end')).toBe(true);
  });

  it('应处理状态描述（state "Label" as id）', () => {
    const code = `stateDiagram-v2
    [*] --> S1
    state "Active State" as S1
    S1 --> [*]`;
    const canvas = parse(code);
    const node = canvas.nodes.find((n) => n.id === 'S1');
    expect(node).toBeDefined();
    expect(node?.data.label).toBe('Active State');
  });
});

/**
 * sequence-serializer 行为验证测试
 *
 * 验证 serializeSequence 的行为：
 *   - 基本序列化
 *   - 参与者序列化
 *   - 消息序列化
 *   - Note 序列化
 *   - 块结构序列化
 *   - activate 序列化
 *   - autonumber 序列化
 *   - box 序列化
 *   - 箭头类型序列化
 */
import { describe, it, expect } from 'vitest';
import { serializeSequence } from '../../src/serializer/sequence/sequence-serializer.js';
import type { GraphCanvasState, MermaidNode, MermaidEdge, SequenceArrowType } from '../../src/types.js';

/** 创建 sequence CanvasState */
function createSequenceCanvas(
  nodes: MermaidNode[] = [],
  edges: MermaidEdge[] = [],
  metadata: Record<string, unknown> = {},
): GraphCanvasState {
  return {
    diagramType: 'sequenceDiagram',
    nodes,
    edges,
    metadata,
  };
}

/** 创建参与者节点 */
function createParticipantNode(id: string, label?: string, actorType = 'participant'): MermaidNode {
  return {
    id,
    type: 'sequence-participant',
    position: { x: 0, y: 0 },
    data: {
      label: label ?? id,
      shape: 'rect',
      participantType: actorType === 'actor' ? 'actor' : 'participant',
      sequenceActorType: actorType,
    },
  };
}

/** 创建消息边 */
function createMessageEdge(
  id: string,
  source: string,
  target: string,
  message: string,
  messageType: SequenceArrowType = 'solid-arrow',
  sequence = 0,
  activate = false,
): MermaidEdge {
  return {
    id,
    source,
    target,
    type: 'sequence-message',
    data: {
      edgeStyle: messageType.startsWith('dotted') ? 'dotted-arrow' : 'arrow',
      label: message,
      messageType,
      sequence,
      ...(activate ? { activate: true } : {}),
    },
  };
}

describe('SequenceSerializer 行为验证', () => {
  describe('基本序列化', () => {
    it('应序列化空 sequence', () => {
      const canvas = createSequenceCanvas();
      const result = serializeSequence(canvas);

      expect(result.errors).toHaveLength(0);
      expect(result.mermaid).toContain('sequenceDiagram');
    });

    it('应拒绝非 sequenceDiagram 类型', () => {
      const canvas = {
        diagramType: 'flowchart' as const,
        nodes: [],
        edges: [],
        direction: 'TB' as const,
      };
      const result = serializeSequence(canvas);

      expect(result.errors).toHaveLength(1);
      expect(result.mermaid).toBe('');
    });
  });

  describe('参与者序列化', () => {
    it('应序列化 participant', () => {
      const canvas = createSequenceCanvas([
        createParticipantNode('A', 'Alice'),
        createParticipantNode('B', 'Bob'),
      ]);
      const result = serializeSequence(canvas);

      expect(result.mermaid).toContain('participant A as Alice');
      expect(result.mermaid).toContain('participant B as Bob');
    });

    it('应序列化 actor', () => {
      const canvas = createSequenceCanvas([
        createParticipantNode('A', 'Alice', 'actor'),
      ]);
      const result = serializeSequence(canvas);

      expect(result.mermaid).toContain('actor A as Alice');
    });

    it('应序列化无别名的 participant', () => {
      const canvas = createSequenceCanvas([
        createParticipantNode('A', 'A'),
      ]);
      const result = serializeSequence(canvas);

      expect(result.mermaid).toContain('participant A');
      expect(result.mermaid).not.toContain('as A');
    });
  });

  describe('消息序列化', () => {
    it('应序列化基本消息', () => {
      const canvas = createSequenceCanvas(
        [createParticipantNode('A'), createParticipantNode('B')],
        [createMessageEdge('e1', 'A', 'B', 'Hello')],
      );
      const result = serializeSequence(canvas);

      expect(result.mermaid).toContain('A->>B: Hello');
    });

    it('应序列化点线箭头', () => {
      const canvas = createSequenceCanvas(
        [createParticipantNode('A'), createParticipantNode('B')],
        [createMessageEdge('e1', 'A', 'B', 'Hi', 'dotted-arrow')],
      );
      const result = serializeSequence(canvas);

      expect(result.mermaid).toContain('A-->>B: Hi');
    });

    it('应序列化 activate', () => {
      const canvas = createSequenceCanvas(
        [createParticipantNode('A'), createParticipantNode('B')],
        [createMessageEdge('e1', 'A', 'B', 'Hello', 'solid-arrow', 0, true)],
      );
      const result = serializeSequence(canvas);

      expect(result.mermaid).toContain('A->>+B: Hello');
    });
  });

  describe('Note 序列化', () => {
    it('应序列化 Note left of', () => {
      const canvas = createSequenceCanvas(
        [createParticipantNode('A'), createParticipantNode('B')],
        [createMessageEdge('e1', 'A', 'B', 'Hello')],
        {
          notes: [{
            participantId: 'B',
            position: 'left',
            label: 'Note text',
            messageIndex: 0,
          }],
        },
      );
      const result = serializeSequence(canvas);

      expect(result.mermaid).toContain('Note left of B: Note text');
    });

    it('应序列化 Note right of', () => {
      const canvas = createSequenceCanvas(
        [createParticipantNode('A'), createParticipantNode('B')],
        [createMessageEdge('e1', 'A', 'B', 'Hello')],
        {
          notes: [{
            participantId: 'A',
            position: 'right',
            label: 'Right note',
            messageIndex: 0,
          }],
        },
      );
      const result = serializeSequence(canvas);

      expect(result.mermaid).toContain('Note right of A: Right note');
    });

    it('应序列化 Note over', () => {
      const canvas = createSequenceCanvas(
        [createParticipantNode('A'), createParticipantNode('B')],
        [createMessageEdge('e1', 'A', 'B', 'Hello')],
        {
          notes: [{
            participantId: 'A',
            position: 'over',
            label: 'Over note',
            messageIndex: 0,
          }],
        },
      );
      const result = serializeSequence(canvas);

      expect(result.mermaid).toContain('Note over A: Over note');
    });
  });

  describe('块结构序列化', () => {
    it('应序列化 alt 块', () => {
      const canvas = createSequenceCanvas(
        [createParticipantNode('A'), createParticipantNode('B')],
        [
          createMessageEdge('e1', 'A', 'B', 'Hello', 'solid-arrow', 0),
          createMessageEdge('e2', 'B', 'A', 'Hi', 'dotted-arrow', 1),
        ],
        {
          blocks: [{
            type: 'alt',
            label: 'Yes',
            startMessage: 0,
            endMessage: 2,
          }],
        },
      );
      const result = serializeSequence(canvas);

      expect(result.mermaid).toContain('alt Yes');
      expect(result.mermaid).toContain('end');
    });

    it('应序列化 loop 块', () => {
      const canvas = createSequenceCanvas(
        [createParticipantNode('A'), createParticipantNode('B')],
        [createMessageEdge('e1', 'A', 'B', 'Hello', 'solid-arrow', 0)],
        {
          blocks: [{
            type: 'loop',
            label: '3 times',
            startMessage: 0,
            endMessage: 1,
          }],
        },
      );
      const result = serializeSequence(canvas);

      expect(result.mermaid).toContain('loop 3 times');
      expect(result.mermaid).toContain('end');
    });

    it('应序列化 rect 块', () => {
      const canvas = createSequenceCanvas(
        [createParticipantNode('A'), createParticipantNode('B')],
        [createMessageEdge('e1', 'A', 'B', 'Hello', 'solid-arrow', 0)],
        {
          blocks: [{
            type: 'rect',
            label: 'rgb(255,0,0)',
            startMessage: 0,
            endMessage: 1,
          }],
        },
      );
      const result = serializeSequence(canvas);

      expect(result.mermaid).toContain('rect rgb(255,0,0)');
      expect(result.mermaid).toContain('end');
    });
  });

  describe('autonumber 序列化', () => {
    it('应序列化 autonumber', () => {
      const canvas = createSequenceCanvas(
        [createParticipantNode('A'), createParticipantNode('B')],
        [createMessageEdge('e1', 'A', 'B', 'Hello')],
        { autonumber: true },
      );
      const result = serializeSequence(canvas);

      expect(result.mermaid).toContain('autonumber');
    });

    it('未启用 autonumber 时不输出', () => {
      const canvas = createSequenceCanvas(
        [createParticipantNode('A'), createParticipantNode('B')],
        [createMessageEdge('e1', 'A', 'B', 'Hello')],
        { autonumber: false },
      );
      const result = serializeSequence(canvas);

      expect(result.mermaid).not.toContain('autonumber');
    });
  });

  describe('box 序列化', () => {
    it('应序列化 box 分组', () => {
      const canvas = createSequenceCanvas(
        [createParticipantNode('A'), createParticipantNode('B')],
        [createMessageEdge('e1', 'A', 'B', 'Hello')],
        {
          sequenceBoxes: [{
            id: 'box-0',
            name: 'Group1',
            color: 'rgba(0,255,0,0.5)',
            actorKeys: ['A', 'B'],
          }],
        },
      );
      const result = serializeSequence(canvas);

      expect(result.mermaid).toContain('box rgba(0,255,0,0.5) Group1');
      expect(result.mermaid).toContain('end');
    });

    it('应序列化无颜色的 box', () => {
      const canvas = createSequenceCanvas(
        [createParticipantNode('A')],
        [],
        {
          sequenceBoxes: [{
            id: 'box-0',
            name: 'Group1',
            color: 'transparent',
            actorKeys: ['A'],
          }],
        },
      );
      const result = serializeSequence(canvas);

      expect(result.mermaid).toContain('box Group1');
    });
  });

  describe('accTitle/accDescription 序列化', () => {
    it('应序列化无障碍信息', () => {
      const canvas = createSequenceCanvas(
        [createParticipantNode('A')],
        [],
        {
          accTitle: 'My Title',
          accDescription: 'My Description',
        },
      );
      const result = serializeSequence(canvas);

      expect(result.mermaid).toContain('accTitle: My Title');
      expect(result.mermaid).toContain('accDescr: My Description');
    });
  });
});

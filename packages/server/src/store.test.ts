/**
 * Store 测试 — 重点验证 viewport 同步、consumed 状态、画布操作
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './store.js';
import type { MermaidNode, MermaidEdge, Viewport } from '@mermaid-editor/serializer';

describe('EditorStore', () => {
  beforeEach(() => {
    // 重置 store 到初始状态
    useEditorStore.setState({
      nodes: [],
      edges: [],
      direction: 'TD',
      consumed: false,
      lastConsumedAt: null,
      canvasSource: null,
      title: null,
      viewport: { x: 0, y: 0, zoom: 1 },
    });
  });

  // === Viewport 同步 ===
  describe('viewport 同步', () => {
    it('should have initial viewport {x:0, y:0, zoom:1}', () => {
      const viewport = useEditorStore.getState().getViewport();
      expect(viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it('should update viewport via setViewport', () => {
      const newViewport: Viewport = { x: 100, y: 200, zoom: 1.5 };
      useEditorStore.getState().setViewport(newViewport);
      expect(useEditorStore.getState().getViewport()).toEqual(newViewport);
    });

    it('should not reset consumed when viewport changes', () => {
      // 先标记为已消费
      useEditorStore.getState().setConsumed(true);
      useEditorStore.getState().setCanvasSource('ai');
      expect(useEditorStore.getState().consumed).toBe(true);

      // 修改 viewport
      useEditorStore.getState().setViewport({ x: 50, y: 50, zoom: 0.8 });

      // consumed 应保持 true（viewport 不是内容编辑）
      expect(useEditorStore.getState().consumed).toBe(true);
      expect(useEditorStore.getState().canvasSource).toBe('ai');
    });

    it('should preserve canvasSource when viewport changes', () => {
      useEditorStore.getState().setCanvasSource('user');
      useEditorStore.getState().setViewport({ x: 10, y: 10, zoom: 1 });
      expect(useEditorStore.getState().canvasSource).toBe('user');
    });

    it('should handle zoom-only changes', () => {
      useEditorStore.getState().setViewport({ x: 0, y: 0, zoom: 2 });
      const vp = useEditorStore.getState().getViewport();
      expect(vp.zoom).toBe(2);
      expect(vp.x).toBe(0);
      expect(vp.y).toBe(0);
    });

    it('should handle negative coordinates', () => {
      useEditorStore.getState().setViewport({ x: -100, y: -200, zoom: 1 });
      expect(useEditorStore.getState().getViewport()).toEqual({ x: -100, y: -200, zoom: 1 });
    });
  });

  // === 画布操作 ===
  describe('画布操作', () => {
    const sampleNode: MermaidNode = {
      id: 'node1',
      type: 'rect',
      position: { x: 0, y: 0 },
      data: { label: '节点1', shape: 'rect' },
    };

    const sampleEdge: MermaidEdge = {
      id: 'edge1',
      source: 'node1',
      target: 'node2',
      data: { edgeStyle: 'arrow' },
    };

    it('should set canvas with setCanvas', () => {
      useEditorStore.getState().setCanvas({
        nodes: [sampleNode],
        edges: [sampleEdge],
        direction: 'LR',
      });
      const canvas = useEditorStore.getState().getCanvas();
      expect(canvas.nodes).toHaveLength(1);
      expect(canvas.edges).toHaveLength(1);
      expect(canvas.direction).toBe('LR');
    });

    it('should set direction via setCanvas', () => {
      useEditorStore.getState().setCanvas({ direction: 'LR' });
      expect(useEditorStore.getState().direction).toBe('LR');
    });
  });

  // === 消费状态 ===
  describe('消费状态', () => {
    it('should set consumed via setConsumed', () => {
      useEditorStore.getState().setConsumed(true);
      expect(useEditorStore.getState().consumed).toBe(true);
    });

    it('should set canvasSource via setCanvasSource', () => {
      useEditorStore.getState().setCanvasSource('ai');
      expect(useEditorStore.getState().canvasSource).toBe('ai');
    });

    it('should set lastConsumedAt via setLastConsumedAt', () => {
      const ts = Date.now();
      useEditorStore.getState().setLastConsumedAt(ts);
      expect(useEditorStore.getState().lastConsumedAt).toBe(ts);
    });

    it('should reset consumed via resetConsumed', () => {
      useEditorStore.getState().setConsumed(true);
      useEditorStore.getState().resetConsumed();
      expect(useEditorStore.getState().consumed).toBe(false);
    });

    it('should return consumed state via getConsumedState', () => {
      useEditorStore.getState().setConsumed(true);
      useEditorStore.getState().setCanvasSource('ai');
      useEditorStore.getState().setLastConsumedAt(1700000000000);
      const state = useEditorStore.getState().getConsumedState();
      expect(state).toEqual({
        consumed: true,
        lastConsumedAt: 1700000000000,
        canvasSource: 'ai',
      });
    });
  });

  // === 标题 ===
  describe('标题', () => {
    it('should set title via setTitle', () => {
      useEditorStore.getState().setTitle('测试标题');
      expect(useEditorStore.getState().getTitle()).toBe('测试标题');
    });

    it('should clear title with null', () => {
      useEditorStore.getState().setTitle('标题');
      useEditorStore.getState().setTitle(null);
      expect(useEditorStore.getState().getTitle()).toBeNull();
    });
  });

  // === getCanvas ===
  describe('getCanvas', () => {
    it('should return only canvas fields (nodes, edges, direction)', () => {
      const canvas = useEditorStore.getState().getCanvas();
      expect(canvas).toEqual({
        nodes: [],
        edges: [],
        direction: 'TD',
      });
      // 不应包含 viewport、consumed 等其他字段
      expect(canvas).not.toHaveProperty('viewport');
      expect(canvas).not.toHaveProperty('consumed');
    });
  });
});

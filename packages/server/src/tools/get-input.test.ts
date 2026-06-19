/**
 * get_input 工具测试 — 验证 4 种响应状态
 *
 * 重点测试：
 * - status: 'empty' — 空画布
 * - status: 'already_consumed' — 已消费
 * - status: 'ai_content' — AI 内容
 * - status: 'success' — 成功读取
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerGetInputTool } from './get-input.js';
import { useEditorStore } from '../store.js';
import type { MermaidNode } from '@mermaid-editor/serializer';

// === 模拟 McpServer ===
interface CapturedTool {
  name: string;
  description: string;
  schema: unknown;
  handler: (args: unknown) => Promise<unknown>;
}

class MockMcpServer {
  capturedTools: CapturedTool[] = [];

  tool(name: string, description: string, schema: unknown, handler: (args: unknown) => Promise<unknown>): void {
    this.capturedTools.push({ name, description, schema, handler });
  }
}

// === 模拟 WsServer ===
const mockWsServer = {
  broadcastConsumedUpdate: vi.fn(),
  broadcastCreateView: vi.fn(),
};

describe('get_input 工具', () => {
  let mockServer: MockMcpServer;
  let getInputHandler: (args: unknown) => Promise<unknown>;

  beforeEach(() => {
    // 重置 store
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

    mockServer = new MockMcpServer();
    mockWsServer.broadcastConsumedUpdate.mockClear();

    registerGetInputTool(mockServer as unknown as any, mockWsServer as unknown as any);

    expect(mockServer.capturedTools).toHaveLength(1);
    expect(mockServer.capturedTools[0].name).toBe('get_input');
    getInputHandler = mockServer.capturedTools[0].handler;
  });

  // === status: 'empty' ===
  describe('status: empty（空画布）', () => {
    it('should return empty status when canvas has no nodes', async () => {
      const result = await getInputHandler({}) as { content: Array<{ type: string; text: string }> };
      const payload = JSON.parse(result.content[0].text);

      expect(payload.status).toBe('empty');
      expect(payload.message).toContain('画布为空');
    });

    it('should not broadcast consumed update for empty canvas', async () => {
      await getInputHandler({});
      expect(mockWsServer.broadcastConsumedUpdate).not.toHaveBeenCalled();
    });
  });

  // === status: 'already_consumed' ===
  describe('status: already_consumed（已消费）', () => {
    beforeEach(() => {
      // 设置有节点但已消费
      const node: MermaidNode = {
        id: 'A',
        type: 'rect',
        position: { x: 0, y: 0 },
        data: { label: '测试', shape: 'rect' },
      };
      useEditorStore.getState().setCanvas({ nodes: [node], edges: [], direction: 'TD' });
      useEditorStore.getState().setConsumed(true);
      useEditorStore.getState().setCanvasSource('user');
      useEditorStore.getState().setLastConsumedAt(1700000000000);
    });

    it('should return already_consumed status', async () => {
      const result = await getInputHandler({}) as { content: Array<{ type: string; text: string }> };
      const payload = JSON.parse(result.content[0].text);

      expect(payload.status).toBe('already_consumed');
      expect(payload.message).toContain('已消费');
    });

    it('should include lastConsumedAt in response', async () => {
      const result = await getInputHandler({}) as { content: Array<{ type: string; text: string }> };
      const payload = JSON.parse(result.content[0].text);

      expect(payload.lastConsumedAt).toBe(1700000000000);
    });

    it('should include canvasSource in response', async () => {
      const result = await getInputHandler({}) as { content: Array<{ type: string; text: string }> };
      const payload = JSON.parse(result.content[0].text);

      expect(payload.canvasSource).toBe('user');
    });

    it('should not broadcast consumed update for already consumed', async () => {
      await getInputHandler({});
      expect(mockWsServer.broadcastConsumedUpdate).not.toHaveBeenCalled();
    });
  });

  // === status: 'ai_content' ===
  describe('status: ai_content（AI 生成内容）', () => {
    beforeEach(() => {
      // 设置画布内容为 AI 生成且未消费（异常情况）
      const node: MermaidNode = {
        id: 'A',
        type: 'rect',
        position: { x: 0, y: 0 },
        data: { label: 'AI生成', shape: 'rect' },
      };
      useEditorStore.getState().setCanvas({ nodes: [node], edges: [], direction: 'TD' });
      useEditorStore.getState().setConsumed(false);
      useEditorStore.getState().setCanvasSource('ai');
    });

    it('should return ai_content status when canvasSource is ai and not consumed', async () => {
      const result = await getInputHandler({}) as { content: Array<{ type: string; text: string }> };
      const payload = JSON.parse(result.content[0].text);

      expect(payload.status).toBe('ai_content');
      expect(payload.message).toContain('AI生成');
    });

    it('should not broadcast consumed update for ai_content', async () => {
      await getInputHandler({});
      expect(mockWsServer.broadcastConsumedUpdate).not.toHaveBeenCalled();
    });
  });

  // === status: 'success' ===
  describe('status: success（成功读取）', () => {
    beforeEach(() => {
      // 设置用户绘制的画布，未消费
      const node: MermaidNode = {
        id: 'A',
        type: 'rect',
        position: { x: 0, y: 0 },
        data: { label: '用户绘制', shape: 'rect' },
      };
      useEditorStore.getState().setCanvas({ nodes: [node], edges: [], direction: 'TD' });
      useEditorStore.getState().setConsumed(false);
      useEditorStore.getState().setCanvasSource('user');
    });

    it('should return success status with mermaid code', async () => {
      const result = await getInputHandler({}) as { content: Array<{ type: string; text: string }> };
      const payload = JSON.parse(result.content[0].text);

      expect(payload.status).toBe('success');
      expect(payload.mermaid).toContain('flowchart TD');
      expect(payload.mermaid).toContain('A[用户绘制]');
    });

    it('should include nodeCount and edgeCount', async () => {
      const result = await getInputHandler({}) as { content: Array<{ type: string; text: string }> };
      const payload = JSON.parse(result.content[0].text);

      expect(payload.nodeCount).toBe(1);
      expect(payload.edgeCount).toBe(0);
    });

    it('should include direction', async () => {
      const result = await getInputHandler({}) as { content: Array<{ type: string; text: string }> };
      const payload = JSON.parse(result.content[0].text);

      expect(payload.direction).toBe('TD');
    });

    it('should mark canvas as consumed after success', async () => {
      await getInputHandler({});
      expect(useEditorStore.getState().consumed).toBe(true);
    });

    it('should set lastConsumedAt after success', async () => {
      const before = Date.now();
      await getInputHandler({});
      const after = Date.now();
      const lastConsumedAt = useEditorStore.getState().lastConsumedAt;
      expect(lastConsumedAt).not.toBeNull();
      expect(lastConsumedAt!).toBeGreaterThanOrEqual(before);
      expect(lastConsumedAt!).toBeLessThanOrEqual(after);
    });

    it('should broadcast consumed update after success', async () => {
      await getInputHandler({});
      expect(mockWsServer.broadcastConsumedUpdate).toHaveBeenCalledTimes(1);
    });

    it('should preserve canvasSource as user after success', async () => {
      await getInputHandler({});
      expect(useEditorStore.getState().canvasSource).toBe('user');
    });
  });

  // === 多节点场景 ===
  describe('多节点场景', () => {
    it('should serialize all nodes in success response', async () => {
      const nodes: MermaidNode[] = [
        { id: 'A', type: 'rect', position: { x: 0, y: 0 }, data: { label: '开始', shape: 'rect' } },
        { id: 'B', type: 'diamond', position: { x: 100, y: 0 }, data: { label: '判断', shape: 'diamond' } },
        { id: 'C', type: 'rect', position: { x: 200, y: 0 }, data: { label: '结束', shape: 'rect' } },
      ];
      useEditorStore.getState().setCanvas({ nodes, edges: [], direction: 'LR' });
      useEditorStore.getState().setConsumed(false);
      useEditorStore.getState().setCanvasSource('user');

      const result = await getInputHandler({}) as { content: Array<{ type: string; text: string }> };
      const payload = JSON.parse(result.content[0].text);

      expect(payload.status).toBe('success');
      expect(payload.nodeCount).toBe(3);
      expect(payload.direction).toBe('LR');
      expect(payload.mermaid).toContain('A[开始]');
      expect(payload.mermaid).toContain('B{判断}');
      expect(payload.mermaid).toContain('C[结束]');
    });
  });

  // === 工具注册 ===
  describe('工具注册', () => {
    it('should register tool with name get_input', () => {
      expect(mockServer.capturedTools[0].name).toBe('get_input');
    });

    it('should have non-empty description', () => {
      expect(mockServer.capturedTools[0].description).toBeTruthy();
      expect(mockServer.capturedTools[0].description.length).toBeGreaterThan(10);
    });

    it('should have empty schema (no parameters)', () => {
      expect(mockServer.capturedTools[0].schema).toEqual({});
    });
  });
});

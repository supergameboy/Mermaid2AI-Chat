/**
 * create_view 工具测试 — 验证 AI → 用户方向
 *
 * 重点测试：
 * - 成功解析并展示 mermaid 代码
 * - 解析失败时返回错误
 * - CREATE_VIEW 事件：consumed=true, canvasSource='ai'
 * - 广播 create_view 和 consumed_update
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerCreateViewTool } from './create-view.js';
import { useEditorStore } from '../store.js';

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

describe('create_view 工具', () => {
  let mockServer: MockMcpServer;
  let createViewHandler: (args: unknown) => Promise<unknown>;

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
    mockWsServer.broadcastCreateView.mockClear();

    registerCreateViewTool(mockServer as unknown as any, mockWsServer as unknown as any);

    expect(mockServer.capturedTools).toHaveLength(1);
    expect(mockServer.capturedTools[0].name).toBe('create_view');
    createViewHandler = mockServer.capturedTools[0].handler;
  });

  // === 成功场景 ===
  describe('成功解析并展示', () => {
    it('should parse mermaid and update store', async () => {
      const mermaid = 'flowchart TD\n  A[开始] --> B[结束]';
      const result = await createViewHandler({ mermaid }) as { content: Array<{ type: string; text: string }> };
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(true);
      expect(payload.nodeCount).toBe(2);
      expect(payload.edgeCount).toBe(1);
    });

    it('should update store with parsed nodes', async () => {
      const mermaid = 'flowchart TD\n  A[开始] --> B[结束]';
      await createViewHandler({ mermaid });

      const canvas = useEditorStore.getState().getCanvas();
      expect(canvas.nodes).toHaveLength(2);
      expect(canvas.nodes[0].id).toBe('A');
      expect(canvas.nodes[1].id).toBe('B');
    });

    it('should set consumed to true (CREATE_VIEW event)', async () => {
      const mermaid = 'flowchart TD\n  A[开始]';
      await createViewHandler({ mermaid });

      expect(useEditorStore.getState().consumed).toBe(true);
    });

    it('should set canvasSource to ai (CREATE_VIEW event)', async () => {
      const mermaid = 'flowchart TD\n  A[开始]';
      await createViewHandler({ mermaid });

      expect(useEditorStore.getState().canvasSource).toBe('ai');
    });

    it('should set lastConsumedAt', async () => {
      const before = Date.now();
      const mermaid = 'flowchart TD\n  A[开始]';
      await createViewHandler({ mermaid });
      const after = Date.now();

      const lastConsumedAt = useEditorStore.getState().lastConsumedAt;
      expect(lastConsumedAt).not.toBeNull();
      expect(lastConsumedAt!).toBeGreaterThanOrEqual(before);
      expect(lastConsumedAt!).toBeLessThanOrEqual(after);
    });

    it('should set title when provided', async () => {
      const mermaid = 'flowchart TD\n  A[开始]';
      await createViewHandler({ mermaid, title: '测试标题' });

      expect(useEditorStore.getState().getTitle()).toBe('测试标题');
    });

    it('should set title to null when not provided', async () => {
      const mermaid = 'flowchart TD\n  A[开始]';
      await createViewHandler({ mermaid });

      expect(useEditorStore.getState().getTitle()).toBeNull();
    });

    it('should broadcast create_view', async () => {
      const mermaid = 'flowchart TD\n  A[开始]';
      await createViewHandler({ mermaid, title: '标题' });

      expect(mockWsServer.broadcastCreateView).toHaveBeenCalledTimes(1);
      const callArgs = mockWsServer.broadcastCreateView.mock.calls[0][0];
      expect(callArgs.mermaid).toBe(mermaid);
      expect(callArgs.title).toBe('标题');
    });

    it('should broadcast consumed update', async () => {
      const mermaid = 'flowchart TD\n  A[开始]';
      await createViewHandler({ mermaid });

      expect(mockWsServer.broadcastConsumedUpdate).toHaveBeenCalledTimes(1);
    });

    it('should override previous canvas state', async () => {
      // 先设置用户绘制的内容
      useEditorStore.getState().setCanvas({
        nodes: [{ id: 'old', type: 'rect', position: { x: 0, y: 0 }, data: { label: '旧', shape: 'rect' } }],
        edges: [],
        direction: 'TD',
      });
      useEditorStore.getState().setCanvasSource('user');

      // AI 创建新视图
      const mermaid = 'flowchart TD\n  A[新内容]';
      await createViewHandler({ mermaid });

      const canvas = useEditorStore.getState().getCanvas();
      expect(canvas.nodes).toHaveLength(1);
      expect(canvas.nodes[0].id).toBe('A');
      expect(canvas.nodes[0].data.label).toBe('新内容');
      expect(useEditorStore.getState().canvasSource).toBe('ai');
    });
  });

  // === 多形状支持 ===
  describe('多形状支持', () => {
    it('should parse all 14 node shapes', async () => {
      const mermaid = `flowchart TD
        A[矩形]
        B(圆角)
        C([胶囊])
        D{菱形}
        E((圆形))
        F[(圆柱)]
        G{{六边形}}
        H[/平行四边形/]
        I[[子程序]]
        J(((双圆)))
        K>不对称]
        L[\\反向平行四边形\\]
        M[/梯形\\]
        N[\\反向梯形/]`;
      const result = await createViewHandler({ mermaid }) as { content: Array<{ type: string; text: string }> };
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(true);
      expect(payload.nodeCount).toBe(14);
    });

    it('should parse all 8 edge styles', async () => {
      const mermaid = `flowchart TD
        A --> B
        C --- D
        E -.- F
        G -.-> H
        I ==> J
        K ---o L
        M ---x N
        O <---> P`;
      const result = await createViewHandler({ mermaid }) as { content: Array<{ type: string; text: string }> };
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(true);
      expect(payload.edgeCount).toBe(8);
    });
  });

  // === 失败场景 ===
  describe('解析失败', () => {
    it('should return failure when mermaid is invalid and no nodes parsed', async () => {
      const mermaid = 'invalid mermaid syntax !!!';
      const result = await createViewHandler({ mermaid }) as { content: Array<{ type: string; text: string }> };
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(false);
      expect(payload.message).toContain('解析失败');
    });

    it('should not update store when parse fails completely', async () => {
      const mermaid = '!!!invalid!!!';
      await createViewHandler({ mermaid });

      expect(useEditorStore.getState().nodes).toHaveLength(0);
    });

    it('should not broadcast when parse fails completely', async () => {
      const mermaid = '!!!invalid!!!';
      await createViewHandler({ mermaid });

      expect(mockWsServer.broadcastCreateView).not.toHaveBeenCalled();
      expect(mockWsServer.broadcastConsumedUpdate).not.toHaveBeenCalled();
    });
  });

  // === 工具注册 ===
  describe('工具注册', () => {
    it('should register tool with name create_view', () => {
      expect(mockServer.capturedTools[0].name).toBe('create_view');
    });

    it('should have non-empty description', () => {
      expect(mockServer.capturedTools[0].description).toBeTruthy();
    });

    it('should have schema with mermaid and title', () => {
      const schema = mockServer.capturedTools[0].schema as Record<string, unknown>;
      expect(schema).toHaveProperty('mermaid');
      expect(schema).toHaveProperty('title');
    });
  });
});

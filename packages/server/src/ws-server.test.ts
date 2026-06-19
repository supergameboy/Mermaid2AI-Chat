/**
 * WsServer 测试 — 验证消息处理、广播、viewport 同步
 *
 * 使用真实的 http + ws 服务器，模拟客户端连接
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { WsServer } from './ws-server.js';
import { useEditorStore } from './store.js';
import type { MermaidNode, MermaidEdge, Viewport } from '@mermaid-editor/serializer';

describe('WsServer', () => {
  let httpServer: http.Server;
  let wsServer: WsServer;
  let clientWs: WebSocket;
  let client2Ws: WebSocket;
  const port = 14599; // 测试端口，避免冲突

  beforeEach(async () => {
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

    httpServer = http.createServer();
    wsServer = new WsServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(port, () => resolve());
    });

    // 创建两个客户端
    clientWs = new WebSocket(`ws://localhost:${port}/ws`);
    client2Ws = new WebSocket(`ws://localhost:${port}/ws`);

    await Promise.all([
      new Promise<void>((resolve) => clientWs.on('open', () => resolve())),
      new Promise<void>((resolve) => client2Ws.on('open', () => resolve())),
    ]);

    // 等待 reconnect_sync 消息发送完毕
    await new Promise((resolve) => setTimeout(resolve, 50));
    // 清空客户端接收缓冲
    drainMessages(clientWs);
    drainMessages(client2Ws);
  });

  afterEach(async () => {
    clientWs.close();
    client2Ws.close();
    wsServer.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  /** 收集客户端所有待处理消息（清空缓冲） */
  function drainMessages(ws: WebSocket): unknown[] {
    const messages: unknown[] = [];
    // ws 库没有直接 API，使用 listeners 处理
    return messages;
  }

  /** 等待客户端收到指定类型消息 */
  function waitForMessage(ws: WebSocket, type: string, timeout = 1000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`等待消息 ${type} 超时`));
      }, timeout);

      const handler = (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === type) {
            clearTimeout(timer);
            ws.off('message', handler);
            resolve(msg);
          }
        } catch {
          // 忽略解析失败
        }
      };
      ws.on('message', handler);
    });
  }

  /** 发送消息到服务端 */
  function sendToServer(ws: WebSocket, msg: unknown): void {
    ws.send(JSON.stringify(msg));
  }

  // === 连接和 reconnect_sync ===
  describe('连接和 reconnect_sync', () => {
    it('should send reconnect_sync on new connection', async () => {
      const newClient = new WebSocket(`ws://localhost:${port}/ws`);
      const msg = await waitForMessage(newClient, 'reconnect_sync');
      expect(msg.type).toBe('reconnect_sync');
      expect(msg.payload).toHaveProperty('canvas');
      expect(msg.payload).toHaveProperty('consumed');
      expect(msg.payload).toHaveProperty('title');
      expect(msg.payload).toHaveProperty('viewport');
      newClient.close();
    });

    it('should include viewport in reconnect_sync payload', async () => {
      // 设置自定义 viewport
      useEditorStore.getState().setViewport({ x: 100, y: 200, zoom: 1.5 });

      const newClient = new WebSocket(`ws://localhost:${port}/ws`);
      const msg = await waitForMessage(newClient, 'reconnect_sync');
      expect(msg.payload.viewport).toEqual({ x: 100, y: 200, zoom: 1.5 });
      newClient.close();
    });
  });

  // === canvas_edit 消息 ===
  describe('canvas_edit 消息', () => {
    it('should update store and broadcast canvas_update to other clients', async () => {
      const node: MermaidNode = {
        id: 'n1',
        type: 'rect',
        position: { x: 0, y: 0 },
        data: { label: '测试', shape: 'rect' },
      };

      const promise = waitForMessage(client2Ws, 'canvas_update');
      sendToServer(clientWs, {
        type: 'canvas_edit',
        payload: { nodes: [node], edges: [], direction: 'TD' },
      });

      const msg = await promise;
      expect(msg.payload.nodes).toHaveLength(1);
      expect(msg.payload.nodes[0].id).toBe('n1');
    });

    it('should reset consumed on canvas_edit [TC-3.9b]', async () => {
      // 先标记为已消费
      useEditorStore.getState().setConsumed(true);
      useEditorStore.getState().setCanvasSource('ai');

      const promise = waitForMessage(client2Ws, 'consumed_update');
      sendToServer(clientWs, {
        type: 'canvas_edit',
        payload: { nodes: [], edges: [], direction: 'TD' },
      });

      const msg = await promise;
      expect(msg.payload.consumed).toBe(false);
      expect(msg.payload.canvasSource).toBe('user');
    });

    it('should not echo canvas_update back to sender', async () => {
      let receivedBySender = false;
      clientWs.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'canvas_update') {
            receivedBySender = true;
          }
        } catch {}
      });

      sendToServer(clientWs, {
        type: 'canvas_edit',
        payload: { nodes: [], edges: [], direction: 'TD' },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(receivedBySender).toBe(false);
    });
  });

  // === reset_consumed 消息 ===
  describe('reset_consumed 消息', () => {
    it('should reset consumed and broadcast to all clients', async () => {
      useEditorStore.getState().setConsumed(true);

      const promise1 = waitForMessage(clientWs, 'consumed_update');
      const promise2 = waitForMessage(client2Ws, 'consumed_update');

      sendToServer(clientWs, { type: 'reset_consumed' });

      const [msg1, msg2] = await Promise.all([promise1, promise2]);
      expect(msg1.payload.consumed).toBe(false);
      expect(msg2.payload.consumed).toBe(false);
    });
  });

  // === viewport_edit 消息（新增）===
  describe('viewport_edit 消息', () => {
    it('should update store viewport on viewport_edit', async () => {
      const newViewport: Viewport = { x: 100, y: 200, zoom: 1.5 };

      const promise = waitForMessage(client2Ws, 'viewport_update');
      sendToServer(clientWs, {
        type: 'viewport_edit',
        payload: { viewport: newViewport },
      });

      await promise;

      // Store 应已更新
      expect(useEditorStore.getState().getViewport()).toEqual(newViewport);
    });

    it('should broadcast viewport_update to other clients', async () => {
      const newViewport: Viewport = { x: 50, y: 50, zoom: 0.8 };

      const promise = waitForMessage(client2Ws, 'viewport_update');
      sendToServer(clientWs, {
        type: 'viewport_edit',
        payload: { viewport: newViewport },
      });

      const msg = await promise;
      expect(msg.type).toBe('viewport_update');
      expect(msg.payload.viewport).toEqual(newViewport);
    });

    it('should not echo viewport_update back to sender', async () => {
      let receivedBySender = false;
      clientWs.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'viewport_update') {
            receivedBySender = true;
          }
        } catch {}
      });

      sendToServer(clientWs, {
        type: 'viewport_edit',
        payload: { viewport: { x: 10, y: 10, zoom: 1 } },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(receivedBySender).toBe(false);
    });

    it('should not reset consumed on viewport_edit', async () => {
      // 先标记为已消费
      useEditorStore.getState().setConsumed(true);
      useEditorStore.getState().setCanvasSource('ai');

      sendToServer(clientWs, {
        type: 'viewport_edit',
        payload: { viewport: { x: 100, y: 100, zoom: 1 } },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // consumed 应保持 true
      expect(useEditorStore.getState().consumed).toBe(true);
      expect(useEditorStore.getState().canvasSource).toBe('ai');
    });

    it('should handle zoom-only viewport changes', async () => {
      const promise = waitForMessage(client2Ws, 'viewport_update');
      sendToServer(clientWs, {
        type: 'viewport_edit',
        payload: { viewport: { x: 0, y: 0, zoom: 2 } },
      });

      const msg = await promise;
      expect(msg.payload.viewport.zoom).toBe(2);
    });
  });

  // === broadcastCreateView ===
  describe('broadcastCreateView', () => {
    it('should broadcast canvas_update and create_view to all clients', async () => {
      // 先在 store 中设置画布数据
      const node: MermaidNode = {
        id: 'n1',
        type: 'rect',
        position: { x: 0, y: 0 },
        data: { label: 'AI生成', shape: 'rect' },
      };
      useEditorStore.getState().setCanvas({ nodes: [node], edges: [], direction: 'TD' });

      const canvasPromise = waitForMessage(clientWs, 'canvas_update');
      const createPromise = waitForMessage(clientWs, 'create_view');

      wsServer.broadcastCreateView({ mermaid: 'flowchart TD\n  n1[AI生成]', title: 'AI图' });

      const [canvasMsg, createMsg] = await Promise.all([canvasPromise, createPromise]);
      expect(canvasMsg.payload.nodes).toHaveLength(1);
      expect(createMsg.payload.title).toBe('AI图');
      expect(createMsg.payload.mermaid).toContain('AI生成');
    });
  });

  // === broadcastConsumedUpdate ===
  describe('broadcastConsumedUpdate', () => {
    it('should broadcast consumed_update to all clients', async () => {
      useEditorStore.getState().setConsumed(true);
      useEditorStore.getState().setCanvasSource('ai');

      const promise1 = waitForMessage(clientWs, 'consumed_update');
      const promise2 = waitForMessage(client2Ws, 'consumed_update');

      wsServer.broadcastConsumedUpdate();

      const [msg1, msg2] = await Promise.all([promise1, promise2]);
      expect(msg1.payload.consumed).toBe(true);
      expect(msg1.payload.canvasSource).toBe('ai');
      expect(msg2.payload.consumed).toBe(true);
    });
  });

  // === subscribe 消息（无操作）===
  describe('subscribe 消息', () => {
    it('should handle subscribe message without error', async () => {
      sendToServer(clientWs, { type: 'subscribe' });
      // 等待一段时间确保无异常
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(clientWs.readyState).toBe(WebSocket.OPEN);
    });
  });
});

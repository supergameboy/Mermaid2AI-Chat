/**
 * WebSocket 同步集成测试 — M13 集成验证
 *
 * 单一职责：验证 CanvasState 联合类型的 JSON 序列化/反序列化、
 * WebSocket 消息广播、canvas_edit 部分更新、多客户端冲突解决（Last Write Wins）
 *
 * 验证要点:
 *   1. 所有 12 种 CanvasState 子类型可 JSON 序列化/反序列化（无数据丢失）
 *   2. WsServerMessage / WsClientMessage 消息类型可 JSON round-trip
 *   3. canvas_edit 消息：图结构类型部分更新，数据图表类型全量替换
 *   4. canvas_update 广播：除发送方外所有客户端收到消息
 *   5. 多客户端冲突解决：Last Write Wins（最后写入胜出）
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WebSocket } from 'ws';
import type {
  CanvasState,
  DiagramType,
  ConsumedState,
  Viewport,
  ViewSummary,
  ActiveViewPayload,
} from '@mermaid2aichat/serializer';
import {
  createEmptyCanvasState,
  isGraphCanvasState,
  isGanttCanvasState,
  isPieCanvasState,
  isTimelineCanvasState,
  isQuadrantCanvasState,
  isXYChartCanvasState,
  migrateCanvasState,
} from '@mermaid2aichat/serializer';
import { WsServer, type WsServerMessage, type WsClientMessage } from '../../src/ws-server.js';
import { WorkspaceRegistry } from '../../src/workspace-registry.js';

// ============================================================
// 12 种 DiagramType 完整列表
// ============================================================
const ALL_DIAGRAM_TYPES: DiagramType[] = [
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'erDiagram',
  'stateDiagram',
  'mindmap',
  'architecture',
  'gantt',
  'pie',
  'timeline',
  'quadrantChart',
  'xychart',
];

const GRAPH_DIAGRAM_TYPES: DiagramType[] = [
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'erDiagram',
  'stateDiagram',
  'mindmap',
  'architecture',
];

const CHART_DIAGRAM_TYPES: DiagramType[] = [
  'gantt',
  'pie',
  'timeline',
  'quadrantChart',
  'xychart',
];

// ============================================================
// 测试基础设施
// ============================================================

let httpServer: http.Server;
let wsServer: WsServer;
let registry: WorkspaceRegistry;
let tempDir: string;
let workspaceRoot: string;
let serverPort: number;

/** 测试客户端 — 包装 WebSocket，提供消息队列避免竞态条件 */
class TestClient {
  readonly ws: WebSocket;
  private messageQueue: WsServerMessage[] = [];
  private waiters: Array<{ resolve: (msg: WsServerMessage) => void; reject: (err: Error) => void }> = [];

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as WsServerMessage;
      const waiter = this.waiters.shift();
      if (waiter) {
        waiter.resolve(msg);
      } else {
        this.messageQueue.push(msg);
      }
    });
    this.ws.on('error', (err) => {
      const waiter = this.waiters.shift();
      if (waiter) waiter.reject(err);
    });
  }

  /** 等待连接建立 */
  waitForOpen(timeout = 2000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket 连接超时')), timeout);
      this.ws.once('open', () => {
        clearTimeout(timer);
        resolve();
      });
      this.ws.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /** 等待下一条消息（从队列取或等待新消息） */
  waitForMessage(timeout = 3000): Promise<WsServerMessage> {
    const queued = this.messageQueue.shift();
    if (queued) {
      return Promise.resolve(queued);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('等待消息超时')), timeout);
      this.waiters.push({
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
    });
  }

  /** 发送客户端消息 */
  send(msg: WsClientMessage): void {
    this.ws.send(JSON.stringify(msg));
  }

  /** 收集指定数量的消息 */
  async collectMessages(count: number, timeout = 3000): Promise<WsServerMessage[]> {
    const messages: WsServerMessage[] = [];
    for (let i = 0; i < count; i++) {
      messages.push(await this.waitForMessage(timeout));
    }
    return messages;
  }

  /** 关闭连接 */
  close(): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }
}

/** 创建测试客户端并连接到服务器 */
async function createClient(root: string): Promise<TestClient> {
  const client = new TestClient(`ws://localhost:${serverPort}/ws?workspaceRoot=${encodeURIComponent(root)}`);
  await client.waitForOpen();
  return client;
}

beforeAll(async () => {
  // 创建临时工作区目录
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm13-ws-test-'));
  workspaceRoot = tempDir;

  // 创建 HTTP 服务器（随机端口）
  httpServer = http.createServer();
  await new Promise<void>((resolve) => {
    httpServer.listen(0, 'localhost', () => resolve());
  });
  const address = httpServer.address();
  if (address === null || typeof address === 'string') {
    throw new Error('无法获取服务器地址');
  }
  serverPort = address.port;

  // 创建工作区注册表和 WebSocket 服务器
  registry = new WorkspaceRegistry();
  wsServer = new WsServer(httpServer, registry);

  // 预初始化工作区（确保 beforeEach 能获取到 store）
  await registry.getOrCreate(workspaceRoot);
});

afterAll(async () => {
  wsServer.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  // 清理临时目录
  fs.rmSync(tempDir, { recursive: true, force: true });
});

beforeEach(() => {
  // 每个测试前重置工作区状态
  const ctx = registry.get(workspaceRoot);
  if (ctx) {
    // 通过 restoreFromPersist 重置状态
    ctx.store.getState().restoreFromPersist({
      views: [],
      activeViewId: null,
      activeContent: null,
    });
  }
});

// ============================================================
// 测试 1: CanvasState JSON 序列化/反序列化
// ============================================================

describe('M13 WebSocket 同步集成测试', () => {
  describe('CanvasState JSON 序列化/反序列化', () => {
    it('所有 12 种 CanvasState 子类型应可 JSON round-trip（无数据丢失）', () => {
      for (const type of ALL_DIAGRAM_TYPES) {
        const original = createEmptyCanvasState(type);
        const json = JSON.stringify(original);
        const restored = JSON.parse(json) as CanvasState;

        expect(restored.diagramType, `${type} JSON round-trip 应保留 diagramType`).toBe(type);
        expect(restored, `${type} JSON round-trip 应保持对象结构一致`).toEqual(original);
      }
    });

    it('图结构类型应包含 nodes/edges 字段', () => {
      for (const type of GRAPH_DIAGRAM_TYPES) {
        const canvas = createEmptyCanvasState(type);
        const json = JSON.stringify(canvas);
        const restored = JSON.parse(json) as CanvasState;

        expect(isGraphCanvasState(restored), `${type} 应被 isGraphCanvasState 识别`).toBe(true);
        expect(Array.isArray(restored.nodes), `${type} 应有 nodes 数组`).toBe(true);
        expect(Array.isArray(restored.edges), `${type} 应有 edges 数组`).toBe(true);
      }
    });

    it('数据图表类型应包含各自特有字段', () => {
      const gantt = JSON.parse(JSON.stringify(createEmptyCanvasState('gantt'))) as CanvasState;
      expect(isGanttCanvasState(gantt)).toBe(true);
      expect(gantt).toHaveProperty('sections');

      const pie = JSON.parse(JSON.stringify(createEmptyCanvasState('pie'))) as CanvasState;
      expect(isPieCanvasState(pie)).toBe(true);
      expect(pie).toHaveProperty('slices');

      const timeline = JSON.parse(JSON.stringify(createEmptyCanvasState('timeline'))) as CanvasState;
      expect(isTimelineCanvasState(timeline)).toBe(true);
      expect(timeline).toHaveProperty('sections');

      const quadrant = JSON.parse(JSON.stringify(createEmptyCanvasState('quadrantChart'))) as CanvasState;
      expect(isQuadrantCanvasState(quadrant)).toBe(true);
      expect(quadrant).toHaveProperty('quadrants');
      expect(quadrant).toHaveProperty('points');

      const xychart = JSON.parse(JSON.stringify(createEmptyCanvasState('xychart'))) as CanvasState;
      expect(isXYChartCanvasState(xychart)).toBe(true);
      expect(xychart).toHaveProperty('series');
    });

    it('migrateCanvasState 应正确处理 JSON 反序列化后的 CanvasState', () => {
      for (const type of ALL_DIAGRAM_TYPES) {
        const original = createEmptyCanvasState(type);
        const json = JSON.stringify(original);
        const restored = JSON.parse(json);
        const migrated = migrateCanvasState(restored);

        expect(migrated.diagramType, `${type} migrate 后应保留 diagramType`).toBe(type);
      }
    });
  });

  // ============================================================
  // 测试 2: WsServerMessage / WsClientMessage JSON round-trip
  // ============================================================

  describe('WebSocket 消息类型 JSON round-trip', () => {
    it('canvas_update 消息应可 JSON 序列化/反序列化', () => {
      const canvas = createEmptyCanvasState('flowchart');
      const message: WsServerMessage = {
        type: 'canvas_update',
        payload: canvas,
        timestamp: Date.now(),
      };

      const json = JSON.stringify(message);
      const restored = JSON.parse(json) as WsServerMessage;

      expect(restored.type).toBe('canvas_update');
      expect(restored.payload.diagramType).toBe('flowchart');
      expect(typeof restored.timestamp).toBe('number');
    });

    it('consumed_update 消息应可 JSON round-trip', () => {
      const message: WsServerMessage = {
        type: 'consumed_update',
        payload: {
          consumed: true,
          lastConsumedAt: Date.now(),
          canvasSource: 'ai',
        },
        timestamp: Date.now(),
      };

      const json = JSON.stringify(message);
      const restored = JSON.parse(json) as WsServerMessage;

      expect(restored.type).toBe('consumed_update');
      expect(restored.payload.consumed).toBe(true);
    });

    it('reconnect_sync 消息应可 JSON round-trip', () => {
      const message: WsServerMessage = {
        type: 'reconnect_sync',
        payload: {
          views: [],
          activeViewId: null,
          activeView: null,
        },
        timestamp: Date.now(),
      };

      const json = JSON.stringify(message);
      const restored = JSON.parse(json) as WsServerMessage;

      expect(restored.type).toBe('reconnect_sync');
      expect(restored.payload.views).toEqual([]);
    });

    it('canvas_edit 客户端消息应可 JSON round-trip', () => {
      const canvas = createEmptyCanvasState('pie');
      const message: WsClientMessage = {
        type: 'canvas_edit',
        payload: canvas,
      };

      const json = JSON.stringify(message);
      const restored = JSON.parse(json) as WsClientMessage;

      expect(restored.type).toBe('canvas_edit');
      expect(restored.payload.diagramType).toBe('pie');
    });

    it('所有 12 种 CanvasState 的 canvas_update 消息应可 JSON round-trip', () => {
      for (const type of ALL_DIAGRAM_TYPES) {
        const canvas = createEmptyCanvasState(type);
        const message: WsServerMessage = {
          type: 'canvas_update',
          payload: canvas,
          timestamp: Date.now(),
        };

        const json = JSON.stringify(message);
        const restored = JSON.parse(json) as WsServerMessage;

        expect(restored.payload.diagramType, `${type} canvas_update round-trip`).toBe(type);
      }
    });
  });

  // ============================================================
  // 测试 3: canvas_edit 消息处理（部分更新 vs 全量替换）
  // ============================================================

  describe('canvas_edit 消息处理', () => {
    let client: TestClient;

    beforeEach(async () => {
      client = await createClient(workspaceRoot);
      // 接收 reconnect_sync 消息
      await client.waitForMessage();
    });

    afterEach(() => {
      client.close();
    });

    it('图结构类型 canvas_edit 应部分更新（保留 diagramType）', async () => {
      // 先创建一个 flowchart 视图
      const ctx = registry.get(workspaceRoot);
      if (!ctx) throw new Error('工作区未初始化');

      ctx.store.getState().createView({
        title: 'Test Flowchart',
        source: 'user',
        sessionId: null,
        canvas: { diagramType: 'flowchart', nodes: [], edges: [], direction: 'TD' },
        consumed: { consumed: false, lastConsumedAt: null, canvasSource: null },
        viewport: { x: 0, y: 0, zoom: 1 },
      });

      // 发送 canvas_edit 消息（图结构类型，部分更新）
      const editCanvas: CanvasState = {
        diagramType: 'flowchart',
        nodes: [
          { id: 'node1', type: 'default', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
        ],
        edges: [],
        direction: 'LR',
      };

      client.send({ type: 'canvas_edit', payload: editCanvas });

      // 发送方只收到 consumed_update（canvas_update 排除发送方）
      const messages = await client.collectMessages(1);
      expect(messages[0]?.type).toBe('consumed_update');

      // 验证 Store 中的画布已更新
      const canvas = ctx.store.getState().getActiveCanvas();
      expect(canvas.diagramType).toBe('flowchart');
      if (isGraphCanvasState(canvas)) {
        expect(canvas.nodes).toHaveLength(1);
        expect(canvas.nodes[0]?.id).toBe('node1');
        expect(canvas.direction).toBe('LR');
      }
    });

    it('数据图表类型 canvas_edit 应全量替换', async () => {
      const ctx = registry.get(workspaceRoot);
      if (!ctx) throw new Error('工作区未初始化');

      // 先创建一个 flowchart 视图
      ctx.store.getState().createView({
        title: 'Test',
        source: 'user',
        sessionId: null,
        canvas: { diagramType: 'flowchart', nodes: [], edges: [], direction: 'TD' },
        consumed: { consumed: false, lastConsumedAt: null, canvasSource: null },
        viewport: { x: 0, y: 0, zoom: 1 },
      });

      // 发送 canvas_edit 消息（pie 类型，全量替换）
      const editCanvas: CanvasState = {
        diagramType: 'pie',
        slices: [
          { label: 'A', value: 30 },
          { label: 'B', value: 70 },
        ],
      };

      client.send({ type: 'canvas_edit', payload: editCanvas });

      // 发送方收到 consumed_update + views_update（图表类型变更广播 views_update）
      const messages = await client.collectMessages(2);
      const types = messages.map((m) => m.type);
      expect(types).toContain('consumed_update');
      expect(types).toContain('views_update');

      // 验证 Store 中的画布已全量替换为 pie
      const canvas = ctx.store.getState().getActiveCanvas();
      expect(canvas.diagramType).toBe('pie');
      expect(isPieCanvasState(canvas)).toBe(true);
    });

    it('canvas_edit 应重置 consumed 状态', async () => {
      const ctx = registry.get(workspaceRoot);
      if (!ctx) throw new Error('工作区未初始化');

      // 创建视图并设置 consumed 为 true
      ctx.store.getState().createView({
        title: 'Test',
        source: 'ai',
        sessionId: 'session-1',
        canvas: { diagramType: 'flowchart', nodes: [], edges: [], direction: 'TD' },
        consumed: { consumed: true, lastConsumedAt: Date.now(), canvasSource: 'ai' },
        viewport: { x: 0, y: 0, zoom: 1 },
      });

      // 发送 canvas_edit
      const editCanvas: CanvasState = {
        diagramType: 'flowchart',
        nodes: [{ id: 'n1', type: 'default', data: { label: 'N1' }, position: { x: 0, y: 0 } }],
        edges: [],
        direction: 'TD',
      };

      client.send({ type: 'canvas_edit', payload: editCanvas });

      // 发送方只收到 consumed_update
      await client.collectMessages(1);

      // 验证 consumed 已重置
      const consumed = ctx.store.getState().getActiveConsumed();
      expect(consumed.consumed).toBe(false);
    });
  });

  // ============================================================
  // 测试 4: canvas_update 广播（排除发送方）
  // ============================================================

  describe('canvas_update 消息广播', () => {
    let client1: TestClient;
    let client2: TestClient;

    beforeEach(async () => {
      client1 = await createClient(workspaceRoot);
      client2 = await createClient(workspaceRoot);
      // 接收两个客户端的 reconnect_sync
      await client1.waitForMessage();
      await client2.waitForMessage();
    });

    afterEach(() => {
      client1.close();
      client2.close();
    });

    it('canvas_edit 应广播给其他客户端（不回传发送方）', async () => {
      const ctx = registry.get(workspaceRoot);
      if (!ctx) throw new Error('工作区未初始化');

      ctx.store.getState().createView({
        title: 'Broadcast Test',
        source: 'user',
        sessionId: null,
        canvas: { diagramType: 'flowchart', nodes: [], edges: [], direction: 'TD' },
        consumed: { consumed: false, lastConsumedAt: null, canvasSource: null },
        viewport: { x: 0, y: 0, zoom: 1 },
      });

      // client1 发送 canvas_edit
      const editCanvas: CanvasState = {
        diagramType: 'flowchart',
        nodes: [{ id: 'shared', type: 'default', data: { label: 'Shared' }, position: { x: 100, y: 100 } }],
        edges: [],
        direction: 'TD',
      };

      client1.send({ type: 'canvas_edit', payload: editCanvas });

      // client2 应收到 canvas_update + consumed_update
      const client2Messages = await client2.collectMessages(2);
      const client2Types = client2Messages.map((m) => m.type);
      expect(client2Types).toContain('canvas_update');

      const canvasUpdate = client2Messages.find((m) => m.type === 'canvas_update');
      expect(canvasUpdate?.type).toBe('canvas_update');
      if (canvasUpdate?.type === 'canvas_update') {
        expect(canvasUpdate.payload.diagramType).toBe('flowchart');
        if (isGraphCanvasState(canvasUpdate.payload)) {
          expect(canvasUpdate.payload.nodes).toHaveLength(1);
          expect(canvasUpdate.payload.nodes[0]?.id).toBe('shared');
        }
      }
    });

    it('多客户端编辑应遵循 Last Write Wins', async () => {
      const ctx = registry.get(workspaceRoot);
      if (!ctx) throw new Error('工作区未初始化');

      ctx.store.getState().createView({
        title: 'LWW Test',
        source: 'user',
        sessionId: null,
        canvas: { diagramType: 'flowchart', nodes: [], edges: [], direction: 'TD' },
        consumed: { consumed: false, lastConsumedAt: null, canvasSource: null },
        viewport: { x: 0, y: 0, zoom: 1 },
      });

      // client1 先编辑
      const edit1: CanvasState = {
        diagramType: 'flowchart',
        nodes: [{ id: 'client1-node', type: 'default', data: { label: 'From Client 1' }, position: { x: 0, y: 0 } }],
        edges: [],
        direction: 'TD',
      };
      client1.send({ type: 'canvas_edit', payload: edit1 });

      // 等待 client2 收到 client1 的广播
      await client2.collectMessages(2);

      // client2 后编辑（Last Write Wins）
      const edit2: CanvasState = {
        diagramType: 'flowchart',
        nodes: [{ id: 'client2-node', type: 'default', data: { label: 'From Client 2' }, position: { x: 50, y: 50 } }],
        edges: [],
        direction: 'LR',
      };
      client2.send({ type: 'canvas_edit', payload: edit2 });

      // 等待 client1 收到 client2 的广播
      await client1.collectMessages(2);

      // 验证 Store 中是最后写入的状态（client2 的编辑）
      const canvas = ctx.store.getState().getActiveCanvas();
      expect(canvas.diagramType).toBe('flowchart');
      if (isGraphCanvasState(canvas)) {
        expect(canvas.nodes).toHaveLength(1);
        expect(canvas.nodes[0]?.id).toBe('client2-node');
        expect(canvas.direction).toBe('LR');
      }
    });
  });

  // ============================================================
  // 测试 5: reconnect_sync 全量同步
  // ============================================================

  describe('reconnect_sync 全量同步', () => {
    let client: TestClient;

    afterEach(() => {
      client?.close();
    });

    it('新连接客户端应收到 reconnect_sync 消息', async () => {
      const ctx = registry.get(workspaceRoot);
      if (!ctx) throw new Error('工作区未初始化');

      // beforeEach 已通过 restoreFromPersist 创建默认视图（1 个 flowchart 视图）
      // 新客户端连接
      client = await createClient(workspaceRoot);

      // 应收到 reconnect_sync
      const message = await client.waitForMessage();
      expect(message.type).toBe('reconnect_sync');

      if (message.type === 'reconnect_sync') {
        // 默认视图应存在（restoreFromPersist 创建 1 个默认 flowchart 视图）
        expect(message.payload.views.length).toBe(1);
        expect(message.payload.activeViewId).toBeTruthy();
        expect(message.payload.activeView).not.toBeNull();
        if (message.payload.activeView) {
          expect(message.payload.activeView.canvas.diagramType).toBe('flowchart');
        }
      }
    });
  });
});

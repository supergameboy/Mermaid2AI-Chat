/**
 * WebSocket 服务器 — 状态广播、客户端管理、断线重连支持
 *
 * 消息类型:
 * 服务器→客户端: canvas_update, consumed_update, create_view, reconnect_sync, viewport_update
 * 客户端→服务器: canvas_edit, reset_consumed, subscribe, viewport_edit
 *
 * 多客户端冲突: Last Write Wins（最后写入胜出）
 * 断线重连: 客户端重连后发送 reconnect_sync 全量同步
 */
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { MermaidEdge, MermaidNode, FlowchartDirection, Viewport } from '@mermaid-editor/serializer';
import { useEditorStore } from './store.js';
import { consumedReducer } from './consumed-state-machine.js';

// === 消息类型（联合类型，类型安全） ===

export interface CanvasPayload {
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  direction: FlowchartDirection;
}

export interface ConsumedPayload {
  consumed: boolean;
  lastConsumedAt: number | null;
  canvasSource: 'user' | 'ai' | null;
}

export interface CreateViewPayload {
  title: string | null;
  mermaid: string;
}

export interface ViewportPayload {
  viewport: Viewport;
}

export interface ReconnectSyncPayload {
  canvas: CanvasPayload;
  consumed: ConsumedPayload;
  title: string | null;
  viewport: Viewport;
}

export type WsServerMessage =
  | { type: 'canvas_update'; payload: CanvasPayload; timestamp: number }
  | { type: 'consumed_update'; payload: ConsumedPayload; timestamp: number }
  | { type: 'create_view'; payload: CreateViewPayload; timestamp: number }
  | { type: 'reconnect_sync'; payload: ReconnectSyncPayload; timestamp: number }
  | { type: 'viewport_update'; payload: ViewportPayload; timestamp: number };

export type WsClientMessage =
  | { type: 'canvas_edit'; payload: CanvasPayload }
  | { type: 'reset_consumed' }
  | { type: 'subscribe' }
  | { type: 'viewport_edit'; payload: ViewportPayload };

export class WsServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      console.log(`[WS] 客户端连接，当前 ${this.clients.size} 个客户端`);

      // 发送当前完整状态（reconnect_sync）
      this.sendReconnectSync(ws);

      ws.on('message', (data: Buffer) => {
        this.handleMessage(ws, data);
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[WS] 客户端断开，当前 ${this.clients.size} 个客户端`);
      });

      ws.on('error', (err: Error) => {
        console.error('[WS] 客户端错误:', err.message);
        this.clients.delete(ws);
      });
    });
  }

  /**
   * 处理客户端消息
   */
  private handleMessage(ws: WebSocket, data: Buffer): void {
    let msg: WsClientMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      console.error('[WS] 消息解析失败');
      return;
    }

    console.log(`[WS] 收到消息: ${msg.type}`);

    const store = useEditorStore.getState();

    switch (msg.type) {
      case 'canvas_edit': {
        // 用户编辑画布 → 更新 Store + 触发 CANVAS_EDIT 事件
        const payload = msg.payload;
        store.setCanvas({ nodes: payload.nodes, edges: payload.edges, direction: payload.direction });

        // CANVAS_EDIT 事件重置 consumed（修复后的状态机）
        const currentState = store.getConsumedState();
        const newState = consumedReducer(currentState, { type: 'CANVAS_EDIT' });
        store.setConsumed(newState.consumed);
        store.setCanvasSource(newState.canvasSource);

        // 广播给其他客户端
        this.broadcastExcept(ws, {
          type: 'canvas_update',
          payload: { nodes: payload.nodes, edges: payload.edges, direction: payload.direction },
          timestamp: Date.now(),
        });
        // 广播消费状态变化（CANVAS_EDIT 重置了 consumed）
        this.broadcast({
          type: 'consumed_update',
          payload: store.getConsumedState(),
          timestamp: Date.now(),
        });
        break;
      }

      case 'reset_consumed': {
        // 用户点击"重新启用" → 触发 RESET 事件
        const currentState = store.getConsumedState();
        const newState = consumedReducer(currentState, { type: 'RESET' });
        store.setConsumed(newState.consumed);

        // 广播给所有客户端
        this.broadcast({
          type: 'consumed_update',
          payload: store.getConsumedState(),
          timestamp: Date.now(),
        });
        break;
      }

      case 'viewport_edit': {
        // 用户平移/缩放画布 → 更新 Store（不重置 consumed）+ 广播给其他客户端
        const payload = msg.payload;
        store.setViewport(payload.viewport);

        // 广播给其他客户端（与 canvas_update 一致，避免回传给发起方）
        this.broadcastExcept(ws, {
          type: 'viewport_update',
          payload: { viewport: payload.viewport },
          timestamp: Date.now(),
        });
        break;
      }

      case 'subscribe':
        // 标记客户端为订阅状态（已通过连接自动订阅）
        break;
    }
  }

  /**
   * 广播 create_view 通知（包含画布数据 + 标题）
   * AI → 用户方向：客户端收到后更新画布和标题
   */
  broadcastCreateView(payload: CreateViewPayload): void {
    const store = useEditorStore.getState();
    const canvas = store.getCanvas();
    this.broadcast({
      type: 'canvas_update',
      payload: canvas,
      timestamp: Date.now(),
    });
    this.broadcast({
      type: 'create_view',
      payload,
      timestamp: Date.now(),
    });
  }

  /**
   * 广播消费状态更新
   */
  broadcastConsumedUpdate(): void {
    this.broadcast({
      type: 'consumed_update',
      payload: useEditorStore.getState().getConsumedState(),
      timestamp: Date.now(),
    });
  }

  /**
   * 广播画布更新（供 /reset 端点等外部调用）
   */
  broadcastCanvasUpdate(payload: CanvasPayload): void {
    this.broadcast({
      type: 'canvas_update',
      payload,
      timestamp: Date.now(),
    });
  }

  /**
   * 广播消费状态（供 /reset 端点等外部调用）
   */
  broadcastConsumedPayload(payload: ConsumedPayload): void {
    this.broadcast({
      type: 'consumed_update',
      payload,
      timestamp: Date.now(),
    });
  }

  /**
   * 广播给所有客户端
   */
  private broadcast(message: WsServerMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /**
   * 广播给除发起方外的客户端
   */
  private broadcastExcept(sender: WebSocket, message: WsServerMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /**
   * 发送全量状态给重连客户端
   */
  private sendReconnectSync(ws: WebSocket): void {
    const store = useEditorStore.getState();
    const payload: ReconnectSyncPayload = {
      canvas: store.getCanvas(),
      consumed: store.getConsumedState(),
      title: store.getTitle(),
      viewport: store.getViewport(),
    };
    ws.send(JSON.stringify({
      type: 'reconnect_sync',
      payload,
      timestamp: Date.now(),
    }));
  }

  /**
   * 关闭 WebSocket 服务器
   */
  close(): void {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();
    this.wss.close();
  }
}

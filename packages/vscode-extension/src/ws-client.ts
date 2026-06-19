/**
 * WebSocket 客户端 — 连接 Mermaid 编辑器服务端
 *
 * 职责：管理 WebSocket 连接、断线重连、消息转发
 * 消息协议与服务端 ws-server.ts 一致
 */
import WebSocket from 'ws';
import type { MermaidEdge, MermaidNode, FlowchartDirection, CanvasSource, Viewport } from '@mermaid-editor/serializer';

// === 消息类型（与服务端一致） ===

export interface WsServerMessage {
  type: 'canvas_update' | 'consumed_update' | 'create_view' | 'reconnect_sync' | 'viewport_update';
  payload: unknown;
  timestamp: number;
}

export interface WsClientMessage {
  type: 'canvas_edit' | 'reset_consumed' | 'viewport_edit';
  payload?: unknown;
}

export interface CanvasPayload {
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  direction: FlowchartDirection;
}

export interface ConsumedPayload {
  consumed: boolean;
  lastConsumedAt: number | null;
  canvasSource: CanvasSource;
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

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export type ServerMessageHandler = (msg: WsServerMessage) => void;
export type StatusHandler = (status: ConnectionStatus) => void;

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

export class WsClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageHandlers = new Set<ServerMessageHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private status: ConnectionStatus = 'disconnected';
  private shouldReconnect = true;

  constructor(url: string = 'ws://localhost:14514/ws') {
    this.url = url;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.shouldReconnect = true;

    try {
      const ws = new WebSocket(this.url);
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectAttempt = 0;
        this.setStatus('connected');
        console.log('[VSCode-WS] 已连接到 Mermaid 服务端');
      };

      ws.on('message', (data: WebSocket.RawData) => {
        let msg: WsServerMessage;
        try {
          msg = JSON.parse(data.toString());
        } catch {
          return;
        }
        for (const handler of this.messageHandlers) {
          handler(msg);
        }
      });

      ws.onclose = () => {
        this.ws = null;
        this.setStatus('disconnected');
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      ws.onerror = (err: { message?: string }) => {
        console.error('[VSCode-WS] 错误:', err.message ?? err);
      };
    } catch (e) {
      console.error('[VSCode-WS] 连接失败:', e);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= RECONNECT_DELAYS.length) {
      console.log('[VSCode-WS] 重连次数已达上限，停止重连');
      return;
    }

    this.setStatus('reconnecting');
    const delay = RECONNECT_DELAYS[this.reconnectAttempt];
    this.reconnectAttempt++;

    console.log(`[VSCode-WS] ${delay}ms 后重连（第 ${this.reconnectAttempt} 次）`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  send(msg: WsClientMessage): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  onMessage(handler: ServerMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this.status);
    return () => this.statusHandlers.delete(handler);
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const handler of this.statusHandlers) {
      handler(status);
    }
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
    this.ws = null;
    this.setStatus('disconnected');
  }
}

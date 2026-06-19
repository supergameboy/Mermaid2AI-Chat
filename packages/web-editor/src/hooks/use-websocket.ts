/**
 * WebSocket 客户端 — 连接服务端，同步画布状态
 * 支持断线重连（指数退避）
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditorStore } from '../store.js';
import { serializeMermaid } from '@mermaid-editor/serializer';
import type { MermaidNode, MermaidEdge, FlowchartDirection, Viewport } from '@mermaid-editor/serializer';

type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface CanvasPayload {
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  direction: FlowchartDirection;
}

interface ConsumedPayload {
  consumed: boolean;
  lastConsumedAt: number | null;
  canvasSource: 'user' | 'ai' | null;
}

interface CreateViewPayload {
  title: string | null;
  mermaid: string;
}

interface ViewportPayload {
  viewport: Viewport;
}

interface ReconnectSyncPayload {
  canvas: CanvasPayload;
  consumed: ConsumedPayload;
  title: string | null;
  viewport: Viewport;
}

type WsServerMessage =
  | { type: 'canvas_update'; payload: CanvasPayload; timestamp: number }
  | { type: 'consumed_update'; payload: ConsumedPayload; timestamp: number }
  | { type: 'create_view'; payload: CreateViewPayload; timestamp: number }
  | { type: 'reconnect_sync'; payload: ReconnectSyncPayload; timestamp: number }
  | { type: 'viewport_update'; payload: ViewportPayload; timestamp: number };

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

export function useWebSocket(url: string = 'ws://localhost:14514/ws') {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  const store = useEditorStore;

  const connect = useCallback(() => {
    // OPEN 或 CONNECTING 时不需要重连（避免 StrictMode 双次执行创建多个连接）
    const state = wsRef.current?.readyState;
    if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setStatus('connected');
        console.log('[WS] 已连接');
      };

      ws.onmessage = (event) => {
        let msg: WsServerMessage;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        const s = store.getState();

        switch (msg.type) {
          case 'canvas_update': {
            const payload = msg.payload;
            // 服务端画布更新 → 同步到本地（不触发 consumed 重置）
            s.setCanvasSync(payload.nodes, payload.edges, payload.direction);
            break;
          }

          case 'consumed_update': {
            const payload = msg.payload;
            s.setConsumedSync(payload.consumed, payload.lastConsumedAt, payload.canvasSource);
            break;
          }

          case 'create_view': {
            // AI 调用 create_view → 画布数据已通过 canvas_update 同步
            // 这里只更新标题
            const payload = msg.payload;
            s.setTitleSync(payload.title);
            console.log('[WS] create_view 通知, title:', payload.title);
            break;
          }

          case 'viewport_update': {
            // 其他客户端的视口变化 → 同步到本地
            const payload = msg.payload;
            s.setViewportSync(payload.viewport);
            break;
          }

          case 'reconnect_sync': {
            const payload = msg.payload;
            s.setCanvasSync(payload.canvas.nodes, payload.canvas.edges, payload.canvas.direction);
            s.setConsumedSync(
              payload.consumed.consumed,
              payload.consumed.lastConsumedAt,
              payload.consumed.canvasSource
            );
            s.setTitleSync(payload.title);
            s.setViewportSync(payload.viewport);
            break;
          }
        }
      };

      ws.onclose = () => {
        // 只处理当前 wsRef 指向的连接，避免 StrictMode 双次执行时旧连接覆盖新连接
        if (wsRef.current !== ws) return;
        setStatus('disconnected');
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = (err) => {
        console.error('[WS] 错误', err);
      };
    } catch (e) {
      console.error('[WS] 连接失败', e);
      scheduleReconnect();
    }
  }, [url, store]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptRef.current >= RECONNECT_DELAYS.length) {
      console.log('[WS] 重连次数已达上限');
      return;
    }

    setStatus('reconnecting');
    const delay = RECONNECT_DELAYS[reconnectAttemptRef.current];
    reconnectAttemptRef.current++;

    console.log(`[WS] ${delay}ms 后重连（第 ${reconnectAttemptRef.current} 次）`);

    reconnectTimerRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  // 发送画布编辑到服务端
  // 可选参数 canvas：本地操作直接传入 React Flow state（避免依赖 store）
  // 不传则从 store 读取（服务端同步后的状态）
  const sendCanvasEdit = useCallback((canvas?: { nodes: MermaidNode[]; edges: MermaidEdge[]; direction: FlowchartDirection }) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const s = store.getState();
    const data = canvas ?? s.getCanvas();
    wsRef.current.send(JSON.stringify({
      type: 'canvas_edit',
      payload: data,
    }));
  }, [store]);

  // 发送重置消费状态到服务端
  const sendResetConsumed = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'reset_consumed',
    }));
  }, []);

  // 发送视口变化到服务端（用户平移/缩放触发）
  const sendViewportEdit = useCallback((viewport: Viewport) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'viewport_edit',
      payload: { viewport },
    }));
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  return {
    status,
    sendCanvasEdit,
    sendResetConsumed,
    sendViewportEdit,
  };
}

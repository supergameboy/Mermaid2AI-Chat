/**
 * WebSocket 客户端 — 连接服务端，同步画布状态
 * 支持断线重连（指数退避）
 *
 * 多标签页架构：
 * - 处理 views_update / active_view_update / reconnect_sync 消息
 * - 发送 switch_view / create_view / close_view / rename_view / reorder_views 消息
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditorStore } from '../store.js';
import type { ActiveViewPayload } from '../store.js';
import type { MermaidNode, MermaidEdge, FlowchartDirection, Viewport, ViewSummary } from '@mermaid2aichat/serializer';

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

interface ViewportPayload {
  viewport: Viewport;
}

interface ViewsUpdatePayload {
  views: ViewSummary[];
  activeViewId: string | null;
}

interface ReconnectSyncPayload {
  views: ViewSummary[];
  activeViewId: string | null;
  activeView: ActiveViewPayload | null;
}

type WsServerMessage =
  | { type: 'canvas_update'; payload: CanvasPayload; timestamp: number }
  | { type: 'consumed_update'; payload: ConsumedPayload; timestamp: number }
  | { type: 'viewport_update'; payload: ViewportPayload; timestamp: number }
  | { type: 'views_update'; payload: ViewsUpdatePayload; timestamp: number }
  | { type: 'active_view_update'; payload: ActiveViewPayload; timestamp: number }
  | { type: 'reconnect_sync'; payload: ReconnectSyncPayload; timestamp: number };

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

          case 'viewport_update': {
            // 其他客户端的视口变化 → 同步到本地
            const payload = msg.payload;
            s.setViewportSync(payload.viewport);
            break;
          }

          case 'views_update': {
            // 视图列表更新（新建/关闭/重命名/排序）
            const payload = msg.payload;
            s.setViewsSync(payload.views, payload.activeViewId);
            break;
          }

          case 'active_view_update': {
            // 活动视图切换 → 同步完整内容
            const payload = msg.payload;
            s.setActiveViewContentSync(payload);
            break;
          }

          case 'reconnect_sync': {
            // 重连全量同步：视图列表 + 活动视图内容
            const payload = msg.payload;
            s.setViewsSync(payload.views, payload.activeViewId);
            if (payload.activeView) {
              s.setActiveViewContentSync(payload.activeView);
            }
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

  // === 发送消息方法 ===

  // 发送画布编辑到服务端
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

  // === 视图操作（客户端→服务端） ===

  // 切换活动视图
  const sendSwitchView = useCallback((viewId: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'switch_view',
      viewId,
    }));
  }, []);

  // 新建空白视图
  const sendCreateView = useCallback((title?: string | null) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'create_view',
      payload: { title: title ?? null },
    }));
  }, []);

  // 关闭视图
  const sendCloseView = useCallback((viewId: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'close_view',
      viewId,
    }));
  }, []);

  // 重命名视图
  const sendRenameView = useCallback((viewId: string, title: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'rename_view',
      viewId,
      title,
    }));
  }, []);

  // 重排序视图
  const sendReorderViews = useCallback((orderedIds: string[]) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'reorder_views',
      orderedIds,
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
    // 视图操作
    sendSwitchView,
    sendCreateView,
    sendCloseView,
    sendRenameView,
    sendReorderViews,
  };
}

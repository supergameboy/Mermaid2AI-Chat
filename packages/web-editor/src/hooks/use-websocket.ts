/**
 * WebSocket 客户端 — 连接服务端，同步画布状态
 * 支持断线重连（指数退避）
 *
 * 多标签页架构：
 * - 处理 views_update / active_view_update / reconnect_sync 消息
 * - 发送 switch_view / create_view / close_view / rename_view / reorder_views 消息
 *
 * 多图表类型：
 * - canvas_update 消息携带完整 CanvasState（联合类型）
 * - canvas_edit 消息发送 CanvasSnapshot（图结构类型）
 * - canvas_update_full 消息发送 CanvasState（数据图表类型全量更新）
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditorStore } from '../store.js';
import type { ActiveViewPayload } from '../store.js';
import type { CanvasState, GraphCanvasState, MermaidNode, MermaidEdge, FlowchartDirection, Viewport, ViewSummary } from '@mermaid2aichat/serializer';

type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

/** 图结构类型画布快照（用于 canvas_edit 消息） */
interface CanvasSnapshot {
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  direction: FlowchartDirection;
  /** 原始 Mermaid 代码（用于增量序列化保留格式） */
  rawCode?: string;
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
  | { type: 'canvas_update'; payload: CanvasState; timestamp: number }
  | { type: 'consumed_update'; payload: ConsumedPayload; timestamp: number }
  | { type: 'viewport_update'; payload: ViewportPayload; timestamp: number }
  | { type: 'views_update'; payload: ViewsUpdatePayload; timestamp: number }
  | { type: 'active_view_update'; payload: ActiveViewPayload; timestamp: number }
  | { type: 'reconnect_sync'; payload: ReconnectSyncPayload; timestamp: number };

/** 客户端→服务端消息类型 */
type WsClientMessage =
  | { type: 'canvas_edit'; payload: CanvasState }
  | { type: 'reset_consumed' }
  | { type: 'viewport_edit'; payload: ViewportPayload }
  | { type: 'switch_view'; viewId: string }
  | { type: 'create_view'; payload?: { title?: string | null } }
  | { type: 'close_view'; viewId: string }
  | { type: 'rename_view'; viewId: string; title: string }
  | { type: 'reorder_views'; orderedIds: string[] };

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
            // 服务端画布更新（联合类型 CanvasState）→ 同步到本地
            s.setCanvasSync(msg.payload);
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

  // 发送画布编辑到服务端（图结构类型快照）
  const sendCanvasEdit = useCallback((canvas?: CanvasSnapshot) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const s = store.getState();
    // 从 activeCanvas 构造完整 CanvasState 发送到服务端
    const activeCanvas = s.getActiveCanvas();
    // 图结构类型才发送 canvas_edit
    if (!isGraphCanvasStateLocal(activeCanvas)) return;
    const snapshot = canvas ?? s.getCanvas();
    // 类型已收窄为 GraphCanvasState，构造完整 CanvasState
    const fullCanvas: GraphCanvasState = {
      ...activeCanvas,
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      direction: snapshot.direction,
      // rawCode 优先来自 canvas 参数（GraphCanvas 的 getCanvasSnapshot），否则回退到 activeCanvas
      ...(snapshot.rawCode !== undefined
        ? { rawCode: snapshot.rawCode }
        : activeCanvas.rawCode !== undefined
          ? { rawCode: activeCanvas.rawCode }
          : {}),
    };
    const msg: WsClientMessage = { type: 'canvas_edit', payload: fullCanvas };
    wsRef.current.send(JSON.stringify(msg));
  }, [store]);

  // 发送画布更新到服务端（数据图表类型全量更新）
  const sendCanvasUpdate = useCallback((canvas: CanvasState) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const msg: WsClientMessage = { type: 'canvas_edit', payload: canvas };
    wsRef.current.send(JSON.stringify(msg));
  }, []);

  // 发送重置消费状态到服务端
  const sendResetConsumed = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'reset_consumed',
    } satisfies WsClientMessage));
  }, []);

  // 发送视口变化到服务端（用户平移/缩放触发）
  const sendViewportEdit = useCallback((viewport: Viewport) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const msg: WsClientMessage = { type: 'viewport_edit', payload: { viewport } };
    wsRef.current.send(JSON.stringify(msg));
  }, []);

  // === 视图操作（客户端→服务端） ===

  // 切换活动视图
  const sendSwitchView = useCallback((viewId: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const msg: WsClientMessage = { type: 'switch_view', viewId };
    wsRef.current.send(JSON.stringify(msg));
  }, []);

  // 新建空白视图
  const sendCreateView = useCallback((title?: string | null) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const msg: WsClientMessage = { type: 'create_view', payload: { title: title ?? null } };
    wsRef.current.send(JSON.stringify(msg));
  }, []);

  // 关闭视图
  const sendCloseView = useCallback((viewId: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const msg: WsClientMessage = { type: 'close_view', viewId };
    wsRef.current.send(JSON.stringify(msg));
  }, []);

  // 重命名视图
  const sendRenameView = useCallback((viewId: string, title: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const msg: WsClientMessage = { type: 'rename_view', viewId, title };
    wsRef.current.send(JSON.stringify(msg));
  }, []);

  // 重排序视图
  const sendReorderViews = useCallback((orderedIds: string[]) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const msg: WsClientMessage = { type: 'reorder_views', orderedIds };
    wsRef.current.send(JSON.stringify(msg));
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
    sendCanvasUpdate,
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

/** 本地图结构类型守卫（避免循环依赖） */
function isGraphCanvasStateLocal(canvas: CanvasState): canvas is GraphCanvasState {
  return (
    canvas.diagramType === 'flowchart' ||
    canvas.diagramType === 'sequenceDiagram' ||
    canvas.diagramType === 'classDiagram' ||
    canvas.diagramType === 'erDiagram' ||
    canvas.diagramType === 'mindmap' ||
    canvas.diagramType === 'stateDiagram' ||
    canvas.diagramType === 'architecture'
  );
}

/**
 * WebSocket 服务器 — 多工作区状态广播、客户端管理、断线重连支持
 *
 * 架构：
 * - WsServer 管理 WebSocketServer，通过 WorkspaceRegistry 路由到对应工作区
 * - WsClientConnection 绑定特定工作区，处理该工作区的消息
 * - 广播责任：WsServer 显式调用广播方法（不通过 Store 订阅自动广播）
 *
 * 消息类型:
 * 服务器→客户端: canvas_update, consumed_update, viewport_update, views_update, active_view_update, reconnect_sync
 * 客户端→服务器: canvas_edit, reset_consumed, viewport_edit, switch_view, create_view, close_view, rename_view, reorder_views
 *
 * 多客户端冲突: Last Write Wins（最后写入胜出）
 * 断线重连: 客户端重连后发送 reconnect_sync 全量同步
 */
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type {
  MermaidEdge,
  MermaidNode,
  FlowchartDirection,
  Viewport,
  ViewSummary,
  ActiveViewPayload,
  ConsumedState,
} from '@mermaid2aichat/serializer';
import type { WorkspaceRegistry } from './workspace-registry.js';
import type { EditorStoreInstance, ViewContentLoader } from './store.js';
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

export interface ViewportPayload {
  viewport: Viewport;
}

export interface ViewsUpdatePayload {
  views: ViewSummary[];
  activeViewId: string | null;
}

export interface ReconnectSyncPayload {
  views: ViewSummary[];
  activeViewId: string | null;
  activeView: ActiveViewPayload | null;
}

export type WsServerMessage =
  | { type: 'canvas_update'; payload: CanvasPayload; timestamp: number }
  | { type: 'consumed_update'; payload: ConsumedPayload; timestamp: number }
  | { type: 'viewport_update'; payload: ViewportPayload; timestamp: number }
  | { type: 'views_update'; payload: ViewsUpdatePayload; timestamp: number }
  | { type: 'active_view_update'; payload: ActiveViewPayload; timestamp: number }
  | { type: 'reconnect_sync'; payload: ReconnectSyncPayload; timestamp: number };

export type WsClientMessage =
  | { type: 'canvas_edit'; payload: CanvasPayload }
  | { type: 'reset_consumed' }
  | { type: 'viewport_edit'; payload: ViewportPayload }
  | { type: 'switch_view'; viewId: string }
  | { type: 'create_view'; payload?: { title?: string | null } }
  | { type: 'close_view'; viewId: string }
  | { type: 'rename_view'; viewId: string; title: string }
  | { type: 'reorder_views'; orderedIds: string[] };

/** 单个 WebSocket 连接，绑定特定工作区 */
class WsClientConnection {
  constructor(
    private ws: WebSocket,
    private store: EditorStoreInstance,
    private workspaceRoot: string,
    private wsServer: WsServer,
    private loader: ViewContentLoader
  ) {
    // 发送全量同步
    this.sendReconnectSync();
    // 监听消息
    this.ws.on('message', (data: Buffer) => {
      void this.handleMessage(data);
    });
    // 注意：不通过 Store 订阅自动广播，广播由 WsServer 显式调用
  }

  getWebSocket(): WebSocket {
    return this.ws;
  }

  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  private async handleMessage(data: Buffer): Promise<void> {
    let msg: WsClientMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      console.error('[WS] 消息解析失败');
      return;
    }

    console.log(`[WS] 收到消息: ${msg.type}`);

    switch (msg.type) {
      case 'canvas_edit': {
        // 用户编辑画布 → 更新 Store + 触发 CANVAS_EDIT 事件
        const payload = msg.payload;
        const state = this.store.getState();
        state.updateActiveCanvas({
          nodes: payload.nodes,
          edges: payload.edges,
          direction: payload.direction,
        });

        // CANVAS_EDIT 事件重置 consumed
        const currentState = this.store.getState().getActiveConsumed();
        const newState = consumedReducer(currentState, { type: 'CANVAS_EDIT' });
        this.store.getState().updateActiveConsumed(newState);

        // 显式广播给其他客户端
        this.wsServer.broadcastCanvasUpdate(this.workspaceRoot, payload, this);
        // 广播消费状态变化（CANVAS_EDIT 重置了 consumed）
        this.wsServer.broadcastConsumedUpdate(this.workspaceRoot, this.store.getState().getActiveConsumed());
        break;
      }

      case 'reset_consumed': {
        // 用户点击"重新启用" → 触发 RESET 事件
        const currentState = this.store.getState().getActiveConsumed();
        const newState = consumedReducer(currentState, { type: 'RESET' });
        this.store.getState().updateActiveConsumed(newState);

        // 广播给所有客户端
        this.wsServer.broadcastConsumedUpdate(this.workspaceRoot, this.store.getState().getActiveConsumed());
        break;
      }

      case 'viewport_edit': {
        // 用户平移/缩放画布 → 更新 Store（不重置 consumed）+ 广播给其他客户端
        const payload = msg.payload;
        this.store.getState().updateActiveViewport(payload.viewport);

        // 广播给其他客户端（与 canvas_update 一致，避免回传给发起方）
        this.wsServer.broadcastViewportUpdate(this.workspaceRoot, payload, this);
        break;
      }

      case 'switch_view': {
        // 用户切换标签页 → 异步加载 + 广播
        this.store.getState().switchView(msg.viewId, this.loader).then(() => {
          this.wsServer.broadcastViewsUpdate(this.workspaceRoot);
          this.wsServer.broadcastActiveViewUpdate(this.workspaceRoot);
        }).catch((err) => {
          console.error('[WS] switch_view 失败:', err);
        });
        break;
      }

      case 'create_view': {
        // 用户手动创建新视图
        const state = this.store.getState();

        // 1. 保存旧活动视图内容到磁盘（防止内容丢失）
        if (state.activeViewId) {
          await this.loader.saveViewContent(state.activeViewId, {
            canvas: state.activeCanvas,
            consumed: state.activeConsumed,
            viewport: state.activeViewport,
          });
        }

        // 2. 创建新视图
        const newViewId = state.createView({
          title: msg.payload?.title ?? null,
          source: 'user',
          sessionId: null,
          canvas: { nodes: [], edges: [], direction: 'TD' },
          consumed: { consumed: false, lastConsumedAt: null, canvasSource: null },
          viewport: { x: 0, y: 0, zoom: 1 },
        });

        // 3. 保存新视图内容到磁盘
        await this.loader.saveViewContent(newViewId, {
          canvas: { nodes: [], edges: [], direction: 'TD' },
          consumed: { consumed: false, lastConsumedAt: null, canvasSource: null },
          viewport: { x: 0, y: 0, zoom: 1 },
        });

        // 4. 广播
        this.wsServer.broadcastViewsUpdate(this.workspaceRoot);
        this.wsServer.broadcastActiveViewUpdate(this.workspaceRoot);
        break;
      }

      case 'close_view': {
        // 用户关闭标签页
        const prevActiveViewId = this.store.getState().getActiveViewId();
        this.store.getState().closeView(msg.viewId, this.loader).then(() => {
          const currActiveViewId = this.store.getState().getActiveViewId();
          this.wsServer.broadcastViewsUpdate(this.workspaceRoot);
          // 若活动视图切换（关闭的是活动视图），广播 active_view_update
          if (prevActiveViewId !== currActiveViewId) {
            this.wsServer.broadcastActiveViewUpdate(this.workspaceRoot);
          }
        }).catch((err) => {
          console.error('[WS] close_view 失败:', err);
        });
        break;
      }

      case 'rename_view': {
        // 用户重命名视图
        this.store.getState().renameView(msg.viewId, msg.title);
        this.wsServer.broadcastViewsUpdate(this.workspaceRoot);
        break;
      }

      case 'reorder_views': {
        // 用户重排序视图
        this.store.getState().reorderViews(msg.orderedIds);
        this.wsServer.broadcastViewsUpdate(this.workspaceRoot);
        break;
      }
    }
  }

  /** 发送全量状态给重连客户端 */
  sendReconnectSync(): void {
    const state = this.store.getState();
    const activeViewId = state.activeViewId;

    let activeView: ActiveViewPayload | null = null;
    if (activeViewId) {
      activeView = {
        viewId: activeViewId,
        canvas: state.activeCanvas,
        consumed: state.activeConsumed,
        viewport: state.activeViewport,
        title: state.activeTitle,
      };
    }

    const payload: ReconnectSyncPayload = {
      views: state.views,
      activeViewId,
      activeView,
    };

    this.send({
      type: 'reconnect_sync',
      payload,
      timestamp: Date.now(),
    });
  }

  /** 发送消息到客户端 */
  send(message: WsServerMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

export class WsServer {
  private wss: WebSocketServer;
  private registry: WorkspaceRegistry;
  /** workspaceRoot → Set<WsClientConnection> */
  private workspaceClients = new Map<string, Set<WsClientConnection>>();

  constructor(server: Server, registry: WorkspaceRegistry) {
    this.registry = registry;
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      void this.handleConnection(ws, req);
    });
  }

  private async handleConnection(ws: WebSocket, req: import('http').IncomingMessage): Promise<void> {
    // 从 URL query 解析 workspaceRoot（严格校验，无 fallback）
    const url = new URL(req.url ?? '', 'http://localhost');
    const workspaceRoot = url.searchParams.get('workspaceRoot');

    if (!workspaceRoot) {
      ws.close(4000, 'Missing workspaceRoot parameter');
      return;
    }

    try {
      // 获取或创建工作区上下文
      const { store, persistence } = await this.registry.getOrCreate(workspaceRoot);

      // 创建 ViewContentLoader 适配器
      const loader: ViewContentLoader = {
        loadViewContent: async (viewId: string) => {
          const content = await persistence.loadViewContent(viewId);
          return content;
        },
        saveViewContent: async (viewId: string, content) => {
          await persistence.updateViewContent(viewId, content);
        },
        deleteViewContent: async (viewId: string) => {
          await persistence.deleteViewContent(viewId);
        },
      };

      // 创建客户端连接
      const client = new WsClientConnection(ws, store, workspaceRoot, this, loader);

      // 加入工作区客户端集合
      let clients = this.workspaceClients.get(workspaceRoot);
      if (!clients) {
        clients = new Set();
        this.workspaceClients.set(workspaceRoot, clients);
      }
      clients.add(client);

      console.log(`[WS] 客户端连接 workspace=${workspaceRoot}, 当前 ${clients.size} 个客户端`);

      ws.on('close', () => {
        clients?.delete(client);
        console.log(`[WS] 客户端断开, 当前 ${clients?.size ?? 0} 个客户端`);
      });

      ws.on('error', (err: Error) => {
        console.error('[WS] 客户端错误:', err.message);
        clients?.delete(client);
      });
    } catch (err) {
      console.error('[WS] 工作区初始化失败:', err);
      ws.close(4001, 'Workspace initialization failed');
    }
  }

  // === 显式广播方法（由 MCP 工具 / WS 消息处理器调用） ===

  /** 广播视图列表更新（views_update）给指定工作区所有客户端 */
  broadcastViewsUpdate(workspaceRoot: string): void {
    const ctx = this.registry.get(workspaceRoot);
    if (!ctx) return;

    const state = ctx.store.getState();
    const message: WsServerMessage = {
      type: 'views_update',
      payload: {
        views: state.views,
        activeViewId: state.activeViewId,
      },
      timestamp: Date.now(),
    };
    this.broadcastToWorkspace(workspaceRoot, message);
  }

  /** 广播活动视图切换（active_view_update，携带完整内容）给指定工作区所有客户端 */
  broadcastActiveViewUpdate(workspaceRoot: string): void {
    const ctx = this.registry.get(workspaceRoot);
    if (!ctx) return;

    const state = ctx.store.getState();
    if (!state.activeViewId) return;

    const payload: ActiveViewPayload = {
      viewId: state.activeViewId,
      canvas: state.activeCanvas,
      consumed: state.activeConsumed,
      viewport: state.activeViewport,
      title: state.activeTitle,
    };

    const message: WsServerMessage = {
      type: 'active_view_update',
      payload,
      timestamp: Date.now(),
    };
    this.broadcastToWorkspace(workspaceRoot, message);
  }

  /** 广播画布更新（canvas_update）给指定工作区除发送方外所有客户端 */
  broadcastCanvasUpdate(workspaceRoot: string, payload: CanvasPayload, excludeClient?: WsClientConnection): void {
    const message: WsServerMessage = {
      type: 'canvas_update',
      payload,
      timestamp: Date.now(),
    };
    this.broadcastToWorkspace(workspaceRoot, message, excludeClient);
  }

  /** 广播消费状态更新（consumed_update）给指定工作区所有客户端 */
  broadcastConsumedUpdate(workspaceRoot: string, consumed: ConsumedState): void {
    const payload: ConsumedPayload = {
      consumed: consumed.consumed,
      lastConsumedAt: consumed.lastConsumedAt,
      canvasSource: consumed.canvasSource,
    };
    const message: WsServerMessage = {
      type: 'consumed_update',
      payload,
      timestamp: Date.now(),
    };
    this.broadcastToWorkspace(workspaceRoot, message);
  }

  /** 广播视口更新（viewport_update）给指定工作区除发送方外所有客户端 */
  broadcastViewportUpdate(workspaceRoot: string, payload: ViewportPayload, excludeClient?: WsClientConnection): void {
    const message: WsServerMessage = {
      type: 'viewport_update',
      payload,
      timestamp: Date.now(),
    };
    this.broadcastToWorkspace(workspaceRoot, message, excludeClient);
  }

  /** 广播给指定工作区所有客户端（可选排除发送方） */
  private broadcastToWorkspace(workspaceRoot: string, message: WsServerMessage, excludeClient?: WsClientConnection): void {
    const clients = this.workspaceClients.get(workspaceRoot);
    if (!clients) return;

    const data = JSON.stringify(message);
    for (const client of clients) {
      if (client === excludeClient) continue;
      const ws = client.getWebSocket();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  /** 关闭 WebSocket 服务器 */
  close(): void {
    for (const clients of this.workspaceClients.values()) {
      for (const client of clients) {
        client.getWebSocket().close();
      }
    }
    this.workspaceClients.clear();
    this.wss.close();
  }
}

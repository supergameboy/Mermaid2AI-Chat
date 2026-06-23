/**
 * Webview 面板管理器 — 创建面板、桥接 WebSocket ↔ Webview
 *
 * 数据流：
 * - 服务端 → WebSocket → onMessage → webview.postMessage → Canvas/TabBar
 * - Canvas/TabBar → webview.postMessage → onDidReceiveMessage → WebSocket send
 *
 * 多标签页架构：
 * - 转发 views_update / active_view_update / 扩展 reconnect_sync
 * - 转发 switch_view / create_view / close_view / rename_view / reorder_views
 * - WebSocket URL 携带 workspaceRoot 参数
 *
 * 多图表类型：
 * - PanelState.activeCanvas 为唯一真相源（CanvasState 联合类型）
 * - nodes/edges/direction 为图结构类型的派生字段
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WsClient, type WsServerMessage, type WsClientMessage, type ConnectionStatus, type ViewportPayload, type ActiveViewPayload, type ViewsUpdatePayload, type ReconnectSyncPayload } from './ws-client.js';
import type { CanvasState, CanvasSource, FlowchartDirection, MermaidEdge, MermaidNode, Viewport, ViewSummary } from '@mermaid2aichat/serializer';
import { isGraphCanvasState, migrateCanvasState } from '@mermaid2aichat/serializer';

// === Webview ↔ Extension 消息类型 ===

/** Webview → Extension */
interface WebviewMessage {
  type: 'canvas_edit' | 'canvas_update' | 'reset_consumed' | 'viewport_edit' | 'switch_view' | 'create_view' | 'close_view' | 'rename_view' | 'reorder_views' | 'ready';
  payload?: unknown;
  viewId?: string;
  title?: string;
  orderedIds?: string[];
}

/** Extension → Webview */
interface ExtensionMessage {
  type: 'canvas_update' | 'consumed_update' | 'viewport_update' | 'views_update' | 'active_view_update' | 'reconnect_sync' | 'connection_status';
  payload: unknown;
}

// === 状态（用于面板重新打开时恢复） ===

interface PanelState {
  // 视图列表
  views: ViewSummary[];
  activeViewId: string | null;
  // 活动视图内容（activeCanvas 为唯一真相源）
  activeCanvas: CanvasState;
  // 图结构类型派生字段（仅当 activeCanvas 为 GraphCanvasState 时有效）
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  direction: FlowchartDirection;
  viewport: Viewport | null;
  consumed: boolean;
  lastConsumedAt: number | null;
  canvasSource: CanvasSource;
  title: string | null;
  connectionStatus: ConnectionStatus;
}

/** 从 CanvasState 派生图结构字段 */
function deriveGraphFields(canvas: CanvasState): {
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  direction: FlowchartDirection;
} {
  if (isGraphCanvasState(canvas)) {
    return {
      nodes: canvas.nodes,
      edges: canvas.edges,
      direction: canvas.direction ?? 'TD',
    };
  }
  return { nodes: [], edges: [], direction: 'TD' };
}

function createDefaultCanvas(): CanvasState {
  return { diagramType: 'flowchart', nodes: [], edges: [], direction: 'TD' };
}

const initialState: PanelState = {
  views: [],
  activeViewId: null,
  activeCanvas: createDefaultCanvas(),
  nodes: [],
  edges: [],
  direction: 'TD',
  viewport: null,
  consumed: false,
  lastConsumedAt: null,
  canvasSource: null,
  title: null,
  connectionStatus: 'disconnected',
};

export class PanelManager {
  private panel: vscode.WebviewPanel | null = null;
  private wsClient: WsClient;
  private state: PanelState = { ...initialState };
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly workspaceRoot: string
  ) {
    // 构建 WebSocket URL（携带 workspaceRoot 参数）
    const wsUrl = `ws://localhost:14514/ws?workspaceRoot=${encodeURIComponent(workspaceRoot)}`;
    this.wsClient = new WsClient(wsUrl);
    this.setupWebSocket();
  }

  private setupWebSocket(): void {
    // 服务端消息 → 转发给 Webview
    const unsubMessages = this.wsClient.onMessage((msg: WsServerMessage) => {
      this.handleServerMessage(msg);
    });

    // 连接状态 → 转发给 Webview
    const unsubStatus = this.wsClient.onStatusChange((status: ConnectionStatus) => {
      this.state.connectionStatus = status;
      this.postMessage({ type: 'connection_status', payload: status });
    });

    this.disposables.push({ dispose: unsubMessages });
    this.disposables.push({ dispose: unsubStatus });
  }

  private handleServerMessage(msg: WsServerMessage): void {
    switch (msg.type) {
      case 'canvas_update': {
        // 服务端画布更新（联合类型 CanvasState）
        const canvas = migrateCanvasState(msg.payload);
        this.state.activeCanvas = canvas;
        const derived = deriveGraphFields(canvas);
        this.state.nodes = derived.nodes;
        this.state.edges = derived.edges;
        this.state.direction = derived.direction;
        this.postMessage({ type: 'canvas_update', payload: canvas });
        break;
      }
      case 'consumed_update': {
        const payload = msg.payload;
        this.state.consumed = payload.consumed;
        this.state.lastConsumedAt = payload.lastConsumedAt;
        this.state.canvasSource = payload.canvasSource;
        this.postMessage({ type: 'consumed_update', payload });
        break;
      }
      case 'viewport_update': {
        const payload = msg.payload;
        this.state.viewport = payload.viewport;
        this.postMessage({ type: 'viewport_update', payload });
        break;
      }
      case 'views_update': {
        const payload: ViewsUpdatePayload = msg.payload;
        this.state.views = payload.views;
        this.state.activeViewId = payload.activeViewId;
        this.postMessage({ type: 'views_update', payload });
        break;
      }
      case 'active_view_update': {
        const payload: ActiveViewPayload = msg.payload;
        this.state.activeViewId = payload.viewId;
        const migrated = migrateCanvasState(payload.canvas);
        this.state.activeCanvas = migrated;
        const derived = deriveGraphFields(migrated);
        this.state.nodes = derived.nodes;
        this.state.edges = derived.edges;
        this.state.direction = derived.direction;
        this.state.consumed = payload.consumed.consumed;
        this.state.lastConsumedAt = payload.consumed.lastConsumedAt;
        this.state.canvasSource = payload.consumed.canvasSource;
        this.state.viewport = payload.viewport;
        this.state.title = payload.title;
        this.postMessage({ type: 'active_view_update', payload });
        // 自动聚焦面板（AI 创建新视图时）
        this.panel?.reveal(vscode.ViewColumn.Active);
        break;
      }
      case 'reconnect_sync': {
        const payload: ReconnectSyncPayload = msg.payload;
        this.state.views = payload.views;
        this.state.activeViewId = payload.activeViewId;
        if (payload.activeView) {
          const av = payload.activeView;
          const migrated = migrateCanvasState(av.canvas);
          this.state.activeCanvas = migrated;
          const derived = deriveGraphFields(migrated);
          this.state.nodes = derived.nodes;
          this.state.edges = derived.edges;
          this.state.direction = derived.direction;
          this.state.consumed = av.consumed.consumed;
          this.state.lastConsumedAt = av.consumed.lastConsumedAt;
          this.state.canvasSource = av.consumed.canvasSource;
          this.state.viewport = av.viewport;
          this.state.title = av.title;
        }
        this.postMessage({ type: 'reconnect_sync', payload });
        break;
      }
    }
  }

  openPanel(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active);
      return;
    }

    // 创建面板
    this.panel = vscode.window.createWebviewPanel(
      'mermaid2aichat',
      'Mermaid2AIChat',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'),
        ],
      }
    );

    this.panel.title = 'Mermaid2AIChat';
    this.panel.webview.html = this.getWebviewHtml(this.panel.webview);

    // 接收 Webview 消息 → 转发给 WebSocket
    const messageDisposable = this.panel.webview.onDidReceiveMessage(
      (msg: WebviewMessage) => {
        this.handleWebviewMessage(msg);
      },
      null,
      this.context.subscriptions
    );

    // 面板关闭时清理
    this.panel.onDidDispose(
      () => {
        this.panel = null;
        messageDisposable.dispose();
        vscode.commands.executeCommand('setContext', 'mermaid2aichat.panelOpen', false);
      },
      null,
      this.context.subscriptions
    );

    vscode.commands.executeCommand('setContext', 'mermaid2aichat.panelOpen', true);

    // 连接 WebSocket
    // 注意：sendCurrentState 改为在收到 webview 的 'ready' 消息后调用
    // 避免在 webview 挂载前发送消息导致丢失
    if (this.wsClient.getStatus() === 'disconnected') {
      this.wsClient.connect();
    }
  }

  private handleWebviewMessage(msg: WebviewMessage): void {
    // webview 挂载完成通知 → 发送初始状态
    // 解决竞态条件：openPanel 时 webview 还没挂载，消息会丢失
    if (msg.type === 'ready') {
      this.sendCurrentState();
      return;
    }

    let wsMsg: WsClientMessage;
    switch (msg.type) {
      case 'canvas_edit':
      case 'canvas_update':
        // canvas_edit（图结构类型）和 canvas_update（数据图表类型）都发送 CanvasState
        wsMsg = { type: 'canvas_edit', payload: msg.payload as CanvasState };
        break;
      case 'reset_consumed':
        wsMsg = { type: 'reset_consumed' };
        break;
      case 'viewport_edit':
        wsMsg = { type: 'viewport_edit', payload: msg.payload as ViewportPayload };
        break;
      case 'switch_view':
        wsMsg = { type: 'switch_view', viewId: msg.viewId! };
        break;
      case 'create_view':
        wsMsg = { type: 'create_view', payload: { title: msg.title ?? null } };
        break;
      case 'close_view':
        wsMsg = { type: 'close_view', viewId: msg.viewId! };
        break;
      case 'rename_view':
        wsMsg = { type: 'rename_view', viewId: msg.viewId!, title: msg.title! };
        break;
      case 'reorder_views':
        wsMsg = { type: 'reorder_views', orderedIds: msg.orderedIds! };
        break;
    }
    this.wsClient.send(wsMsg);
  }

  /** 发送当前完整状态给 Webview（面板打开时） */
  private sendCurrentState(): void {
    // 发送视图列表 + 活动视图完整内容（含 activeCanvas）
    this.postMessage({
      type: 'reconnect_sync',
      payload: {
        views: this.state.views,
        activeViewId: this.state.activeViewId,
        activeView: this.state.activeViewId ? {
          viewId: this.state.activeViewId,
          canvas: this.state.activeCanvas,
          consumed: {
            consumed: this.state.consumed,
            lastConsumedAt: this.state.lastConsumedAt,
            canvasSource: this.state.canvasSource,
          },
          viewport: this.state.viewport ?? { x: 0, y: 0, zoom: 1 },
          title: this.state.title,
        } : null,
      },
    });
    this.postMessage({
      type: 'connection_status',
      payload: this.state.connectionStatus,
    });
  }

  private postMessage(msg: ExtensionMessage): void {
    this.panel?.webview.postMessage(msg);
  }

  /** 生成 Webview HTML */
  private getWebviewHtml(webview: vscode.Webview): string {
    const webviewDir = path.join(this.context.extensionPath, 'dist', 'webview');
    const indexHtmlPath = path.join(webviewDir, 'index.html');

    if (!fs.existsSync(indexHtmlPath)) {
      return this.getErrorHtml('Webview 未构建。请先运行 pnpm --filter @mermaid2aichat/vscode-extension build:webview');
    }

    let html = fs.readFileSync(indexHtmlPath, 'utf-8');

    // 替换资源路径为 webview URI
    const nonce = this.getNonce();
    const cspSource = webview.cspSource;

    // 注入 CSP
    const csp = [
      `default-src 'none'`,
      `img-src ${cspSource} https: data:`,
      `style-src ${cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}' ${cspSource}`,
      `font-src ${cspSource}`,
    ].join('; ');

    html = html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`);

    // 替换相对路径为 webview URI
    const assetsDir = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'assets');
    html = html.replace(/href="\.\/assets\//g, `href="${webview.asWebviewUri(assetsDir).toString()}/`);
    html = html.replace(/src="\.\/assets\//g, `src="${webview.asWebviewUri(assetsDir).toString()}/`);

    // 注入 nonce 到所有 script 标签
    html = html.replace(/<script /g, `<script nonce="${nonce}" `);

    // 注入 vscode API
    const vscodeApiScript = `<script nonce="${nonce}">window.vscode = acquireVsCodeApi();</script>`;
    html = html.replace('</head>', `${vscodeApiScript}</head>`);

    return html;
  }

  private getErrorHtml(message: string): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>错误</title></head>
<body style="padding: 20px; font-family: sans-serif; color: #333;">
<h2>Mermaid2AIChat</h2>
<p style="color: #d32f2f;">${message}</p>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  dispose(): void {
    this.wsClient.disconnect();
    this.panel?.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}

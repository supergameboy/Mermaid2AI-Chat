/**
 * Webview 面板管理器 — 创建面板、桥接 WebSocket ↔ Webview
 *
 * 数据流：
 * - 服务端 → WebSocket → onMessage → webview.postMessage → Canvas syncNodes
 * - Canvas onCanvasEdit → webview.postMessage → onDidReceiveMessage → WebSocket send
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WsClient, type WsServerMessage, type WsClientMessage, type ConnectionStatus } from './ws-client.js';
import type { MermaidEdge, MermaidNode, FlowchartDirection, CanvasSource, Viewport } from '@mermaid-editor/serializer';

// === Webview ↔ Extension 消息类型 ===

/** Webview → Extension */
interface WebviewMessage {
  type: 'canvas_edit' | 'reset_consumed' | 'viewport_edit';
  payload?: unknown;
}

/** Extension → Webview */
interface ExtensionMessage {
  type: 'canvas_update' | 'consumed_update' | 'create_view' | 'reconnect_sync' | 'connection_status' | 'viewport_update';
  payload: unknown;
}

// === 状态（用于面板重新打开时恢复） ===

interface PanelState {
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

const initialState: PanelState = {
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

  constructor(private readonly context: vscode.ExtensionContext) {
    this.wsClient = new WsClient();
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
        const payload = msg.payload as { nodes: MermaidNode[]; edges: MermaidEdge[]; direction: FlowchartDirection };
        this.state.nodes = payload.nodes;
        this.state.edges = payload.edges;
        this.state.direction = payload.direction;
        this.postMessage({ type: 'canvas_update', payload });
        break;
      }
      case 'consumed_update': {
        const payload = msg.payload as { consumed: boolean; lastConsumedAt: number | null; canvasSource: CanvasSource };
        this.state.consumed = payload.consumed;
        this.state.lastConsumedAt = payload.lastConsumedAt;
        this.state.canvasSource = payload.canvasSource;
        this.postMessage({ type: 'consumed_update', payload });
        break;
      }
      case 'create_view': {
        const payload = msg.payload as { title?: string | null; mermaid?: string };
        this.state.title = payload.title ?? null;
        this.postMessage({ type: 'create_view', payload });
        // 自动聚焦面板
        this.panel?.reveal(vscode.ViewColumn.Active);
        break;
      }
      case 'viewport_update': {
        const payload = msg.payload as { viewport: Viewport };
        this.state.viewport = payload.viewport;
        this.postMessage({ type: 'viewport_update', payload });
        break;
      }
      case 'reconnect_sync': {
        const payload = msg.payload as {
          canvas: { nodes: MermaidNode[]; edges: MermaidEdge[]; direction: FlowchartDirection };
          consumed: { consumed: boolean; lastConsumedAt: number | null; canvasSource: CanvasSource };
          title: string | null;
          viewport: Viewport;
        };
        this.state.nodes = payload.canvas.nodes;
        this.state.edges = payload.canvas.edges;
        this.state.direction = payload.canvas.direction;
        this.state.consumed = payload.consumed.consumed;
        this.state.lastConsumedAt = payload.consumed.lastConsumedAt;
        this.state.canvasSource = payload.consumed.canvasSource;
        this.state.title = payload.title;
        this.state.viewport = payload.viewport;
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
      'mermaidEditor',
      'Mermaid 编辑器',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'),
        ],
      }
    );

    this.panel.title = 'Mermaid 编辑器';
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
        vscode.commands.executeCommand('setContext', 'mermaid-editor.panelOpen', false);
      },
      null,
      this.context.subscriptions
    );

    vscode.commands.executeCommand('setContext', 'mermaid-editor.panelOpen', true);

    // 发送当前状态给 Webview（面板刚打开时）
    this.sendCurrentState();

    // 连接 WebSocket
    if (this.wsClient.getStatus() === 'disconnected') {
      this.wsClient.connect();
    }
  }

  private handleWebviewMessage(msg: WebviewMessage): void {
    const wsMsg: WsClientMessage = {
      type: msg.type,
      payload: msg.payload,
    };
    this.wsClient.send(wsMsg);
  }

  /** 发送当前完整状态给 Webview（面板打开时） */
  private sendCurrentState(): void {
    this.postMessage({
      type: 'reconnect_sync',
      payload: {
        canvas: {
          nodes: this.state.nodes,
          edges: this.state.edges,
          direction: this.state.direction,
        },
        consumed: {
          consumed: this.state.consumed,
          lastConsumedAt: this.state.lastConsumedAt,
          canvasSource: this.state.canvasSource,
        },
        title: this.state.title,
        viewport: this.state.viewport ?? { x: 0, y: 0, zoom: 1 },
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
      return this.getErrorHtml('Webview 未构建。请先运行 pnpm --filter @mermaid-editor/vscode-extension build:webview');
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
<h2>Mermaid 编辑器</h2>
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

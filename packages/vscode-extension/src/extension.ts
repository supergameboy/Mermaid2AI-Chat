/**
 * VSCode 插件入口 — 注册命令、管理生命周期
 *
 * 命令：mermaid-editor.openPanel — 打开 Mermaid 编辑器面板（自动确保服务端运行）
 */
import * as vscode from 'vscode';
import { PanelManager } from './panel-manager.js';
import { ServerManager } from './server-manager.js';

let panelManager: PanelManager | null = null;
let serverManager: ServerManager | null = null;

export function activate(context: vscode.ExtensionContext): void {
  console.log('[Mermaid Editor] 插件已激活');

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('Mermaid 编辑器需要在工作区中运行');
    return;
  }

  serverManager = new ServerManager(workspaceRoot);
  context.subscriptions.push(serverManager);

  panelManager = new PanelManager(context);

  const openPanelCommand = vscode.commands.registerCommand(
    'mermaid-editor.openPanel',
    async () => {
      if (!serverManager || !panelManager) return;

      // 确保服务端运行（已运行则复用，未运行则自动启动）
      try {
        await serverManager.ensureRunning();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        serverManager.showOutput();
        vscode.window.showErrorMessage(`Mermaid 服务端启动失败: ${msg}`);
        return;
      }

      panelManager.openPanel();
    }
  );

  context.subscriptions.push(openPanelCommand);
}

export function deactivate(): void {
  panelManager?.dispose();
  panelManager = null;
  // serverManager 由 context.subscriptions 自动 dispose
  console.log('[Mermaid Editor] 插件已停用');
}

/**
 * ServerManager — 管理 MCP 服务端子进程生命周期
 *
 * 职责：
 * - 检查服务端是否已运行（健康检查），复用现有实例
 * - 未运行时启动子进程（pnpm --filter @mermaid-editor/server start）
 * - 等待服务端就绪
 * - 插件卸载时终止子进程（仅限由本插件启动的实例）
 *
 * 日志输出到 VSCode OutputChannel，便于调试
 */
import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as http from 'http';

const HEALTH_URL = 'http://localhost:14514/health';
const HEALTH_TIMEOUT_MS = 1000;
const READY_TIMEOUT_MS = 20000;
const READY_POLL_INTERVAL_MS = 500;

export class ServerManager implements vscode.Disposable {
  private childProcess: cp.ChildProcess | null = null;
  private readonly outputChannel: vscode.OutputChannel;
  /** 是否由本插件启动（决定 dispose 时是否终止） */
  private managedByUs = false;

  constructor(private readonly workspaceRoot: string) {
    this.outputChannel = vscode.window.createOutputChannel('Mermaid Editor Server');
  }

  /**
   * 确保服务端正在运行
   * - 已运行（外部或之前启动）→ 复用，不管理生命周期
   * - 未运行 → 启动子进程并等待就绪
   */
  async ensureRunning(): Promise<void> {
    // 1. 检查是否已运行
    const running = await this.checkHealth();
    if (running) {
      this.managedByUs = false;
      this.outputChannel.appendLine('[Server] 服务端已在运行（外部启动），复用现有实例');
      return;
    }

    // 2. 启动子进程
    this.outputChannel.appendLine('[Server] 启动服务端子进程...');
    this.outputChannel.show(true);
    this.managedByUs = true;
    this.startProcess();

    // 3. 等待就绪
    await this.waitForReady();
  }

  private startProcess(): void {
    // Windows 需要 shell:true 来找到 pnpm.cmd
    this.childProcess = cp.spawn('pnpm', ['--filter', '@mermaid-editor/server', 'start'], {
      cwd: this.workspaceRoot,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    this.childProcess.stdout?.on('data', (data: Buffer) => {
      this.outputChannel.append(data.toString());
    });

    this.childProcess.stderr?.on('data', (data: Buffer) => {
      this.outputChannel.append(data.toString());
    });

    this.childProcess.on('exit', (code, signal) => {
      this.outputChannel.appendLine(
        `[Server] 子进程退出 code=${code} signal=${signal ?? 'null'}`
      );
      this.childProcess = null;
    });

    this.childProcess.on('error', (err) => {
      this.outputChannel.appendLine(`[Server] 子进程错误: ${err.message}`);
      this.childProcess = null;
    });
  }

  /** 健康检查 — 返回 true 表示服务端正在运行 */
  private checkHealth(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(HEALTH_URL, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(HEALTH_TIMEOUT_MS, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /** 轮询健康检查直到服务端就绪或超时 */
  private async waitForReady(): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < READY_TIMEOUT_MS) {
      if (await this.checkHealth()) {
        this.outputChannel.appendLine('[Server] 服务端就绪 ✓');
        return;
      }
      await new Promise((r) => setTimeout(r, READY_POLL_INTERVAL_MS));
    }
    throw new Error(`服务端在 ${READY_TIMEOUT_MS / 1000}s 内未就绪，请查看输出面板`);
  }

  /** 显示输出面板（供用户查看日志） */
  showOutput(): void {
    this.outputChannel.show(true);
  }

  dispose(): void {
    if (this.childProcess && this.managedByUs) {
      this.outputChannel.appendLine('[Server] 停止服务端子进程');
      this.childProcess.kill();
      this.childProcess = null;
    }
    this.outputChannel.dispose();
  }
}

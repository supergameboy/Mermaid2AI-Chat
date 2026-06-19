/**
 * MCP 服务端 — Streamable HTTP 端点、JSON-RPC 请求路由
 *
 * 有状态多会话模式：每个 MCP 会话独立 transport + McpServer 实例。
 * - POST /mcp（无 session id）→ 新建会话，处理 initialize，返回 mcp-session-id
 * - POST /mcp（带 session id）→ 复用会话 transport 处理请求
 * - GET  /mcp（带 session id）→ 打开 SSE 流接收服务端推送
 * - DELETE /mcp（带 session id）→ 终止会话
 */
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { registerCreateViewTool } from './tools/create-view.js';
import { registerGetInputTool } from './tools/get-input.js';
import { WsServer } from './ws-server.js';
import { useEditorStore } from './store.js';

export interface ServerOptions {
  port?: number;
  host?: string;
}

interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
}

export async function startServer(options: ServerOptions = {}): Promise<void> {
  const port = options.port ?? 14514;
  const host = options.host ?? 'localhost';

  const app = express();

  // 注意：不使用 express.json() 全局中间件
  // StreamableHTTPServerTransport 需要直接读取原始请求流
  // express.json() 会消费流，导致 transport 收到空 body

  const httpServer = createServer(app);

  // WebSocket 服务器（与 HTTP 共享端口）
  const wsServer = new WsServer(httpServer);

  // 会话表：sessionId → { transport, server }
  const sessions = new Map<string, Session>();

  // 创建新会话：独立 transport + McpServer，注册工具
  function createSession(): Session {
    const mcpServer = new McpServer({
      name: 'mermaid-editor',
      version: '1.0.0',
    });
    registerCreateViewTool(mcpServer, wsServer);
    registerGetInputTool(mcpServer, wsServer);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId: string) => {
        sessions.set(sessionId, { transport, server: mcpServer });
        console.log(`[MCP] 会话已建立: ${sessionId}, 当前 ${sessions.size} 个会话`);
      },
    });

    transport.onerror = (err) => {
      console.error('[MCP Transport Error]', err);
    };

    transport.onclose = () => {
      const sessionId = transport.sessionId;
      if (sessionId && sessions.has(sessionId)) {
        sessions.delete(sessionId);
        console.log(`[MCP] 会话已关闭: ${sessionId}, 当前 ${sessions.size} 个会话`);
      }
    };

    return { transport, server: mcpServer };
  }

  // POST /mcp — JSON-RPC 请求入口
  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    try {
      if (sessionId) {
        // 已有会话 → 复用 transport
        const session = sessions.get(sessionId);
        if (!session) {
          res.status(404).json({ error: 'Session not found' });
          return;
        }
        await session.transport.handleRequest(req, res);
      } else {
        // 新会话（initialize 请求）→ 创建 transport + connect + 处理
        const session = createSession();
        await session.server.connect(session.transport);
        await session.transport.handleRequest(req, res);
      }
    } catch (err) {
      console.error('[MCP] 请求处理错误:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error', detail: String(err) });
      }
    }
  });

  // GET /mcp — SSE 流（服务端推送通知，需带 session id）
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({ error: 'Invalid or missing mcp-session-id' });
      return;
    }
    try {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res);
    } catch (err) {
      console.error('[MCP] GET 请求处理错误:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // DELETE /mcp — 终止会话
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    try {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res);
    } catch (err) {
      console.error('[MCP] DELETE 请求处理错误:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // 健康检查
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'mermaid-editor', sessions: sessions.size });
  });

  // 重置 Store（测试隔离用）
  app.post('/reset', (req, res) => {
    const store = useEditorStore.getState();
    store.setCanvas({ nodes: [], edges: [], direction: 'TD' });
    store.setConsumed(false);
    store.setCanvasSource(null);
    store.setLastConsumedAt(null);
    store.setTitle(null);
    store.setViewport({ x: 0, y: 0, zoom: 1 });
    wsServer.broadcastCanvasUpdate({ nodes: [], edges: [], direction: 'TD' });
    wsServer.broadcastConsumedPayload({ consumed: false, lastConsumedAt: null, canvasSource: null });
    res.json({ success: true });
  });

  // 启动服务器
  httpServer.listen(port, host, () => {
    console.log(`[MCP] Mermaid Editor 服务已启动`);
    console.log(`[MCP] HTTP:  http://${host}:${port}/mcp`);
    console.log(`[MCP] WS:    ws://${host}:${port}/ws`);
    console.log(`[MCP] 健康检查: http://${host}:${port}/health`);
  });

  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n[MCP] 正在关闭服务...');
    wsServer.close();
    httpServer.close();
    process.exit(0);
  });
}

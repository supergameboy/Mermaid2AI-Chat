/**
 * MCP 服务端 — Streamable HTTP 端点、JSON-RPC 请求路由
 *
 * 多工作区架构：
 * - 通过 HTTP header `x-workspace-root` 路由到对应工作区
 * - 每个 MCP 会话独立 transport + McpServer 实例
 * - sessionId 按 MCP 连接生成（WeakMap<McpServer, string>）
 *
 * 端点:
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
import { registerListViewsTool } from './tools/list-views.js';
import { WsServer } from './ws-server.js';
import { WorkspaceRegistry } from './workspace-registry.js';

export interface ServerOptions {
  port?: number;
  host?: string;
}

interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
}

/** sessionId 按 MCP 连接生成（WeakMap，连接关闭自动回收） */
const sessionIds = new WeakMap<McpServer, string>();

/** 获取或创建 MCP 会话 ID */
function getOrCreateSessionId(server: McpServer): string {
  let sessionId = sessionIds.get(server);
  if (!sessionId) {
    sessionId = randomUUID();
    sessionIds.set(server, sessionId);
  }
  return sessionId;
}

export async function startServer(options: ServerOptions = {}): Promise<void> {
  const port = options.port ?? 14514;
  const host = options.host ?? 'localhost';

  const app = express();
  const httpServer = createServer(app);

  // 工作区注册表（多工作区管理）
  const registry = new WorkspaceRegistry();

  // WebSocket 服务器（与 HTTP 共享端口，通过 WorkspaceRegistry 路由）
  const wsServer = new WsServer(httpServer, registry);

  // 会话表：sessionId → { transport, server }
  const sessions = new Map<string, Session>();

  // 创建新会话：独立 transport + McpServer，注册工具
  function createSession(): Session {
    const mcpServer = new McpServer({
      name: 'mermaid2aichat',
      version: '1.0.0',
    });
    registerCreateViewTool(mcpServer, wsServer, registry, getOrCreateSessionId);
    registerGetInputTool(mcpServer, wsServer, registry);
    registerListViewsTool(mcpServer, registry);

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
    res.json({ status: 'ok', service: 'mermaid2aichat', sessions: sessions.size });
  });

  // 启动服务器
  httpServer.listen(port, host, () => {
    console.log(`[MCP] Mermaid2AIChat 服务已启动`);
    console.log(`[MCP] HTTP:  http://${host}:${port}/mcp`);
    console.log(`[MCP] WS:    ws://${host}:${port}/ws`);
    console.log(`[MCP] 健康检查: http://${host}:${port}/health`);
  });

  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n[MCP] 正在关闭服务...');
    wsServer.close();
    registry.disposeAll();
    httpServer.close();
    process.exit(0);
  });
}

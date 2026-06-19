/**
 * Mermaid Editor MCP 服务端 — 入口
 *
 * 启动: pnpm start
 * 端口: 14514 (默认)
 *
 * 端点:
 * - POST /mcp — MCP Streamable HTTP
 * - WS /ws — WebSocket 状态同步
 * - GET /health — 健康检查
 */
import { startServer } from './mcp-server.js';

startServer().catch((err) => {
  console.error('[MCP] 启动失败:', err);
  process.exit(1);
});

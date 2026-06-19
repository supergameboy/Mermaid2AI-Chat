/**
 * MCP 客户端辅助 — 通过 JSON-RPC over HTTP 调用 MCP 工具
 */
import type { APIRequestContext } from '@playwright/test';

const MCP_URL = 'http://localhost:14514/mcp';

/** 初始化 MCP 会话，返回 session id */
export async function initMcpSession(request: APIRequestContext): Promise<string> {
  const response = await request.post(MCP_URL, {
    data: {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'e2e-test', version: '1.0.0' },
      },
    },
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
  });

  const sessionId = response.headers()['mcp-session-id'];
  if (!sessionId) {
    throw new Error('MCP 初始化失败：未返回 mcp-session-id');
  }

  // 发送 initialized 通知（无 id）
  await request.post(MCP_URL, {
    data: {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    },
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'mcp-session-id': sessionId,
    },
  });

  return sessionId;
}

/** 调用 MCP 工具 */
export async function callTool(
  request: APIRequestContext,
  sessionId: string,
  name: string,
  arguments_: Record<string, unknown>,
): Promise<unknown> {
  const response = await request.post(MCP_URL, {
    data: {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name,
        arguments: arguments_,
      },
    },
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'mcp-session-id': sessionId,
    },
  });

  // MCP 响应为 SSE 格式（text/event-stream），需解析 `data:` 行
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    // SSE 格式：提取 data: 行的 JSON
    const dataLines = text
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim());
    if (dataLines.length === 0) {
      throw new Error(`MCP 响应解析失败：无 data 行，原始内容: ${text.substring(0, 200)}`);
    }
    body = JSON.parse(dataLines.join(''));
  }

  const bodyObj = body as { error?: unknown; result?: { content?: Array<{ type: string; text?: string }> } };
  if (bodyObj.error) {
    throw new Error(`MCP 工具调用失败: ${JSON.stringify(bodyObj.error)}`);
  }

  // 工具返回 content 数组，取第一个 text 内容解析
  const content = bodyObj.result?.content;
  if (Array.isArray(content) && content.length > 0 && content[0].type === 'text') {
    return JSON.parse(content[0].text as string);
  }
  return bodyObj.result;
}

/** 调用 create_view 工具 */
export async function createView(
  request: APIRequestContext,
  sessionId: string,
  mermaid: string,
  title?: string,
): Promise<unknown> {
  const args: Record<string, unknown> = { mermaid };
  if (title !== undefined) {
    args.title = title;
  }
  return callTool(request, sessionId, 'create_view', args);
}

/** 调用 get_input 工具 */
export async function getInput(
  request: APIRequestContext,
  sessionId: string,
): Promise<unknown> {
  return callTool(request, sessionId, 'get_input', {});
}

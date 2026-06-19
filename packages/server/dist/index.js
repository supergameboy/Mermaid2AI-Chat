// src/mcp-server.ts
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "http";
import { randomUUID } from "crypto";

// src/tools/create-view.ts
import { z } from "zod";
import { parseMermaid } from "@mermaid-editor/serializer";

// src/store.ts
import { create } from "zustand";
var useEditorStore = create((set, get, store) => ({
  // 初始状态
  nodes: [],
  edges: [],
  direction: "TD",
  consumed: false,
  lastConsumedAt: null,
  canvasSource: null,
  title: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  // 画布操作（整体替换）
  setCanvas: (state) => set((s) => ({ ...s, ...state })),
  // 视口操作（viewport 变化不重置 consumed，因为不是内容编辑）
  setViewport: (viewport) => set({ viewport }),
  // 消费状态操作
  setConsumed: (consumed) => set({ consumed }),
  setCanvasSource: (canvasSource) => set({ canvasSource }),
  setLastConsumedAt: (lastConsumedAt) => set({ lastConsumedAt }),
  resetConsumed: () => set({ consumed: false }),
  // 标题操作
  setTitle: (title) => set({ title }),
  // 读取方法
  getCanvas: () => {
    const s = get();
    return { nodes: s.nodes, edges: s.edges, direction: s.direction };
  },
  getConsumedState: () => {
    const s = get();
    return { consumed: s.consumed, lastConsumedAt: s.lastConsumedAt, canvasSource: s.canvasSource };
  },
  getTitle: () => get().title,
  getViewport: () => get().viewport,
  // 订阅（使用 store 参数避免循环引用）
  subscribe: (listener) => store.subscribe(listener)
}));

// src/consumed-state-machine.ts
function consumedReducer(state, event) {
  switch (event.type) {
    case "CONSUME":
      return { ...state, consumed: true, lastConsumedAt: Date.now() };
    case "RESET":
      return { ...state, consumed: false, lastConsumedAt: state.lastConsumedAt };
    case "CANVAS_EDIT":
      return { ...state, consumed: false, canvasSource: "user", lastConsumedAt: state.lastConsumedAt };
    case "CREATE_VIEW":
      return { ...state, consumed: true, canvasSource: "ai", lastConsumedAt: Date.now() };
  }
}

// src/tools/create-view.ts
function registerCreateViewTool(server, wsServer) {
  server.tool(
    "create_view",
    "\u5C06mermaid\u6D41\u7A0B\u56FE\u4EE3\u7801\u6E32\u67D3\u4E3A\u53EF\u89C6\u5316\u753B\u5E03\u5E76\u5C55\u793A\u7ED9\u7528\u6237\u3002\u7528\u4E8EAI\u5411\u7528\u6237\u5C55\u793A\u5173\u952E\u6D41\u7A0B\u3002",
    {
      mermaid: z.string().describe("Mermaid flowchart\u4EE3\u7801\uFF0C\u4F8B\u5982: flowchart TD\n  A[\u5F00\u59CB] --> B[\u7ED3\u675F]"),
      title: z.string().optional().describe("\u53EF\u9009\u7684\u56FE\u8868\u6807\u9898")
    },
    async ({ mermaid, title }) => {
      try {
        const store = useEditorStore.getState();
        console.log("[create_view] \u6536\u5230\u8BF7\u6C42, title:", title, "mermaid\u957F\u5EA6:", mermaid.length);
        const parseResult = parseMermaid(mermaid);
        console.log("[create_view] \u89E3\u6790\u7ED3\u679C:", { success: parseResult.success, nodeCount: parseResult.canvas.nodes.length, edgeCount: parseResult.canvas.edges.length, errors: parseResult.errors.length });
        if (!parseResult.success && parseResult.canvas.nodes.length === 0) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                message: "Mermaid\u4EE3\u7801\u89E3\u6790\u5931\u8D25",
                errors: parseResult.errors
              })
            }]
          };
        }
        store.setCanvas({
          nodes: parseResult.canvas.nodes,
          edges: parseResult.canvas.edges,
          direction: parseResult.canvas.direction
        });
        const currentState = store.getConsumedState();
        const newState = consumedReducer(currentState, { type: "CREATE_VIEW" });
        store.setConsumed(newState.consumed);
        store.setCanvasSource(newState.canvasSource);
        store.setLastConsumedAt(newState.lastConsumedAt ?? Date.now());
        store.setTitle(title ?? null);
        wsServer.broadcastCreateView({ mermaid, title: title ?? null });
        wsServer.broadcastConsumedUpdate();
        console.log("[create_view] \u5B8C\u6210, \u5DF2\u5E7F\u64AD\u5230\u5BA2\u6237\u7AEF");
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "\u5DF2\u5C55\u793A\u7ED9\u7528\u6237",
              nodeCount: parseResult.canvas.nodes.length,
              edgeCount: parseResult.canvas.edges.length,
              title: title ?? null,
              ...parseResult.errors.length > 0 ? { warnings: parseResult.errors } : {}
            })
          }]
        };
      } catch (err) {
        console.error("[create_view] \u5DE5\u5177\u6267\u884C\u9519\u8BEF:", err);
        throw err;
      }
    }
  );
}

// src/tools/get-input.ts
import { serializeMermaid as serializeMermaid2 } from "@mermaid-editor/serializer";
function registerGetInputTool(server, wsServer) {
  server.tool(
    "get_input",
    "\u83B7\u53D6\u7528\u6237\u5728\u53EF\u89C6\u5316\u7F16\u8F91\u5668\u4E2D\u7ED8\u5236\u7684\u6D41\u7A0B\u56FE\uFF0C\u8FD4\u56DEmermaid\u4EE3\u7801\u3002\u8C03\u7528\u540E\u753B\u5E03\u6807\u8BB0\u4E3A\u5DF2\u6D88\u8D39\uFF0C\u7528\u6237\u9700\u70B9\u51FB\u91CD\u65B0\u542F\u7528\u6216\u7F16\u8F91\u753B\u5E03\u540E\u624D\u80FD\u518D\u6B21\u8F93\u5165\u3002",
    {},
    async () => {
      try {
        const store = useEditorStore.getState();
        const { nodes, edges, direction } = store.getCanvas();
        const consumedState = store.getConsumedState();
        console.log("[get_input] \u753B\u5E03\u72B6\u6001:", { nodeCount: nodes.length, edgeCount: edges.length, direction, consumed: consumedState.consumed, canvasSource: consumedState.canvasSource });
        if (nodes.length === 0) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: "empty",
                message: "\u753B\u5E03\u4E3A\u7A7A\uFF0C\u8BF7\u5148\u5728\u7F16\u8F91\u5668\u4E2D\u7ED8\u5236\u6D41\u7A0B\u56FE"
              })
            }]
          };
        }
        if (consumedState.consumed) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: "already_consumed",
                message: "\u753B\u5E03\u5DF2\u6D88\u8D39\uFF0C\u7528\u6237\u9700\u70B9\u51FB\u91CD\u65B0\u542F\u7528\u6216\u7F16\u8F91\u753B\u5E03\u540E\u518D\u6B21\u8BE2\u95EE",
                lastConsumedAt: consumedState.lastConsumedAt,
                canvasSource: consumedState.canvasSource
              })
            }]
          };
        }
        if (consumedState.canvasSource === "ai") {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: "ai_content",
                message: "\u753B\u5E03\u5F53\u524D\u5185\u5BB9\u4E3AAI\u751F\u6210\uFF0C\u5982\u9700\u5206\u6790\u8BF7\u5148\u7F16\u8F91\u753B\u5E03",
                lastConsumedAt: consumedState.lastConsumedAt
              })
            }]
          };
        }
        console.log("[get_input] \u8282\u70B9\u6570\u636E\u6837\u672C:", JSON.stringify(nodes[0], null, 2));
        console.log("[get_input] \u5F00\u59CB\u5E8F\u5217\u5316...");
        const serializeResult = serializeMermaid2({ nodes, edges, direction });
        console.log("[get_input] \u5E8F\u5217\u5316\u6210\u529F:", serializeResult.mermaid.substring(0, 100));
        const newState = consumedReducer(consumedState, { type: "CONSUME" });
        store.setConsumed(newState.consumed);
        store.setLastConsumedAt(newState.lastConsumedAt ?? Date.now());
        wsServer.broadcastConsumedUpdate();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "success",
              mermaid: serializeResult.mermaid,
              nodeCount: nodes.length,
              edgeCount: edges.length,
              direction,
              canvasSource: "user"
            })
          }]
        };
      } catch (err) {
        console.error("[get_input] \u5DE5\u5177\u6267\u884C\u9519\u8BEF:", err);
        throw err;
      }
    }
  );
}

// src/ws-server.ts
import { WebSocketServer, WebSocket } from "ws";
var WsServer = class {
  wss;
  clients = /* @__PURE__ */ new Set();
  constructor(server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });
    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      console.log(`[WS] \u5BA2\u6237\u7AEF\u8FDE\u63A5\uFF0C\u5F53\u524D ${this.clients.size} \u4E2A\u5BA2\u6237\u7AEF`);
      this.sendReconnectSync(ws);
      ws.on("message", (data) => {
        this.handleMessage(ws, data);
      });
      ws.on("close", () => {
        this.clients.delete(ws);
        console.log(`[WS] \u5BA2\u6237\u7AEF\u65AD\u5F00\uFF0C\u5F53\u524D ${this.clients.size} \u4E2A\u5BA2\u6237\u7AEF`);
      });
      ws.on("error", (err) => {
        console.error("[WS] \u5BA2\u6237\u7AEF\u9519\u8BEF:", err.message);
        this.clients.delete(ws);
      });
    });
  }
  /**
   * 处理客户端消息
   */
  handleMessage(ws, data) {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      console.error("[WS] \u6D88\u606F\u89E3\u6790\u5931\u8D25");
      return;
    }
    console.log(`[WS] \u6536\u5230\u6D88\u606F: ${msg.type}`);
    const store = useEditorStore.getState();
    switch (msg.type) {
      case "canvas_edit": {
        const payload = msg.payload;
        store.setCanvas({ nodes: payload.nodes, edges: payload.edges, direction: payload.direction });
        const currentState = store.getConsumedState();
        const newState = consumedReducer(currentState, { type: "CANVAS_EDIT" });
        store.setConsumed(newState.consumed);
        store.setCanvasSource(newState.canvasSource);
        this.broadcastExcept(ws, {
          type: "canvas_update",
          payload: { nodes: payload.nodes, edges: payload.edges, direction: payload.direction },
          timestamp: Date.now()
        });
        this.broadcast({
          type: "consumed_update",
          payload: store.getConsumedState(),
          timestamp: Date.now()
        });
        break;
      }
      case "reset_consumed": {
        const currentState = store.getConsumedState();
        const newState = consumedReducer(currentState, { type: "RESET" });
        store.setConsumed(newState.consumed);
        this.broadcast({
          type: "consumed_update",
          payload: store.getConsumedState(),
          timestamp: Date.now()
        });
        break;
      }
      case "viewport_edit": {
        const payload = msg.payload;
        store.setViewport(payload.viewport);
        this.broadcastExcept(ws, {
          type: "viewport_update",
          payload: { viewport: payload.viewport },
          timestamp: Date.now()
        });
        break;
      }
      case "subscribe":
        break;
    }
  }
  /**
   * 广播 create_view 通知（包含画布数据 + 标题）
   * AI → 用户方向：客户端收到后更新画布和标题
   */
  broadcastCreateView(payload) {
    const store = useEditorStore.getState();
    const canvas = store.getCanvas();
    this.broadcast({
      type: "canvas_update",
      payload: canvas,
      timestamp: Date.now()
    });
    this.broadcast({
      type: "create_view",
      payload,
      timestamp: Date.now()
    });
  }
  /**
   * 广播消费状态更新
   */
  broadcastConsumedUpdate() {
    this.broadcast({
      type: "consumed_update",
      payload: useEditorStore.getState().getConsumedState(),
      timestamp: Date.now()
    });
  }
  /**
   * 广播画布更新（供 /reset 端点等外部调用）
   */
  broadcastCanvasUpdate(payload) {
    this.broadcast({
      type: "canvas_update",
      payload,
      timestamp: Date.now()
    });
  }
  /**
   * 广播消费状态（供 /reset 端点等外部调用）
   */
  broadcastConsumedPayload(payload) {
    this.broadcast({
      type: "consumed_update",
      payload,
      timestamp: Date.now()
    });
  }
  /**
   * 广播给所有客户端
   */
  broadcast(message) {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }
  /**
   * 广播给除发起方外的客户端
   */
  broadcastExcept(sender, message) {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }
  /**
   * 发送全量状态给重连客户端
   */
  sendReconnectSync(ws) {
    const store = useEditorStore.getState();
    const payload = {
      canvas: store.getCanvas(),
      consumed: store.getConsumedState(),
      title: store.getTitle(),
      viewport: store.getViewport()
    };
    ws.send(JSON.stringify({
      type: "reconnect_sync",
      payload,
      timestamp: Date.now()
    }));
  }
  /**
   * 关闭 WebSocket 服务器
   */
  close() {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();
    this.wss.close();
  }
};

// src/mcp-server.ts
async function startServer(options = {}) {
  const port = options.port ?? 14514;
  const host = options.host ?? "localhost";
  const app = express();
  const httpServer = createServer(app);
  const wsServer = new WsServer(httpServer);
  const sessions = /* @__PURE__ */ new Map();
  function createSession() {
    const mcpServer = new McpServer({
      name: "mermaid-editor",
      version: "1.0.0"
    });
    registerCreateViewTool(mcpServer, wsServer);
    registerGetInputTool(mcpServer, wsServer);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        sessions.set(sessionId, { transport, server: mcpServer });
        console.log(`[MCP] \u4F1A\u8BDD\u5DF2\u5EFA\u7ACB: ${sessionId}, \u5F53\u524D ${sessions.size} \u4E2A\u4F1A\u8BDD`);
      }
    });
    transport.onerror = (err) => {
      console.error("[MCP Transport Error]", err);
    };
    transport.onclose = () => {
      const sessionId = transport.sessionId;
      if (sessionId && sessions.has(sessionId)) {
        sessions.delete(sessionId);
        console.log(`[MCP] \u4F1A\u8BDD\u5DF2\u5173\u95ED: ${sessionId}, \u5F53\u524D ${sessions.size} \u4E2A\u4F1A\u8BDD`);
      }
    };
    return { transport, server: mcpServer };
  }
  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];
    try {
      if (sessionId) {
        const session = sessions.get(sessionId);
        if (!session) {
          res.status(404).json({ error: "Session not found" });
          return;
        }
        await session.transport.handleRequest(req, res);
      } else {
        const session = createSession();
        await session.server.connect(session.transport);
        await session.transport.handleRequest(req, res);
      }
    } catch (err) {
      console.error("[MCP] \u8BF7\u6C42\u5904\u7406\u9519\u8BEF:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error", detail: String(err) });
      }
    }
  });
  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({ error: "Invalid or missing mcp-session-id" });
      return;
    }
    try {
      const session = sessions.get(sessionId);
      await session.transport.handleRequest(req, res);
    } catch (err) {
      console.error("[MCP] GET \u8BF7\u6C42\u5904\u7406\u9519\u8BEF:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });
  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    try {
      const session = sessions.get(sessionId);
      await session.transport.handleRequest(req, res);
    } catch (err) {
      console.error("[MCP] DELETE \u8BF7\u6C42\u5904\u7406\u9519\u8BEF:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });
  app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "mermaid-editor", sessions: sessions.size });
  });
  app.post("/reset", (req, res) => {
    const store = useEditorStore.getState();
    store.setCanvas({ nodes: [], edges: [], direction: "TD" });
    store.setConsumed(false);
    store.setCanvasSource(null);
    store.setLastConsumedAt(null);
    store.setTitle(null);
    store.setViewport({ x: 0, y: 0, zoom: 1 });
    wsServer.broadcastCanvasUpdate({ nodes: [], edges: [], direction: "TD" });
    wsServer.broadcastConsumedPayload({ consumed: false, lastConsumedAt: null, canvasSource: null });
    res.json({ success: true });
  });
  httpServer.listen(port, host, () => {
    console.log(`[MCP] Mermaid Editor \u670D\u52A1\u5DF2\u542F\u52A8`);
    console.log(`[MCP] HTTP:  http://${host}:${port}/mcp`);
    console.log(`[MCP] WS:    ws://${host}:${port}/ws`);
    console.log(`[MCP] \u5065\u5EB7\u68C0\u67E5: http://${host}:${port}/health`);
  });
  process.on("SIGINT", () => {
    console.log("\n[MCP] \u6B63\u5728\u5173\u95ED\u670D\u52A1...");
    wsServer.close();
    httpServer.close();
    process.exit(0);
  });
}

// src/index.ts
startServer().catch((err) => {
  console.error("[MCP] \u542F\u52A8\u5931\u8D25:", err);
  process.exit(1);
});

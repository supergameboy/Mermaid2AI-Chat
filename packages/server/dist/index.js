// src/mcp-server.ts
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "http";
import { randomUUID as randomUUID2 } from "crypto";

// src/tools/create-view.ts
import { z } from "zod";
import { parseMermaid } from "@mermaid2aichat/serializer";
function registerCreateViewTool(server, wsServer, registry, getSessionId) {
  server.tool(
    "create_view",
    "\u5C06mermaid\u6D41\u7A0B\u56FE\u4EE3\u7801\u6E32\u67D3\u4E3A\u53EF\u89C6\u5316\u753B\u5E03\u5E76\u5C55\u793A\u7ED9\u7528\u6237\u3002\u6BCF\u6B21\u8C03\u7528\u521B\u5EFA\u65B0\u6807\u7B7E\u9875\uFF0C\u4E0D\u8986\u76D6\u5DF2\u6709\u89C6\u56FE\u3002",
    {
      mermaid: z.string().describe("Mermaid flowchart\u4EE3\u7801\uFF0C\u4F8B\u5982: flowchart TD\n  A[\u5F00\u59CB] --> B[\u7ED3\u675F]"),
      title: z.string().optional().describe("\u53EF\u9009\u7684\u56FE\u8868\u6807\u9898")
    },
    async ({ mermaid, title }, extra) => {
      try {
        const workspaceRoot = extra.requestInfo?.headers?.["x-workspace-root"];
        if (!workspaceRoot) {
          throw new Error("Missing x-workspace-root header");
        }
        const { store, persistence } = await registry.getOrCreate(workspaceRoot);
        console.log("[create_view] \u6536\u5230\u8BF7\u6C42, title:", title, "mermaid\u957F\u5EA6:", mermaid.length);
        const parseResult = parseMermaid(mermaid);
        console.log("[create_view] \u89E3\u6790\u7ED3\u679C:", {
          success: parseResult.success,
          nodeCount: parseResult.canvas.nodes.length,
          edgeCount: parseResult.canvas.edges.length,
          errors: parseResult.errors.length
        });
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
        const sessionId = getSessionId(server);
        const storeState = store.getState();
        if (storeState.activeViewId) {
          await persistence.updateViewContent(storeState.activeViewId, {
            canvas: storeState.activeCanvas,
            consumed: storeState.activeConsumed,
            viewport: storeState.activeViewport
          });
        }
        let viewId;
        try {
          viewId = storeState.createView({
            title: title ?? null,
            source: "ai",
            sessionId,
            canvas: parseResult.canvas,
            consumed: {
              consumed: true,
              canvasSource: "ai",
              lastConsumedAt: Date.now()
            },
            viewport: { x: 0, y: 0, zoom: 1 }
          });
        } catch (err) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                message: err.message
              })
            }]
          };
        }
        await persistence.updateViewContent(viewId, {
          canvas: parseResult.canvas,
          consumed: {
            consumed: true,
            canvasSource: "ai",
            lastConsumedAt: Date.now()
          },
          viewport: { x: 0, y: 0, zoom: 1 }
        });
        wsServer.broadcastViewsUpdate(workspaceRoot);
        wsServer.broadcastActiveViewUpdate(workspaceRoot);
        console.log("[create_view] \u5B8C\u6210, viewId:", viewId, "\u5DF2\u5E7F\u64AD\u5230\u5BA2\u6237\u7AEF");
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "\u5DF2\u521B\u5EFA\u65B0\u6807\u7B7E\u9875\u5E76\u5C55\u793A\u7ED9\u7528\u6237",
              viewId,
              title: title ?? null,
              nodeCount: parseResult.canvas.nodes.length,
              edgeCount: parseResult.canvas.edges.length,
              sessionId,
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
import { z as z2 } from "zod";
import { serializeMermaid } from "@mermaid2aichat/serializer";

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

// src/tools/get-input.ts
function registerGetInputTool(server, wsServer, registry) {
  server.tool(
    "get_input",
    "\u83B7\u53D6\u7528\u6237\u5728\u53EF\u89C6\u5316\u7F16\u8F91\u5668\u4E2D\u7ED8\u5236\u7684\u6D41\u7A0B\u56FE\uFF0C\u8FD4\u56DEmermaid\u4EE3\u7801\u3002\u8C03\u7528\u540E\u753B\u5E03\u6807\u8BB0\u4E3A\u5DF2\u6D88\u8D39\u3002\u53EF\u9009\u4F20\u5165 viewId \u8BFB\u53D6\u5386\u53F2\u89C6\u56FE\uFF08\u4E0D\u6807\u8BB0\u5DF2\u6D88\u8D39\uFF09\u3002",
    {
      viewId: z2.string().optional().describe("\u89C6\u56FEID\uFF0C\u4E0D\u4F20\u5219\u8BFB\u53D6\u6D3B\u52A8\u89C6\u56FE")
    },
    async ({ viewId }, extra) => {
      try {
        const workspaceRoot = extra.requestInfo?.headers?.["x-workspace-root"];
        if (!workspaceRoot) {
          throw new Error("Missing x-workspace-root header");
        }
        const { store, persistence } = await registry.getOrCreate(workspaceRoot);
        const storeState = store.getState();
        const targetViewId = viewId ?? storeState.getActiveViewId();
        if (!targetViewId) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: "empty",
                message: "\u65E0\u6D3B\u52A8\u89C6\u56FE"
              })
            }]
          };
        }
        const viewSummary = storeState.getViewSummary(targetViewId);
        if (!viewSummary) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: "error",
                message: `\u89C6\u56FE ${viewId} \u4E0D\u5B58\u5728`
              })
            }]
          };
        }
        const isActiveView = targetViewId === storeState.getActiveViewId();
        if (isActiveView) {
          const { nodes, edges, direction } = storeState.getActiveCanvas();
          const consumedState = storeState.getActiveConsumed();
          console.log("[get_input] \u6D3B\u52A8\u89C6\u56FE\u753B\u5E03\u72B6\u6001:", {
            viewId: targetViewId,
            nodeCount: nodes.length,
            edgeCount: edges.length,
            direction,
            consumed: consumedState.consumed,
            canvasSource: consumedState.canvasSource
          });
          if (nodes.length === 0) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  status: "empty",
                  message: "\u753B\u5E03\u4E3A\u7A7A\uFF0C\u8BF7\u5148\u5728\u7F16\u8F91\u5668\u4E2D\u7ED8\u5236\u6D41\u7A0B\u56FE",
                  viewId: targetViewId,
                  title: viewSummary.title
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
                  canvasSource: consumedState.canvasSource,
                  viewId: targetViewId,
                  title: viewSummary.title
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
                  lastConsumedAt: consumedState.lastConsumedAt,
                  viewId: targetViewId,
                  title: viewSummary.title
                })
              }]
            };
          }
          console.log("[get_input] \u5F00\u59CB\u5E8F\u5217\u5316...");
          const serializeResult = serializeMermaid({ nodes, edges, direction });
          console.log("[get_input] \u5E8F\u5217\u5316\u6210\u529F:", serializeResult.mermaid.substring(0, 100));
          const newState = consumedReducer(consumedState, { type: "CONSUME" });
          store.getState().updateActiveConsumed(newState);
          wsServer.broadcastConsumedUpdate(workspaceRoot, store.getState().getActiveConsumed());
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: "success",
                mermaid: serializeResult.mermaid,
                viewId: targetViewId,
                title: viewSummary.title,
                nodeCount: nodes.length,
                edgeCount: edges.length,
                direction,
                canvasSource: "user"
              })
            }]
          };
        } else {
          console.log("[get_input] \u8BFB\u53D6\u975E\u6D3B\u52A8\u89C6\u56FE:", targetViewId);
          const content = await persistence.loadViewContent(targetViewId);
          if (!content) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  status: "error",
                  message: `\u89C6\u56FE ${viewId} \u5185\u5BB9\u52A0\u8F7D\u5931\u8D25`,
                  viewId: targetViewId,
                  title: viewSummary.title
                })
              }]
            };
          }
          if (content.consumed.consumed) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  status: "already_consumed",
                  message: `\u89C6\u56FE ${viewSummary.title ?? viewId} \u5DF2\u6D88\u8D39`,
                  viewId: targetViewId,
                  title: viewSummary.title,
                  lastConsumedAt: content.consumed.lastConsumedAt,
                  canvasSource: content.consumed.canvasSource
                })
              }]
            };
          }
          if (content.consumed.canvasSource === "ai") {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  status: "ai_content",
                  message: `\u89C6\u56FE ${viewSummary.title ?? viewId} \u5185\u5BB9\u4E3AAI\u751F\u6210`,
                  viewId: targetViewId,
                  title: viewSummary.title,
                  lastConsumedAt: content.consumed.lastConsumedAt
                })
              }]
            };
          }
          const serializeResult = serializeMermaid(content.canvas);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: "success",
                mermaid: serializeResult.mermaid,
                viewId: targetViewId,
                title: viewSummary.title,
                nodeCount: content.canvas.nodes.length,
                edgeCount: content.canvas.edges.length,
                direction: content.canvas.direction,
                canvasSource: "user",
                note: "\u8BFB\u53D6\u975E\u6D3B\u52A8\u89C6\u56FE\uFF0C\u672A\u6807\u8BB0\u5DF2\u6D88\u8D39"
              })
            }]
          };
        }
      } catch (err) {
        console.error("[get_input] \u5DE5\u5177\u6267\u884C\u9519\u8BEF:", err);
        throw err;
      }
    }
  );
}

// src/tools/list-views.ts
function registerListViewsTool(server, registry) {
  server.tool(
    "list_views",
    "\u5217\u51FA\u5F53\u524D\u6240\u6709\u89C6\u56FE\uFF08\u6807\u7B7E\u9875\uFF09\uFF0C\u5305\u62ECAI\u8F93\u51FA\u5386\u53F2\u548C\u7528\u6237\u624B\u52A8\u521B\u5EFA\u7684\u89C6\u56FE\u3002",
    {},
    async (_, extra) => {
      const workspaceRoot = extra.requestInfo?.headers?.["x-workspace-root"];
      if (!workspaceRoot) {
        throw new Error("Missing x-workspace-root header");
      }
      const { store } = await registry.getOrCreate(workspaceRoot);
      const storeState = store.getState();
      const views = storeState.getViews();
      const activeViewId = storeState.getActiveViewId();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            views: views.map((v) => ({
              id: v.id,
              title: v.title,
              createdAt: v.createdAt,
              updatedAt: v.updatedAt,
              sessionId: v.sessionId,
              source: v.source,
              isActive: v.id === activeViewId
            })),
            activeViewId,
            totalCount: views.length
          })
        }]
      };
    }
  );
}

// src/ws-server.ts
import { WebSocketServer, WebSocket } from "ws";
var WsClientConnection = class {
  constructor(ws, store, workspaceRoot, wsServer, loader) {
    this.ws = ws;
    this.store = store;
    this.workspaceRoot = workspaceRoot;
    this.wsServer = wsServer;
    this.loader = loader;
    this.sendReconnectSync();
    this.ws.on("message", (data) => {
      void this.handleMessage(data);
    });
  }
  getWebSocket() {
    return this.ws;
  }
  getWorkspaceRoot() {
    return this.workspaceRoot;
  }
  async handleMessage(data) {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      console.error("[WS] \u6D88\u606F\u89E3\u6790\u5931\u8D25");
      return;
    }
    console.log(`[WS] \u6536\u5230\u6D88\u606F: ${msg.type}`);
    switch (msg.type) {
      case "canvas_edit": {
        const payload = msg.payload;
        const state = this.store.getState();
        state.updateActiveCanvas({
          nodes: payload.nodes,
          edges: payload.edges,
          direction: payload.direction
        });
        const currentState = this.store.getState().getActiveConsumed();
        const newState = consumedReducer(currentState, { type: "CANVAS_EDIT" });
        this.store.getState().updateActiveConsumed(newState);
        this.wsServer.broadcastCanvasUpdate(this.workspaceRoot, payload, this);
        this.wsServer.broadcastConsumedUpdate(this.workspaceRoot, this.store.getState().getActiveConsumed());
        break;
      }
      case "reset_consumed": {
        const currentState = this.store.getState().getActiveConsumed();
        const newState = consumedReducer(currentState, { type: "RESET" });
        this.store.getState().updateActiveConsumed(newState);
        this.wsServer.broadcastConsumedUpdate(this.workspaceRoot, this.store.getState().getActiveConsumed());
        break;
      }
      case "viewport_edit": {
        const payload = msg.payload;
        this.store.getState().updateActiveViewport(payload.viewport);
        this.wsServer.broadcastViewportUpdate(this.workspaceRoot, payload, this);
        break;
      }
      case "switch_view": {
        this.store.getState().switchView(msg.viewId, this.loader).then(() => {
          this.wsServer.broadcastViewsUpdate(this.workspaceRoot);
          this.wsServer.broadcastActiveViewUpdate(this.workspaceRoot);
        }).catch((err) => {
          console.error("[WS] switch_view \u5931\u8D25:", err);
        });
        break;
      }
      case "create_view": {
        const state = this.store.getState();
        if (state.activeViewId) {
          await this.loader.saveViewContent(state.activeViewId, {
            canvas: state.activeCanvas,
            consumed: state.activeConsumed,
            viewport: state.activeViewport
          });
        }
        const newViewId = state.createView({
          title: msg.payload?.title ?? null,
          source: "user",
          sessionId: null,
          canvas: { nodes: [], edges: [], direction: "TD" },
          consumed: { consumed: false, lastConsumedAt: null, canvasSource: null },
          viewport: { x: 0, y: 0, zoom: 1 }
        });
        await this.loader.saveViewContent(newViewId, {
          canvas: { nodes: [], edges: [], direction: "TD" },
          consumed: { consumed: false, lastConsumedAt: null, canvasSource: null },
          viewport: { x: 0, y: 0, zoom: 1 }
        });
        this.wsServer.broadcastViewsUpdate(this.workspaceRoot);
        this.wsServer.broadcastActiveViewUpdate(this.workspaceRoot);
        break;
      }
      case "close_view": {
        const prevActiveViewId = this.store.getState().getActiveViewId();
        this.store.getState().closeView(msg.viewId, this.loader).then(() => {
          const currActiveViewId = this.store.getState().getActiveViewId();
          this.wsServer.broadcastViewsUpdate(this.workspaceRoot);
          if (prevActiveViewId !== currActiveViewId) {
            this.wsServer.broadcastActiveViewUpdate(this.workspaceRoot);
          }
        }).catch((err) => {
          console.error("[WS] close_view \u5931\u8D25:", err);
        });
        break;
      }
      case "rename_view": {
        this.store.getState().renameView(msg.viewId, msg.title);
        this.wsServer.broadcastViewsUpdate(this.workspaceRoot);
        break;
      }
      case "reorder_views": {
        this.store.getState().reorderViews(msg.orderedIds);
        this.wsServer.broadcastViewsUpdate(this.workspaceRoot);
        break;
      }
    }
  }
  /** 发送全量状态给重连客户端 */
  sendReconnectSync() {
    const state = this.store.getState();
    const activeViewId = state.activeViewId;
    let activeView = null;
    if (activeViewId) {
      activeView = {
        viewId: activeViewId,
        canvas: state.activeCanvas,
        consumed: state.activeConsumed,
        viewport: state.activeViewport,
        title: state.activeTitle
      };
    }
    const payload = {
      views: state.views,
      activeViewId,
      activeView
    };
    this.send({
      type: "reconnect_sync",
      payload,
      timestamp: Date.now()
    });
  }
  /** 发送消息到客户端 */
  send(message) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
};
var WsServer = class {
  wss;
  registry;
  /** workspaceRoot → Set<WsClientConnection> */
  workspaceClients = /* @__PURE__ */ new Map();
  constructor(server, registry) {
    this.registry = registry;
    this.wss = new WebSocketServer({ server, path: "/ws" });
    this.wss.on("connection", (ws, req) => {
      void this.handleConnection(ws, req);
    });
  }
  async handleConnection(ws, req) {
    const url = new URL(req.url ?? "", "http://localhost");
    const workspaceRoot = url.searchParams.get("workspaceRoot");
    if (!workspaceRoot) {
      ws.close(4e3, "Missing workspaceRoot parameter");
      return;
    }
    try {
      const { store, persistence } = await this.registry.getOrCreate(workspaceRoot);
      const loader = {
        loadViewContent: async (viewId) => {
          const content = await persistence.loadViewContent(viewId);
          return content;
        },
        saveViewContent: async (viewId, content) => {
          await persistence.updateViewContent(viewId, content);
        },
        deleteViewContent: async (viewId) => {
          await persistence.deleteViewContent(viewId);
        }
      };
      const client = new WsClientConnection(ws, store, workspaceRoot, this, loader);
      let clients = this.workspaceClients.get(workspaceRoot);
      if (!clients) {
        clients = /* @__PURE__ */ new Set();
        this.workspaceClients.set(workspaceRoot, clients);
      }
      clients.add(client);
      console.log(`[WS] \u5BA2\u6237\u7AEF\u8FDE\u63A5 workspace=${workspaceRoot}, \u5F53\u524D ${clients.size} \u4E2A\u5BA2\u6237\u7AEF`);
      ws.on("close", () => {
        clients?.delete(client);
        console.log(`[WS] \u5BA2\u6237\u7AEF\u65AD\u5F00, \u5F53\u524D ${clients?.size ?? 0} \u4E2A\u5BA2\u6237\u7AEF`);
      });
      ws.on("error", (err) => {
        console.error("[WS] \u5BA2\u6237\u7AEF\u9519\u8BEF:", err.message);
        clients?.delete(client);
      });
    } catch (err) {
      console.error("[WS] \u5DE5\u4F5C\u533A\u521D\u59CB\u5316\u5931\u8D25:", err);
      ws.close(4001, "Workspace initialization failed");
    }
  }
  // === 显式广播方法（由 MCP 工具 / WS 消息处理器调用） ===
  /** 广播视图列表更新（views_update）给指定工作区所有客户端 */
  broadcastViewsUpdate(workspaceRoot) {
    const ctx = this.registry.get(workspaceRoot);
    if (!ctx) return;
    const state = ctx.store.getState();
    const message = {
      type: "views_update",
      payload: {
        views: state.views,
        activeViewId: state.activeViewId
      },
      timestamp: Date.now()
    };
    this.broadcastToWorkspace(workspaceRoot, message);
  }
  /** 广播活动视图切换（active_view_update，携带完整内容）给指定工作区所有客户端 */
  broadcastActiveViewUpdate(workspaceRoot) {
    const ctx = this.registry.get(workspaceRoot);
    if (!ctx) return;
    const state = ctx.store.getState();
    if (!state.activeViewId) return;
    const payload = {
      viewId: state.activeViewId,
      canvas: state.activeCanvas,
      consumed: state.activeConsumed,
      viewport: state.activeViewport,
      title: state.activeTitle
    };
    const message = {
      type: "active_view_update",
      payload,
      timestamp: Date.now()
    };
    this.broadcastToWorkspace(workspaceRoot, message);
  }
  /** 广播画布更新（canvas_update）给指定工作区除发送方外所有客户端 */
  broadcastCanvasUpdate(workspaceRoot, payload, excludeClient) {
    const message = {
      type: "canvas_update",
      payload,
      timestamp: Date.now()
    };
    this.broadcastToWorkspace(workspaceRoot, message, excludeClient);
  }
  /** 广播消费状态更新（consumed_update）给指定工作区所有客户端 */
  broadcastConsumedUpdate(workspaceRoot, consumed) {
    const payload = {
      consumed: consumed.consumed,
      lastConsumedAt: consumed.lastConsumedAt,
      canvasSource: consumed.canvasSource
    };
    const message = {
      type: "consumed_update",
      payload,
      timestamp: Date.now()
    };
    this.broadcastToWorkspace(workspaceRoot, message);
  }
  /** 广播视口更新（viewport_update）给指定工作区除发送方外所有客户端 */
  broadcastViewportUpdate(workspaceRoot, payload, excludeClient) {
    const message = {
      type: "viewport_update",
      payload,
      timestamp: Date.now()
    };
    this.broadcastToWorkspace(workspaceRoot, message, excludeClient);
  }
  /** 广播给指定工作区所有客户端（可选排除发送方） */
  broadcastToWorkspace(workspaceRoot, message, excludeClient) {
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
  close() {
    for (const clients of this.workspaceClients.values()) {
      for (const client of clients) {
        client.getWebSocket().close();
      }
    }
    this.workspaceClients.clear();
    this.wss.close();
  }
};

// src/store.ts
import { create } from "zustand";
import { randomUUID } from "crypto";
var MAX_VIEWS = 100;
function createEmptyCanvas() {
  return { nodes: [], edges: [], direction: "TD" };
}
function createDefaultConsumed() {
  return { consumed: false, lastConsumedAt: null, canvasSource: null };
}
function createDefaultViewport() {
  return { x: 0, y: 0, zoom: 1 };
}
function createEditorStore() {
  return create((set, get, store) => ({
    // 初始状态
    views: [],
    activeViewId: null,
    activeCanvas: createEmptyCanvas(),
    activeConsumed: createDefaultConsumed(),
    activeViewport: createDefaultViewport(),
    activeTitle: null,
    // === 视图操作 ===
    createView: (params) => {
      const state = get();
      if (state.views.length >= MAX_VIEWS) {
        throw new Error(`\u5DF2\u8FBE\u5230\u6700\u5927\u89C6\u56FE\u6570\u9650\u5236\uFF08${MAX_VIEWS}\uFF09\uFF0C\u8BF7\u5148\u5173\u95ED\u65E7\u89C6\u56FE`);
      }
      const now = Date.now();
      const viewId = randomUUID();
      const newView = {
        id: viewId,
        title: params.title ?? null,
        createdAt: now,
        updatedAt: now,
        sessionId: params.sessionId ?? null,
        source: params.source
      };
      set({
        views: [...state.views, newView],
        activeViewId: viewId,
        activeCanvas: params.canvas,
        activeConsumed: params.consumed,
        activeViewport: params.viewport,
        activeTitle: params.title ?? null
      });
      return viewId;
    },
    switchView: async (viewId, loader) => {
      const state = get();
      if (state.activeViewId === viewId) {
        return;
      }
      const targetView = state.views.find((v) => v.id === viewId);
      if (!targetView) {
        throw new Error(`\u89C6\u56FE ${viewId} \u4E0D\u5B58\u5728`);
      }
      if (state.activeViewId) {
        await loader.saveViewContent(state.activeViewId, {
          canvas: state.activeCanvas,
          consumed: state.activeConsumed,
          viewport: state.activeViewport
        });
      }
      const content = await loader.loadViewContent(viewId);
      const viewContent = content ?? {
        canvas: createEmptyCanvas(),
        consumed: createDefaultConsumed(),
        viewport: createDefaultViewport()
      };
      set({
        activeViewId: viewId,
        activeCanvas: viewContent.canvas,
        activeConsumed: viewContent.consumed,
        activeViewport: viewContent.viewport,
        activeTitle: targetView.title
      });
    },
    closeView: async (viewId, loader) => {
      const state = get();
      const viewIndex = state.views.findIndex((v) => v.id === viewId);
      if (viewIndex === -1) {
        return;
      }
      await loader.deleteViewContent(viewId);
      const newViews = state.views.filter((v) => v.id !== viewId);
      if (state.activeViewId === viewId) {
        if (newViews.length === 0) {
          const now = Date.now();
          const defaultViewId = randomUUID();
          const defaultView = {
            id: defaultViewId,
            title: null,
            createdAt: now,
            updatedAt: now,
            sessionId: null,
            source: "user"
          };
          set({
            views: [defaultView],
            activeViewId: defaultViewId,
            activeCanvas: createEmptyCanvas(),
            activeConsumed: createDefaultConsumed(),
            activeViewport: createDefaultViewport(),
            activeTitle: null
          });
        } else {
          const adjacentIndex = Math.max(0, viewIndex - 1);
          const adjacentView = newViews[adjacentIndex];
          const content = await loader.loadViewContent(adjacentView.id);
          const viewContent = content ?? {
            canvas: createEmptyCanvas(),
            consumed: createDefaultConsumed(),
            viewport: createDefaultViewport()
          };
          set({
            views: newViews,
            activeViewId: adjacentView.id,
            activeCanvas: viewContent.canvas,
            activeConsumed: viewContent.consumed,
            activeViewport: viewContent.viewport,
            activeTitle: adjacentView.title
          });
        }
      } else {
        set({ views: newViews });
      }
    },
    renameView: (viewId, title) => {
      const state = get();
      const view = state.views.find((v) => v.id === viewId);
      if (!view) {
        return;
      }
      const newViews = state.views.map(
        (v) => v.id === viewId ? { ...v, title, updatedAt: Date.now() } : v
      );
      const newActiveTitle = state.activeViewId === viewId ? title : state.activeTitle;
      set({ views: newViews, activeTitle: newActiveTitle });
    },
    reorderViews: (orderedIds) => {
      const state = get();
      const viewMap = new Map(state.views.map((v) => [v.id, v]));
      const newViews = [];
      for (const id of orderedIds) {
        const view = viewMap.get(id);
        if (view) {
          newViews.push(view);
          viewMap.delete(id);
        }
      }
      for (const view of viewMap.values()) {
        newViews.push(view);
      }
      set({ views: newViews });
    },
    // === 活动视图内容操作 ===
    updateActiveCanvas: (canvas) => {
      const state = get();
      if (!state.activeViewId) {
        return;
      }
      const newCanvas = {
        nodes: canvas.nodes ?? state.activeCanvas.nodes,
        edges: canvas.edges ?? state.activeCanvas.edges,
        direction: canvas.direction ?? state.activeCanvas.direction
      };
      const newViews = state.views.map(
        (v) => v.id === state.activeViewId ? { ...v, updatedAt: Date.now() } : v
      );
      set({
        views: newViews,
        activeCanvas: newCanvas
      });
    },
    updateActiveConsumed: (consumed) => {
      const state = get();
      if (!state.activeViewId) {
        return;
      }
      set({
        activeConsumed: { ...state.activeConsumed, ...consumed }
      });
    },
    updateActiveViewport: (viewport) => {
      const state = get();
      if (!state.activeViewId) {
        return;
      }
      set({ activeViewport: viewport });
    },
    updateActiveTitle: (title) => {
      const state = get();
      if (!state.activeViewId) {
        return;
      }
      const newViews = state.views.map(
        (v) => v.id === state.activeViewId ? { ...v, title, updatedAt: Date.now() } : v
      );
      set({ views: newViews, activeTitle: title });
    },
    resetActiveConsumed: () => {
      const state = get();
      if (!state.activeViewId) {
        return;
      }
      set({
        activeConsumed: {
          ...state.activeConsumed,
          consumed: false,
          canvasSource: "user"
        }
      });
    },
    // === 读取方法 ===
    getViews: () => get().views,
    getActiveViewId: () => get().activeViewId,
    getActiveCanvas: () => {
      const s = get();
      return s.activeCanvas;
    },
    getActiveConsumed: () => get().activeConsumed,
    getActiveViewport: () => get().activeViewport,
    getActiveTitle: () => get().activeTitle,
    getViewSummary: (viewId) => {
      return get().views.find((v) => v.id === viewId) ?? null;
    },
    // === 初始化（持久化恢复） ===
    restoreFromPersist: (data) => {
      if (data.views.length === 0) {
        const now = Date.now();
        const defaultViewId = randomUUID();
        const defaultView = {
          id: defaultViewId,
          title: null,
          createdAt: now,
          updatedAt: now,
          sessionId: null,
          source: "user"
        };
        set({
          views: [defaultView],
          activeViewId: defaultViewId,
          activeCanvas: createEmptyCanvas(),
          activeConsumed: createDefaultConsumed(),
          activeViewport: createDefaultViewport(),
          activeTitle: null
        });
        return;
      }
      const activeViewId = data.activeViewId ?? data.views[0].id;
      const activeView = data.views.find((v) => v.id === activeViewId) ?? data.views[0];
      set({
        views: data.views,
        activeViewId,
        activeCanvas: data.activeContent?.canvas ?? createEmptyCanvas(),
        activeConsumed: data.activeContent?.consumed ?? createDefaultConsumed(),
        activeViewport: data.activeContent?.viewport ?? createDefaultViewport(),
        activeTitle: activeView.title
      });
    },
    // === 订阅 ===
    subscribe: (listener) => store.subscribe(listener)
  }));
}

// src/persistence.ts
import fs from "fs";
import path from "path";
function createPersistenceService(viewsDir) {
  const viewsFile = path.join(viewsDir, "views.json");
  const viewsContentDir = path.join(viewsDir, "views");
  let debounceTimer = null;
  let disposed = false;
  function ensureDirs() {
    if (!fs.existsSync(viewsDir)) {
      fs.mkdirSync(viewsDir, { recursive: true });
    }
    if (!fs.existsSync(viewsContentDir)) {
      fs.mkdirSync(viewsContentDir, { recursive: true });
    }
  }
  function cleanupTempFiles() {
    try {
      const tmpFile = `${viewsFile}.tmp`;
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    } catch {
    }
  }
  cleanupTempFiles();
  function getViewContentPath(viewId) {
    return path.join(viewsContentDir, `${viewId}.json`);
  }
  async function atomicWriteJson(filePath, data) {
    const content = JSON.stringify(data, null, 2);
    const tmpPath = `${filePath}.tmp`;
    try {
      await fs.promises.writeFile(tmpPath, content, "utf-8");
      await fs.promises.rename(tmpPath, filePath);
    } catch (err) {
      try {
        await fs.promises.unlink(tmpPath);
      } catch {
      }
      throw err;
    }
  }
  function atomicWriteJsonSync(filePath, data) {
    const content = JSON.stringify(data, null, 2);
    const tmpPath = `${filePath}.tmp`;
    try {
      fs.writeFileSync(tmpPath, content, "utf-8");
      fs.renameSync(tmpPath, filePath);
    } catch (err) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
      }
      throw err;
    }
  }
  return {
    async loadAll() {
      ensureDirs();
      try {
        const content = await fs.promises.readFile(viewsFile, "utf-8");
        const data = JSON.parse(content);
        if (!data.views || data.views.length === 0) {
          return { views: [], activeViewId: null, activeContent: null };
        }
        const views = data.views.map((v) => ({
          id: v.id,
          title: v.title,
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
          sessionId: v.sessionId,
          source: v.source
        }));
        const activeViewId = data.activeViewId ?? views[0].id;
        const activeView = data.views.find((v) => v.id === activeViewId) ?? data.views[0];
        const activeContent = {
          canvas: activeView.canvas,
          consumed: activeView.consumed,
          viewport: activeView.viewport
        };
        for (const view of data.views) {
          if (view.id !== activeViewId) {
            const viewContent = {
              canvas: view.canvas,
              consumed: view.consumed,
              viewport: view.viewport
            };
            await fs.promises.writeFile(
              getViewContentPath(view.id),
              JSON.stringify(viewContent, null, 2),
              "utf-8"
            );
          }
        }
        return { views, activeViewId, activeContent };
      } catch (err) {
        return { views: [], activeViewId: null, activeContent: null };
      }
    },
    schedulePersist(state) {
      if (disposed) return;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        this.flushSync(state);
      }, 500);
    },
    flushSync(state) {
      if (disposed) return;
      ensureDirs();
      const allViews = state.views.map((v) => {
        if (v.id === state.activeViewId) {
          return {
            ...v,
            canvas: state.activeContent.canvas,
            consumed: state.activeContent.consumed,
            viewport: state.activeContent.viewport
          };
        }
        try {
          const contentPath = getViewContentPath(v.id);
          if (fs.existsSync(contentPath)) {
            const content = JSON.parse(fs.readFileSync(contentPath, "utf-8"));
            return { ...v, ...content };
          }
        } catch {
        }
        return {
          ...v,
          canvas: { nodes: [], edges: [], direction: "TD" },
          consumed: { consumed: false, lastConsumedAt: null, canvasSource: null },
          viewport: { x: 0, y: 0, zoom: 1 }
        };
      });
      const fileData = {
        version: 1,
        views: allViews,
        activeViewId: state.activeViewId
      };
      atomicWriteJsonSync(viewsFile, fileData);
    },
    async loadViewContent(viewId) {
      try {
        const contentPath = getViewContentPath(viewId);
        const content = await fs.promises.readFile(contentPath, "utf-8");
        return JSON.parse(content);
      } catch {
        return null;
      }
    },
    async updateViewContent(viewId, content) {
      ensureDirs();
      await atomicWriteJson(getViewContentPath(viewId), content);
    },
    async deleteViewContent(viewId) {
      try {
        const contentPath = getViewContentPath(viewId);
        await fs.promises.unlink(contentPath);
      } catch {
      }
    },
    dispose() {
      disposed = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      cleanupTempFiles();
    }
  };
}

// src/workspace-resolver.ts
import path2 from "path";
import fs2 from "fs";
var LEGACY_VIEWS_DIRNAME = ".mermaid-editor";
var VIEWS_DIRNAME = ".mermaid2aichat";
function createWorkspaceResolver(workspaceRoot) {
  if (!workspaceRoot) {
    throw new Error("workspaceRoot \u4E0D\u80FD\u4E3A\u7A7A");
  }
  const viewsDir = path2.join(workspaceRoot, VIEWS_DIRNAME);
  const legacyViewsDir = path2.join(workspaceRoot, LEGACY_VIEWS_DIRNAME);
  if (!fs2.existsSync(viewsDir) && fs2.existsSync(legacyViewsDir)) {
    fs2.renameSync(legacyViewsDir, viewsDir);
    console.log(`[Workspace] \u5DF2\u8FC1\u79FB\u5B58\u50A8\u76EE\u5F55: ${LEGACY_VIEWS_DIRNAME} \u2192 ${VIEWS_DIRNAME}`);
  }
  return {
    getWorkspaceRoot: () => workspaceRoot,
    getViewsDir: () => viewsDir,
    getViewsFile: () => path2.join(viewsDir, "views.json"),
    ensureViewsDir: () => {
      if (!fs2.existsSync(viewsDir)) {
        fs2.mkdirSync(viewsDir, { recursive: true });
      }
    }
  };
}

// src/workspace-registry.ts
var WorkspaceRegistry = class {
  workspaces = /* @__PURE__ */ new Map();
  /**
   * 获取或创建工作区上下文
   * @param workspaceRoot 工作区根目录（必传，无 fallback）
   * @throws Error 若 workspaceRoot 为空
   */
  async getOrCreate(workspaceRoot) {
    if (!workspaceRoot) {
      throw new Error("workspaceRoot \u4E0D\u80FD\u4E3A\u7A7A");
    }
    const normalizedRoot = workspaceRoot.replace(/[\\/]+$/, "");
    const existing = this.workspaces.get(normalizedRoot);
    if (existing) {
      return { store: existing.store, persistence: existing.persistence };
    }
    const resolver = createWorkspaceResolver(normalizedRoot);
    resolver.ensureViewsDir();
    const persistence = createPersistenceService(resolver.getViewsDir());
    const store = createEditorStore();
    const persisted = await persistence.loadAll();
    store.getState().restoreFromPersist({
      views: persisted.views,
      activeViewId: persisted.activeViewId,
      activeContent: persisted.activeContent
    });
    const unsubscribe = store.subscribe((state) => {
      persistence.schedulePersist({
        views: state.views,
        activeViewId: state.activeViewId,
        activeContent: {
          canvas: state.activeCanvas,
          consumed: state.activeConsumed,
          viewport: state.activeViewport
        }
      });
    });
    const ctx = { store, persistence, resolver, unsubscribe };
    this.workspaces.set(normalizedRoot, ctx);
    return { store, persistence };
  }
  /**
   * 获取已存在的工作区上下文（不创建）
   */
  get(workspaceRoot) {
    const normalizedRoot = workspaceRoot.replace(/[\\/]+$/, "");
    return this.workspaces.get(normalizedRoot) ?? null;
  }
  /**
   * 销毁所有工作区（进程退出时调用）
   */
  disposeAll() {
    for (const ctx of this.workspaces.values()) {
      const state = ctx.store.getState();
      ctx.persistence.flushSync({
        views: state.views,
        activeViewId: state.activeViewId,
        activeContent: {
          canvas: state.activeCanvas,
          consumed: state.activeConsumed,
          viewport: state.activeViewport
        }
      });
      ctx.unsubscribe();
      ctx.persistence.dispose();
    }
    this.workspaces.clear();
  }
};

// src/mcp-server.ts
var sessionIds = /* @__PURE__ */ new WeakMap();
function getOrCreateSessionId(server) {
  let sessionId = sessionIds.get(server);
  if (!sessionId) {
    sessionId = randomUUID2();
    sessionIds.set(server, sessionId);
  }
  return sessionId;
}
async function startServer(options = {}) {
  const port = options.port ?? 14514;
  const host = options.host ?? "localhost";
  const app = express();
  const httpServer = createServer(app);
  const registry = new WorkspaceRegistry();
  const wsServer = new WsServer(httpServer, registry);
  const sessions = /* @__PURE__ */ new Map();
  function createSession() {
    const mcpServer = new McpServer({
      name: "mermaid2aichat",
      version: "1.0.0"
    });
    registerCreateViewTool(mcpServer, wsServer, registry, getOrCreateSessionId);
    registerGetInputTool(mcpServer, wsServer, registry);
    registerListViewsTool(mcpServer, registry);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID2(),
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
    res.json({ status: "ok", service: "mermaid2aichat", sessions: sessions.size });
  });
  httpServer.listen(port, host, () => {
    console.log(`[MCP] Mermaid2AIChat \u670D\u52A1\u5DF2\u542F\u52A8`);
    console.log(`[MCP] HTTP:  http://${host}:${port}/mcp`);
    console.log(`[MCP] WS:    ws://${host}:${port}/ws`);
    console.log(`[MCP] \u5065\u5EB7\u68C0\u67E5: http://${host}:${port}/health`);
  });
  process.on("SIGINT", () => {
    console.log("\n[MCP] \u6B63\u5728\u5173\u95ED\u670D\u52A1...");
    wsServer.close();
    registry.disposeAll();
    httpServer.close();
    process.exit(0);
  });
}

// src/index.ts
startServer().catch((err) => {
  console.error("[MCP] \u542F\u52A8\u5931\u8D25:", err);
  process.exit(1);
});

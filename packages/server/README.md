# @mermaid-editor/server

Mermaid 反向编辑器的 MCP 服务端。通过 MCP 协议（Streamable HTTP）向 AI 暴露画布读写工具，并通过 WebSocket 与可视化编辑器（Web 编辑器 / VSCode 插件）双向同步画布状态。

## 核心定位

- **单一真相源**：Zustand Store 持有画布状态，MCP 工具与 WebSocket 服务共享同一 Store 实例（同进程）
- **双向数据流**：`get_input`（用户→AI）+ `create_view`（AI→用户）
- **消费状态机**：防止 AI 重复读取同一画布内容，用户编辑后自动重置

## 端点

默认端口 `14514`，默认主机 `localhost`。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/mcp` | POST | MCP Streamable HTTP（JSON-RPC 2.0），AI 工具调用入口 |
| `/mcp` | GET | SSE 流（服务端推送通知，需带 `mcp-session-id`） |
| `/mcp` | DELETE | 终止会话（需带 `mcp-session-id`） |
| `/ws` | WebSocket | 画布状态实时同步（编辑器客户端连接） |
| `/health` | GET | 健康检查，返回 `{ "status": "ok", "service": "mermaid-editor" }` |

## MCP 工具

### get_input（核心：用户 → AI）

获取用户在可视化编辑器中绘制的流程图，返回 mermaid 代码。调用后画布标记为已消费。

**参数**：无

**响应**（JSON，`content[0].text` 字段内）：

| status | 含义 | 附加字段 |
|--------|------|----------|
| `success` | 成功读取用户绘制内容 | `mermaid`、`nodeCount`、`edgeCount`、`direction`、`canvasSource: 'user'` |
| `already_consumed` | 画布已消费，需用户重新启用或编辑 | `lastConsumedAt`、`canvasSource` |
| `empty` | 画布为空 | 无 |
| `ai_content` | 画布当前内容为 AI 生成（非用户绘制） | `lastConsumedAt` |

### create_view（增强：AI → 用户）

将 mermaid 代码渲染为可视化画布并展示给用户。解析后写入 Store 并广播到所有编辑器客户端。

**参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `mermaid` | string | 是 | Mermaid flowchart 代码 |
| `title` | string | 否 | 图表标题 |

**响应**：

| 情况 | 响应 |
|------|------|
| 成功 | `{ success: true, message: '已展示给用户', nodeCount, edgeCount, warnings? }` |
| 解析失败且无节点 | `{ success: false, message: 'Mermaid代码解析失败', errors }` |

## WebSocket 协议

### 服务器 → 客户端

| type | payload | 说明 |
|------|---------|------|
| `canvas_update` | `{ nodes, edges, direction }` | 画布内容更新（广播给除发送方外的客户端） |
| `consumed_update` | `{ consumed, lastConsumedAt, canvasSource }` | 消费状态更新（广播给所有客户端，含发送方） |
| `create_view` | `{ title, mermaid }` | AI 推送新视图通知 |
| `reconnect_sync` | `{ canvas, consumed, title, viewport }` | 客户端（重）连接时的全量状态同步 |

### 客户端 → 服务器

| type | payload | 说明 |
|------|---------|------|
| `canvas_edit` | `{ nodes, edges, direction }` | 用户编辑画布，触发 CANVAS_EDIT 事件重置 consumed |
| `reset_consumed` | 无 | 用户点击"重新启用"，触发 RESET 事件 |
| `subscribe` | 无 | 订阅（连接时自动订阅） |

### 多客户端与重连

- **多客户端冲突**：Last Write Wins（最后写入胜出）
- **断线重连**：客户端指数退避重连，重连后服务端推送 `reconnect_sync` 全量同步
- **广播策略**：`canvas_update` 用 `broadcastExcept`（不回传发送方），`consumed_update` 用 `broadcast`（回传发送方以通知 CANVAS_EDIT 后状态重置）

## 消费状态机

画布的"消费"状态控制 AI 是否可读取，避免重复读取同一内容。

| 事件 | 触发方 | 状态转换 |
|------|--------|----------|
| `CONSUME` | AI 调用 `get_input` 成功 | `consumed = true`，记录 `lastConsumedAt` |
| `RESET` | 用户点击"重新启用" | `consumed = false` |
| `CANVAS_EDIT` | 用户编辑画布 | `consumed = false`，`canvasSource = 'user'` |
| `CREATE_VIEW` | AI 调用 `create_view` | `consumed = true`，`canvasSource = 'ai'` |

> `canvasSource` 区分内容来源：`'user'`（用户绘制，可被 get_input 读取）或 `'ai'`（AI 生成，不应被误读为用户输入）。

## 架构

### 文件结构

```
src/
├── index.ts                    # 入口，启动服务
├── mcp-server.ts               # Express + MCP Server + WebSocket 启动逻辑
├── ws-server.ts                # WebSocket 服务器（客户端管理、广播、消息路由）
├── store.ts                    # Zustand Store（画布状态唯一真相源）
├── consumed-state-machine.ts   # 消费状态机（纯函数 reducer）
└── tools/
    ├── create-view.ts          # create_view 工具注册
    └── get-input.ts            # get_input 工具注册
```

### 数据流

```
用户编辑画布（编辑器）
  → WebSocket canvas_edit
  → WsServer 更新 Store + CANVAS_EDIT 重置 consumed
  → broadcastExcept canvas_update（其他客户端）
  → broadcast consumed_update（所有客户端，含发送方）

AI 调用 get_input（MCP POST /mcp）
  → 读取 Store 画布 + 序列化为 mermaid
  → CONSUME 标记已消费
  → broadcast consumed_update
  → 返回 mermaid 代码给 AI

AI 调用 create_view（MCP POST /mcp）
  → 解析 mermaid → 写入 Store
  → CREATE_VIEW 标记 consumed=true, canvasSource='ai'
  → broadcast canvas_update + create_view
  → broadcast consumed_update
```

## 配置

### 端口与主机

默认 `port=14514`、`host=localhost`。可通过 `startServer(options)` 传入覆盖：

```typescript
import { startServer } from '@mermaid-editor/server';

await startServer({ port: 14514, host: '0.0.0.0' });
```

### AI IDE 配置

Claude Code（`~/.claude/claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "mermaid-editor": {
      "url": "http://localhost:14514/mcp",
      "transport": "streamable-http"
    }
  }
}
```

Cursor（`~/.cursor/mcp.json`）：

```json
{
  "mcpServers": {
    "mermaid-editor": {
      "url": "http://localhost:14514/mcp",
      "transport": "streamable-http"
    }
  }
}
```

## 开发命令

```bash
pnpm --filter @mermaid-editor/server install   # 安装依赖（monorepo 根目录）
pnpm --filter @mermaid-editor/server dev       # 开发模式（tsx watch 热重载）
pnpm --filter @mermaid-editor/server build     # 构建（tsup，输出 ESM + dts）
pnpm --filter @mermaid-editor/server start     # 生产启动
pnpm --filter @mermaid-editor/server typecheck # 类型检查
pnpm --filter @mermaid-editor/server test      # 运行测试（vitest）
```

## 调用示例

### 健康检查

```powershell
Invoke-RestMethod -Uri "http://localhost:14514/health"
```

### get_input（读取用户画的图）

```powershell
$body = @{
  jsonrpc = "2.0"
  id = 1
  method = "tools/call"
  params = @{
    name = "get_input"
    arguments = @{}
  }
} | ConvertTo-Json -Depth 10
Invoke-RestMethod -Uri "http://localhost:14514/mcp" -Method Post -Body $body -ContentType "application/json"
```

### create_view（AI 推送图给用户）

```powershell
$body = @{
  jsonrpc = "2.0"
  id = 2
  method = "tools/call"
  params = @{
    name = "create_view"
    arguments = @{
      mermaid = "flowchart TD`n  A[开始] --> B{条件}`n  B -->|是| C[处理]`n  B -->|否| D[结束]"
      title = "示例流程图"
    }
  }
} | ConvertTo-Json -Depth 10
Invoke-RestMethod -Uri "http://localhost:14514/mcp" -Method Post -Body $body -ContentType "application/json"
```

## 依赖

| 依赖 | 用途 |
|------|------|
| `@modelcontextprotocol/sdk` | MCP Server + Streamable HTTP Transport |
| `express` | HTTP 服务器 |
| `ws` | WebSocket 服务器 |
| `zustand` | 画布状态 Store |
| `zod` | 工具参数校验 |
| `@mermaid-editor/serializer` | Mermaid 解析/序列化（workspace 依赖） |

## 设计约束

- 本包**禁止引用** React 组件或 DOM API（模块边界约束）
- Store 是画布状态唯一真相源，客户端不直接访问 Store，仅通过 WebSocket 同步
- `express.json()` 全局中间件**不可使用**——会消费请求流导致 StreamableHTTPServerTransport 收到空 body
- MCP 会话为**有状态多会话模式**（`sessionIdGenerator: () => randomUUID()`），每个会话独立 transport + McpServer 实例，支持 SSE 推送通知

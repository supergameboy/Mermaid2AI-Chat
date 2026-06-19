# Mermaid2AI-Chat

通过 MCP 协议将可视化流程图编辑器与 AI 对话无缝集成，消除"编辑器↔AI对话"的复制粘贴割裂感。让 TRAE 直接读取你在画布上画的流程图。

## 核心价值

- **填补空白**：AI IDE 无法直接读取用户在编辑器中画的流程图，本项目通过 MCP 协议让 AI 直接读取画布状态
- **无缝集成**：用户画图后无需复制 mermaid 代码到聊天框，AI 自动读取
- **双向交互**：支持"用户画图→AI分析"和"AI展示→用户查看"两个场景

## 两个预设场景

### 场景一：用户画图 → AI 对话（核心场景）
1. 用户在编辑器画布上绘制流程图
2. 用户在 AI 对话中说"看看我画的流程图"或调用 `/mermaid-flow-editor`
3. AI 自动调用 `get_input` 工具读取画布状态
4. AI 基于读取的 mermaid 代码进行分析、回答

### 场景二：AI 输出 → 用户可视化（增强场景）
1. AI 生成 mermaid 代码
2. AI 判断是否调用 `create_view` 工具（复杂流程5+节点时调用）
3. 编辑器弹出可视化画布，用户可进一步编辑

## 项目结构

```
mermaid2ai-chat/
├── packages/                          # 源代码（monorepo）
│   ├── editor/                        # 可视化编辑器（React Flow 画布组件库，可复用）
│   ├── serializer/                    # Mermaid 序列化器（画布状态↔mermaid 双向转换）
│   ├── server/                        # MCP 服务端 + WebSocket + Store
│   ├── vscode-extension/              # VSCode 插件（自动启动 server）
│   └── web-editor/                    # Web 编辑器
├── skills/                            # SKILL 文件
│   └── mermaid-flow-editor/
│       ├── SKILL.md                   # SKILL 主文件
│       ├── references/                # 语法参考与示例
│       └── examples.md                # 示例库
```

## 模块划分

| 模块 | 名称 | 核心职责 | 状态 |
|------|------|----------|------|
| 模块1 | 可视化编辑器 | 画布UI、14种节点形状、8种边样式、状态管理 | 已实现 |
| 模块2 | Mermaid序列化器 | 画布状态↔mermaid代码双向转换、错误收集 | 已实现 |
| 模块3 | MCP服务端 | get_input/create_view 工具、Streamable HTTP、消费状态机 | 已实现 |
| 模块4 | SKILL规范 | AI交互规范、触发策略、工具使用决策树 | 已实现 |
| 模块5 | VSCode插件 | IDE内集成编辑器、自动启动server、WebSocket同步 | 已实现 |
| 模块6 | Web编辑器 | 浏览器版备选方案 | 已实现 |

## 技术栈

- **前端**：React 18 + @xyflow/react (React Flow v12) + Zustand
- **后端**：Node.js + Express + WebSocket (ws)
- **MCP**：@modelcontextprotocol/sdk（Streamable HTTP）
- **解析**：@crafter/mermaid-parser + 自研序列化器
- **IDE集成**：VSCode Extension API
- **构建**：tsup（serializer/server）+ Vite（editor/web-editor）+ esbuild（vscode-extension）
- **测试**：vitest

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 构建

```bash
pnpm build
```

### 3. 配置 TRAE 的 MCP 服务器

在 TRAE 的 MCP 服务器配置中添加：

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

### 4. 安装 SKILL

将 `skills/mermaid-flow-editor` 复制到 TRAE 的 skills 目录。

### 5. 使用

**方式一：Web 编辑器**

```bash
# 启动 MCP 服务端（端口 14514）
pnpm --filter @mermaid-editor/server start

# 启动 Web 编辑器开发服务器
pnpm --filter @mermaid-editor/web-editor dev
```
访问 http://localhost:5173 ，在画布上绘制流程图，然后在 TRAE 对话中输入"看看我画的流程图"，AI 自动读取画布并分析。

**方式二：VSCode 插件**

在 `packages/vscode-extension` 下按 F5 启动调试，插件会自动启动 MCP 服务端并打开编辑器面板，无需手动启动 server。

## 调研结论

- 现有 mermaid 可视化编辑器（mermaid-visual-editor、Visual Mermaid Editor、Flowova）都支持"图→代码"
- 但都是独立应用，与 AI 对话割裂，需要手动复制粘贴
- **没有"编辑器→AI对话"的直接 MCP 集成方案**，这是本项目要填补的空白

## 学术支撑

- **TextFlow**（NAACL 2025）：证明把流程图转成中间文本表示让 LLM 推理，优于端到端 VLM 直接看图。与本项目"画布状态→Mermaid文本→AI读取"方向一致。
- **FlowPathAgent**（EMNLP 2025）：证明结构化流程图数据辅助 LLM 推理能提升可验证性。与本项目"通过 MCP 提供结构化画布状态"一致。

## License

MIT

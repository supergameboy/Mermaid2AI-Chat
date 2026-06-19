# Mermaid 反向编辑器

通过 MCP 协议将可视化流程图编辑器与 AI 对话无缝集成，消除"编辑器↔AI对话"的复制粘贴割裂感。

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
mermaid反向编辑器/
├── skills/                        # SKILL 文件
│   └── mermaid-flow-editor/
│       ├── SKILL.md               # SKILL 主文件
│       ├── examples.md            # 示例库
│       └── README.md              # 安装指南
└── src/                           # 源代码（待实现）
    ├── editor/                    # 模块1：可视化编辑器
    ├── serializer/                # 模块2：Mermaid序列化器
    ├── mcp-server/                # 模块3：MCP服务端
    └── vscode-plugin/             # VScode插件
```

## 模块划分

| 模块 | 名称 | 核心职责 | 状态 |
|------|------|----------|------|
| 模块1 | 可视化编辑器 | 画布UI、节点/边交互、状态管理 | 学习同行代码 |
| 模块2 | Mermaid序列化器 | 画布状态↔mermaid代码双向转换 | 学习同行代码 |
| 模块3 | MCP服务端 | 工具协议、HTTP接口、与编辑器状态同步 | 核心创新 |
| 模块4 | SKILL规范 | AI交互规范文档、场景定义、工具使用说明 | 核心创新 |

## 技术栈

- **前端**：React 18 + React Flow v12 + Zustand
- **后端**：Node.js + Express + WebSocket
- **MCP**：@modelcontextprotocol/server（Streamable HTTP）
- **解析**：@crafter/mermaid-parser
- **IDE集成**：VScode Extension API

## 快速开始

### 1. 安装并启动 MCP 服务

```bash
npm install
npm run build
npm run start
```

### 2. 配置 AI IDE

编辑 `~/.claude/claude_desktop_config.json`：

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

### 3. 安装 SKILL

```bash
cp -r skills/mermaid-flow-editor ~/.claude/skills/
```

### 4. 使用

1. 启动 MCP 服务端（端口 14514）：`pnpm --filter @mermaid-editor/server start`
2. 启动 Web 编辑器开发服务器：`pnpm --filter @mermaid-editor/web-editor dev`，访问 http://localhost:5173
3. 在画布上绘制流程图
4. 在 AI 对话中输入"看看我画的流程图"
5. AI 自动读取画布并分析

详细部署指南：[docs/deployment/部署指南.md](docs/deployment/部署指南.md)

## 调研结论

- 现有 mermaid 可视化编辑器（mermaid-visual-editor、Visual Mermaid Editor、Flowova）都支持"图→代码"
- 但都是独立应用，与 AI 对话割裂，需要手动复制粘贴
- **没有"编辑器→AI对话"的直接 MCP 集成方案**，这是本项目要填补的空白

详细调研报告：[docs/design/调研报告-避免重复造轮子分析-20260619.md](docs/design/调研报告-避免重复造轮子分析-20260619.md)

## 文档索引

### 需求文档
- [需求规格说明书](docs/requirements/需求规格说明书.md)

### 设计文档
- [总规划](docs/design/fractal-design-20260619-mermaid反向编辑器-总规划.md)
- [架构设计文档](docs/architecture/架构设计文档.md)
- [模块1：可视化编辑器](docs/design/fractal-design-20260619-mermaid反向编辑器-模块1-可视化编辑器.md)
- [模块2：Mermaid序列化器](docs/design/fractal-design-20260619-mermaid反向编辑器-模块2-Mermaid序列化器.md)
- [模块3：MCP服务端](docs/design/fractal-design-20260619-mermaid反向编辑器-模块3-MCP服务端.md)
- [模块4：SKILL规范](docs/design/fractal-design-20260619-mermaid反向编辑器-模块4-SKILL规范.md)

### 测试文档
- [测试计划](docs/testing/测试计划.md)

### 部署运维文档
- [部署指南](docs/deployment/部署指南.md)

### 调研文档
- [调研报告-避免重复造轮子分析](docs/design/调研报告-避免重复造轮子分析-20260619.md)

## License

MIT

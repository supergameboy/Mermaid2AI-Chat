---
name: mermaid2aichat
description: |
  This skill should be used when the user asks to "看看我画的", "分析这个流程",
  "我画了个图", "我画的流程图", "看看这个图", "读取画布", "read my drawing",
  or mentions analyzing a flowchart they've drawn in the visual editor.
  Also use when the user asks to "画流程图", "画一个流程", "展示流程",
  "可视化流程", "visualize flow", or wants to show a flow in an
  interactive editable canvas. Also triggers on mentions of "mermaid",
  "flowchart", "process diagram", or "流程图" in the context of drawing,
  reading, or visualizing process flows. Core capability: read user's drawn
  flowcharts via get_input (fills the gap where AI IDEs cannot read visual
  editor content). Enhancement: show flows via create_view (optional, since
  most AI IDEs render mermaid code blocks natively).
allowed-tools: mcp__mermaid2aichat__get_input, mcp__mermaid2aichat__create_view
version: 1.1.0
author: Supergameboy/AAG
license: MIT
mcp-servers:
  - mermaid2aichat
user-invocable: true
---

# Mermaid2AIChat

## 核心定位

**get_input 是核心价值**：填补 AI 无法读图的空白。用户在可视化编辑器中绘制流程图，AI 通过 `get_input` 读取并分析。

**create_view 是可选增强**：大多数 AI IDE 已支持 mermaid 代码块渲染，`create_view` 提供交互式可编辑画布作为增强体验。

## 两个预设场景

### 场景1：用户画图 → AI 分析（get_input）

用户在编辑器中绘制流程图，然后要求 AI 分析。

**触发关键词**：看看我画的、分析这个流程、我画了个图、读取画布、read my drawing

**执行流程**：
1. 调用 `get_input` 读取画布
2. 根据返回的 `status` 字段处理：
   - `status: 'success'` → 获取 mermaid 代码，进行分析/回答
   - `status: 'already_consumed'` → 提示"画布已消费，请点击重新启用或编辑画布后再次询问"
   - `status: 'empty'` → 提示"画布为空，请先在编辑器中绘制流程图"
   - `status: 'ai_content'` → 提示"画布当前内容为AI生成，如需分析请先编辑画布"

### 场景2：AI 展示 → 用户查看（create_view）

AI 生成流程图代码，通过 `create_view` 展示到编辑器画布。

**触发关键词**：画流程图、展示流程、可视化流程、visualize flow

**执行流程**：
1. 生成 mermaid flowchart 代码
2. 调用 `create_view` 展示到画布
3. 根据返回结果处理：
   - `success: true` → 告知"已展示到编辑器画布"
   - `success: false` → 修正 mermaid 代码后重试（最多1次），仍失败则展示错误信息

## 何时不调用工具

### 何时不调用 create_view（直接输出 mermaid 代码块即可）

- 简单流程图（<5 节点）
- 用户只需查看，无需交互编辑
- 大多数 AI IDE 已支持 mermaid 代码块渲染，直接输出代码即可

### 何时不调用任何工具

- 用户只是询问 mermaid 语法（如"mermaid 怎么画菱形"）→ 直接回答语法
- 用户要求修改代码（非流程图相关）→ 直接修改代码
- 简单的 2 步流程（如"A 然后 B"）→ 直接文字描述即可，无需可视化

## Mermaid 代码规范

### 核心规范（必须遵守）

1. 使用 `flowchart` 关键字（非 `graph`）
2. 声明方向：`flowchart TD` 或 `flowchart LR`
3. 节点 ID 使用短 ID（A, B, C...）
4. 节点文本用形状语法包裹：`A[开始]`

### 快速参考

**节点形状**：14种（矩形 `[文本]`、圆角 `(文本)`、菱形 `{文本}`、圆形 `((文本))`、圆柱 `[(文本)]`、不对称 `>文本]` 等）

**边样式**：8种（箭头 `-->`、直线 `---`、虚线 `-.-`、粗线箭头 `==>`、圆形端点 `---o`、交叉端点 `---x`、双向箭头 `<--->` 等）

**边标签**：`A -->|是| B` 或 `A -- 是 --> B`

完整语法参考（14种形状 + 8种边样式 + 转义规则 + 长度变体）见 **`references/mermaid-syntax.md`**。

## 错误处理

### get_input 失败
- 服务不可用：提示"编辑器服务未启动，请先启动 mermaid 编辑器服务"
- 画布为空（`status: 'empty'`）：提示"画布为空，请先在编辑器中绘制流程图"
- 已消费（`status: 'already_consumed'`）：提示"画布内容已被消费，请点击'重新启用'或编辑画布后再次询问"

### create_view 失败
- 解析错误：修正 mermaid 代码后重试（最多1次），仍失败则展示具体解析错误信息
- 服务不可用：提示"编辑器服务未启动，请先启动 mermaid 编辑器服务"

### 避免无限循环
- `get_input` 返回 `status: 'already_consumed'` 后，不要重复调用，直接提示用户
- `create_view` 解析失败最多重试1次，仍失败则展示错误信息

## 消费状态机制

- AI 调用 `get_input` 成功后，画布标记为"已消费"
- 用户编辑画布后，自动重置为"待消费"（AI 可再次读取）
- 用户点击"重新启用"按钮，手动重置为"待消费"
- AI 调用 `create_view` 后，画布标记为"已消费"（AI生成内容无需再被读取）

## 主动调用

用户输入 `/mermaid2aichat` 时，默认调用 `get_input` 读取画布（get_input 是核心功能）。

## Additional Resources

### Reference Files

For detailed mermaid syntax reference, consult:
- **`references/mermaid-syntax.md`** - 完整的14种节点形状、8种边样式、转义规则、长度变体

### Example Files

Working examples in:
- **`references/examples.md`** - 9个场景示例（用户画图分析、AI展示、空画布处理、已消费处理、编辑后重读、解析失败重试、主动调用、直接输出代码块、服务不可用）

## 技能协作接口

### 定位

Mermaid2AIChat 的 AI 侧入口。连接用户可视化编辑器与 AI 对话，通过 MCP 协议消除"编辑器↔AI对话"的复制粘贴割裂感。

### 触发条件

| 触发场景 | 说明 |
|----------|------|
| 用户画图求分析 | 用户在编辑器绘制流程图后要求 AI 分析 |
| AI 展示流程 | AI 生成 mermaid 代码并展示到可编辑画布 |
| 主动调用 | 用户输入 `/mermaid2aichat` 默认读图 |

### 依赖

| 依赖 | 说明 |
|------|------|
| MCP 服务端 `mermaid2aichat` | 提供 `get_input` 和 `create_view` 工具 |
| 可视化编辑器 | Web 编辑器或 VSCode 插件，用户绘制流程图的界面 |

### 输出产物

| 输出 | 说明 |
|------|------|
| 流程图分析 | 基于 `get_input` 读取的 mermaid 代码进行分析回答 |
| 画布展示 | 通过 `create_view` 将 mermaid 代码推送到编辑器画布 |

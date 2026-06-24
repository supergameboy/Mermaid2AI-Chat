# Mermaid2AIChat — Example Library

## Example 1: User draws → AI analyzes

User: "看看我画的流程图"

AI behavior:
1. Call `get_input`.
2. Receive `status: 'success'` with Mermaid code.
3. Analyze and respond.

```
Canvas content:
  flowchart TD
    A[用户访问] --> B{已登录?}
    B -->|是| C[进入首页]
    B -->|否| D[跳转登录页]
    D --> E[输入凭证]
    E --> F{验证成功?}
    F -->|是| C
    F -->|否| D
```

AI response: "这是一个用户登录流程图。流程从用户访问开始，判断是否已登录。已登录则进入首页，未登录则跳转登录页输入凭证，验证成功进入首页，失败则回到登录页。"

---

## Example 2: AI shows a flowchart in a new tab

User: "解释微服务架构请求流程"

AI behavior:
1. Generate Mermaid code.
2. Call `create_view` to open a new editor tab.
3. Receive `success: true`.
4. Explain the flow.

```
AI-generated Mermaid:
  flowchart LR
    A[客户端] --> B[API网关]
    B --> C[认证服务]
    B --> D[业务服务]
    D --> E[(数据库)]
    D --> F[消息队列]
    F --> G[通知服务]
```

AI response: "已在新标签页展示微服务架构的请求流程。客户端请求经过API网关，网关调用认证服务验证身份，然后转发到业务服务，业务服务读写数据库并通过消息队列异步通知。"

**Key point**: `create_view` always creates a new tab; it never overwrites existing views.

---

## Example 3: AI shows a sequence diagram

User: "画一个登录的时序图"

AI behavior:
1. Generate `sequenceDiagram` code.
2. Call `create_view` (diagramType auto-detected as `sequenceDiagram`).
3. Receive `success: true`.

```
AI-generated Mermaid:
  sequenceDiagram
    participant U as 用户
    participant C as 客户端
    participant S as 认证服务
    U->>C: 输入用户名密码
    C->>S: 发送登录请求
    alt 验证成功
      S-->>C: 返回 Token
      C-->>U: 进入首页
    else 验证失败
      S-->>C: 返回错误
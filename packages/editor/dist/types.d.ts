/**
 * editor 包类型定义 — Canvas 组件接口（V2-4 多标签页）
 */
import type { CanvasSource, FlowchartDirection, MermaidEdge, MermaidNode, Tab, Viewport } from '@mermaid-editor/serializer';
/** 连接状态 */
export type ConnectionStatusType = 'connected' | 'reconnecting' | 'disconnected';
/** 画布快照（用于发送到服务端） */
export interface CanvasSnapshot {
    nodes: MermaidNode[];
    edges: MermaidEdge[];
    direction: FlowchartDirection;
}
/**
 * Canvas 组件 Props（V2-4 多标签页）
 *
 * 数据流设计（单向，无循环）：
 * - 服务端同步：syncNodes/syncEdges/syncDirection/syncViewport → Canvas 内部 useEffect → React Flow state
 * - 本地操作：React Flow state → ref → onCanvasEdit/onViewportChange 回调 → 外部发送到服务端
 * - 标签页操作：tabs/activeTabId → TabBar 渲染 → onTabSwitch/onTabClose 回调 → 外部发送到服务端
 */
export interface CanvasProps {
    /** 服务端同步的节点（变化时覆盖 Canvas 内部 state） */
    syncNodes: MermaidNode[];
    /** 服务端同步的边 */
    syncEdges: MermaidEdge[];
    /** 服务端同步的方向 */
    syncDirection: FlowchartDirection;
    /** 服务端同步的视口（平移/缩放） */
    syncViewport: Viewport | null;
    /** 消费状态 */
    consumed: boolean;
    /** 画布内容来源 */
    canvasSource: CanvasSource;
    /** 最后消费时间戳 */
    lastConsumedAt: number | null;
    /** WebSocket 连接状态 */
    connectionStatus: ConnectionStatusType;
    /** 所有标签页（供 TabBar 渲染） */
    tabs: Tab[];
    /** 当前激活标签页 ID */
    activeTabId: string | null;
    /** 画布编辑回调（用户操作触发，外部负责发送到服务端） */
    onCanvasEdit: (canvas: CanvasSnapshot) => void;
    /** 方向变化回调 */
    onDirectionChange: (dir: FlowchartDirection) => void;
    /** 重置消费状态回调 */
    onResetConsumed: () => void;
    /** 视口变化回调（用户平移/缩放触发，外部负责发送 viewport_edit 到服务端） */
    onViewportChange: (viewport: Viewport) => void;
    /** 导入 mermaid 代码回调（V2-7：外部负责解析并发送 canvas_edit 到服务端） */
    onImport: (mermaid: string) => void;
    /** 标签页切换回调（V2-4：外部负责发送 tab_switch 到服务端） */
    onTabSwitch: (tabId: string) => void;
    /** 标签页关闭回调（V2-4：外部负责发送 tab_close 到服务端） */
    onTabClose: (tabId: string) => void;
}
//# sourceMappingURL=types.d.ts.map
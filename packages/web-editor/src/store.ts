/**
 * 客户端 Store — 通过 WebSocket 与服务端同步
 * 本地状态为镜像，服务端 Store 为真相源
 *
 * 多标签页架构：
 * - views/activeViewId: 视图列表（元数据）+ 活动视图 ID
 * - nodes/edges/direction/viewport/consumed/title: 活动视图内容（镜像）
 */
import { create } from 'zustand';
import type {
  CanvasSource,
  FlowchartDirection,
  MermaidEdge,
  MermaidNode,
  Viewport,
  ViewSummary,
} from '@mermaid2aichat/serializer';

/** 活动视图内容同步载荷 */
export interface ActiveViewPayload {
  viewId: string;
  canvas: { nodes: MermaidNode[]; edges: MermaidEdge[]; direction: FlowchartDirection };
  consumed: { consumed: boolean; lastConsumedAt: number | null; canvasSource: CanvasSource };
  viewport: Viewport;
  title: string | null;
}

interface ClientEditorStore {
  // === 视图列表（元数据） ===
  views: ViewSummary[];
  activeViewId: string | null;

  // === 活动视图内容（镜像服务端） ===
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  direction: FlowchartDirection;
  viewport: Viewport | null;
  consumed: boolean;
  lastConsumedAt: number | null;
  canvasSource: CanvasSource;
  title: string | null;

  // === 本地操作（触发 WebSocket 同步） ===
  setNodes: (nodes: MermaidNode[]) => void;
  setEdges: (edges: MermaidEdge[]) => void;
  addNode: (node: MermaidNode) => void;
  updateNode: (id: string, data: Partial<MermaidNode>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: MermaidEdge) => void;
  updateEdge: (id: string, data: Partial<MermaidEdge>) => void;
  removeEdge: (id: string) => void;
  setDirection: (dir: FlowchartDirection) => void;

  // === 服务端同步操作（不触发 WebSocket 回传） ===
  setCanvasSync: (nodes: MermaidNode[], edges: MermaidEdge[], direction: FlowchartDirection) => void;
  setConsumedSync: (consumed: boolean, lastConsumedAt: number | null, canvasSource: CanvasSource) => void;
  setTitleSync: (title: string | null) => void;
  setViewportSync: (viewport: Viewport) => void;

  // === 视图列表同步（服务端→客户端） ===
  /** 同步视图列表（views_update 消息） */
  setViewsSync: (views: ViewSummary[], activeViewId: string | null) => void;
  /** 同步活动视图完整内容（active_view_update / reconnect_sync 消息） */
  setActiveViewContentSync: (payload: ActiveViewPayload) => void;

  // === 读取 ===
  getCanvas: () => { nodes: MermaidNode[]; edges: MermaidEdge[]; direction: FlowchartDirection };

  // === 重置消费状态（触发 WebSocket） ===
  resetConsumed: () => void;
}

export const useEditorStore = create<ClientEditorStore>((set, get) => ({
  // 视图列表
  views: [],
  activeViewId: null,

  // 活动视图内容
  nodes: [],
  edges: [],
  direction: 'TD',
  viewport: null,
  consumed: false,
  lastConsumedAt: null,
  canvasSource: null,
  title: null,

  // 本地操作
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  addNode: (node) =>
    set((s) => ({ nodes: [...s.nodes, node] })),

  updateNode: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, ...data, data: { ...n.data, ...data.data } } : n
      ),
    })),

  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
    })),

  addEdge: (edge) =>
    set((s) => ({ edges: [...s.edges, edge] })),

  updateEdge: (id, data) =>
    set((s) => ({
      edges: s.edges.map((e) =>
        e.id === id ? { ...e, ...data, data: { ...e.data, ...data.data } } : e
      ),
    })),

  removeEdge: (id) =>
    set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

  setDirection: (dir) => set({ direction: dir }),

  // 服务端同步（不触发回传）
  setCanvasSync: (nodes, edges, direction) =>
    set({ nodes, edges, direction }),

  setConsumedSync: (consumed, lastConsumedAt, canvasSource) =>
    set({ consumed, lastConsumedAt, canvasSource }),

  setTitleSync: (title) => set({ title }),

  setViewportSync: (viewport) => set({ viewport }),

  // 视图列表同步
  setViewsSync: (views, activeViewId) =>
    set({ views, activeViewId }),

  setActiveViewContentSync: (payload) =>
    set({
      activeViewId: payload.viewId,
      nodes: payload.canvas.nodes,
      edges: payload.canvas.edges,
      direction: payload.canvas.direction,
      consumed: payload.consumed.consumed,
      lastConsumedAt: payload.consumed.lastConsumedAt,
      canvasSource: payload.consumed.canvasSource,
      viewport: payload.viewport,
      title: payload.title,
    }),

  // 读取
  getCanvas: () => {
    const s = get();
    return { nodes: s.nodes, edges: s.edges, direction: s.direction };
  },

  // 重置消费状态
  resetConsumed: () => set({ consumed: false }),
}));

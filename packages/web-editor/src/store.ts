/**
 * 客户端 Store — 通过 WebSocket 与服务端同步
 * 本地状态为镜像，服务端 Store 为真相源
 *
 * 多标签页架构：
 * - views/activeViewId: 视图列表（元数据）+ 活动视图 ID
 * - activeCanvas: 活动视图完整画布状态（CanvasState 联合类型，唯一真相源）
 * - nodes/edges/direction: 图结构类型的派生字段（仅当 activeCanvas 为 GraphCanvasState 时有效）
 *
 * 多图表类型：
 * - activeCanvas.diagramType 决定渲染器选择
 * - 图结构类型：nodes/edges/direction 派生字段有效
 * - 数据图表类型：nodes/edges/direction 为空，使用 activeCanvas 的专用字段
 */
import { create } from 'zustand';
import type {
  CanvasSource,
  CanvasState,
  FlowchartDirection,
  MermaidEdge,
  MermaidNode,
  Viewport,
  ViewSummary,
} from '@mermaid2aichat/serializer';
import { isGraphCanvasState, migrateCanvasState } from '@mermaid2aichat/serializer';

/** 活动视图内容同步载荷 */
export interface ActiveViewPayload {
  viewId: string;
  canvas: CanvasState;
  consumed: { consumed: boolean; lastConsumedAt: number | null; canvasSource: CanvasSource };
  viewport: Viewport;
  title: string | null;
}

/** 从 CanvasState 派生图结构字段（非图结构类型返回空数组） */
function deriveGraphFields(canvas: CanvasState): {
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  direction: FlowchartDirection;
} {
  if (isGraphCanvasState(canvas)) {
    return {
      nodes: canvas.nodes,
      edges: canvas.edges,
      direction: canvas.direction ?? 'TD',
    };
  }
  return { nodes: [], edges: [], direction: 'TD' };
}

interface ClientEditorStore {
  // === 视图列表（元数据） ===
  views: ViewSummary[];
  activeViewId: string | null;

  // === 活动视图内容（镜像服务端） ===
  /** 活动视图完整画布状态（联合类型，唯一真相源） */
  activeCanvas: CanvasState;
  /** 图结构类型派生字段（仅当 activeCanvas 为 GraphCanvasState 时有效） */
  nodes: MermaidNode[];
  /** 图结构类型派生字段 */
  edges: MermaidEdge[];
  /** 图结构类型派生字段 */
  direction: FlowchartDirection;
  viewport: Viewport | null;
  consumed: boolean;
  lastConsumedAt: number | null;
  canvasSource: CanvasSource;
  title: string | null;

  // === 本地操作（图结构类型，触发 WebSocket 同步） ===
  setNodes: (nodes: MermaidNode[]) => void;
  setEdges: (edges: MermaidEdge[]) => void;
  addNode: (node: MermaidNode) => void;
  updateNode: (id: string, data: Partial<MermaidNode>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: MermaidEdge) => void;
  updateEdge: (id: string, data: Partial<MermaidEdge>) => void;
  removeEdge: (id: string) => void;
  setDirection: (dir: FlowchartDirection) => void;

  // === 本地操作（数据图表类型，触发 WebSocket 同步） ===
  /** 更新活动画布（全量替换，用于数据图表类型） */
  setActiveCanvas: (canvas: CanvasState) => void;

  // === 服务端同步操作（不触发 WebSocket 回传） ===
  /** 同步活动画布（canvas_update 消息，联合类型） */
  setCanvasSync: (canvas: CanvasState) => void;
  setConsumedSync: (consumed: boolean, lastConsumedAt: number | null, canvasSource: CanvasSource) => void;
  setTitleSync: (title: string | null) => void;
  setViewportSync: (viewport: Viewport) => void;

  // === 视图列表同步（服务端→客户端） ===
  /** 同步视图列表（views_update 消息） */
  setViewsSync: (views: ViewSummary[], activeViewId: string | null) => void;
  /** 同步活动视图完整内容（active_view_update / reconnect_sync 消息） */
  setActiveViewContentSync: (payload: ActiveViewPayload) => void;

  // === 读取 ===
  getActiveCanvas: () => CanvasState;
  /** 读取图结构类型快照（仅图结构类型有效） */
  getCanvas: () => { nodes: MermaidNode[]; edges: MermaidEdge[]; direction: FlowchartDirection };

  // === 重置消费状态（触发 WebSocket） ===
  resetConsumed: () => void;
}

/** 创建默认画布（flowchart） */
function createDefaultCanvas(): CanvasState {
  return { diagramType: 'flowchart', nodes: [], edges: [], direction: 'TD' };
}

export const useEditorStore = create<ClientEditorStore>((set, get) => ({
  // 视图列表
  views: [],
  activeViewId: null,

  // 活动视图内容
  activeCanvas: createDefaultCanvas(),
  nodes: [],
  edges: [],
  direction: 'TD',
  viewport: null,
  consumed: false,
  lastConsumedAt: null,
  canvasSource: null,
  title: null,

  // === 本地操作（图结构类型） ===
  setNodes: (nodes) =>
    set((s) => {
      if (!isGraphCanvasState(s.activeCanvas)) return s;
      const newCanvas: CanvasState = { ...s.activeCanvas, nodes };
      return { activeCanvas: newCanvas, nodes };
    }),

  setEdges: (edges) =>
    set((s) => {
      if (!isGraphCanvasState(s.activeCanvas)) return s;
      const newCanvas: CanvasState = { ...s.activeCanvas, edges };
      return { activeCanvas: newCanvas, edges };
    }),

  addNode: (node) =>
    set((s) => {
      if (!isGraphCanvasState(s.activeCanvas)) return s;
      const newCanvas: CanvasState = { ...s.activeCanvas, nodes: [...s.activeCanvas.nodes, node] };
      return { activeCanvas: newCanvas, nodes: newCanvas.nodes };
    }),

  updateNode: (id, data) =>
    set((s) => {
      if (!isGraphCanvasState(s.activeCanvas)) return s;
      const newNodes = s.activeCanvas.nodes.map((n) =>
        n.id === id ? { ...n, ...data, data: { ...n.data, ...data.data } } : n
      );
      const newCanvas: CanvasState = { ...s.activeCanvas, nodes: newNodes };
      return { activeCanvas: newCanvas, nodes: newNodes };
    }),

  removeNode: (id) =>
    set((s) => {
      if (!isGraphCanvasState(s.activeCanvas)) return s;
      const newNodes = s.activeCanvas.nodes.filter((n) => n.id !== id);
      const newEdges = s.activeCanvas.edges.filter((e) => e.source !== id && e.target !== id);
      const newCanvas: CanvasState = { ...s.activeCanvas, nodes: newNodes, edges: newEdges };
      return { activeCanvas: newCanvas, nodes: newNodes, edges: newEdges };
    }),

  addEdge: (edge) =>
    set((s) => {
      if (!isGraphCanvasState(s.activeCanvas)) return s;
      const newCanvas: CanvasState = { ...s.activeCanvas, edges: [...s.activeCanvas.edges, edge] };
      return { activeCanvas: newCanvas, edges: newCanvas.edges };
    }),

  updateEdge: (id, data) =>
    set((s) => {
      if (!isGraphCanvasState(s.activeCanvas)) return s;
      const newEdges = s.activeCanvas.edges.map((e) =>
        e.id === id ? { ...e, ...data, data: { ...e.data, ...data.data } } : e
      );
      const newCanvas: CanvasState = { ...s.activeCanvas, edges: newEdges };
      return { activeCanvas: newCanvas, edges: newEdges };
    }),

  removeEdge: (id) =>
    set((s) => {
      if (!isGraphCanvasState(s.activeCanvas)) return s;
      const newEdges = s.activeCanvas.edges.filter((e) => e.id !== id);
      const newCanvas: CanvasState = { ...s.activeCanvas, edges: newEdges };
      return { activeCanvas: newCanvas, edges: newEdges };
    }),

  setDirection: (dir) =>
    set((s) => {
      if (!isGraphCanvasState(s.activeCanvas)) return s;
      const newCanvas: CanvasState = { ...s.activeCanvas, direction: dir };
      return { activeCanvas: newCanvas, direction: dir };
    }),

  // === 本地操作（数据图表类型 / 类型切换） ===
  setActiveCanvas: (canvas) =>
    set(() => {
      // diagramType 基于代码自动识别，允许类型切换
      const derived = deriveGraphFields(canvas);
      return { activeCanvas: canvas, ...derived };
    }),

  // === 服务端同步操作 ===
  setCanvasSync: (canvas) => {
    const migrated = migrateCanvasState(canvas);
    const derived = deriveGraphFields(migrated);
    set({ activeCanvas: migrated, ...derived });
  },

  setConsumedSync: (consumed, lastConsumedAt, canvasSource) =>
    set({ consumed, lastConsumedAt, canvasSource }),

  setTitleSync: (title) => set({ title }),

  setViewportSync: (viewport) => set({ viewport }),

  // 视图列表同步
  setViewsSync: (views, activeViewId) =>
    set({ views, activeViewId }),

  setActiveViewContentSync: (payload) => {
    const migrated = migrateCanvasState(payload.canvas);
    const derived = deriveGraphFields(migrated);
    set({
      activeViewId: payload.viewId,
      activeCanvas: migrated,
      ...derived,
      consumed: payload.consumed.consumed,
      lastConsumedAt: payload.consumed.lastConsumedAt,
      canvasSource: payload.consumed.canvasSource,
      viewport: payload.viewport,
      title: payload.title,
    });
  },

  // 读取
  getActiveCanvas: () => get().activeCanvas,

  getCanvas: () => {
    const s = get();
    return { nodes: s.nodes, edges: s.edges, direction: s.direction };
  },

  // 重置消费状态
  resetConsumed: () => set({ consumed: false }),
}));

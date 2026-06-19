/**
 * Zustand Store — 画布状态唯一真相源
 * MCP 服务端和 WebSocket 服务端共享同一 Store 实例（同进程）
 */
import { create } from 'zustand';
import type {
  CanvasState,
  CanvasSource,
  ConsumedState,
  FlowchartDirection,
  MermaidEdge,
  MermaidNode,
  Viewport,
} from '@mermaid-editor/serializer';

export interface EditorStore extends CanvasState, ConsumedState {
  title: string | null;
  viewport: Viewport;

  // 画布操作
  setCanvas: (state: Partial<CanvasState>) => void;
  addNode: (node: MermaidNode) => void;
  updateNode: (id: string, data: Partial<MermaidNode>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: MermaidEdge) => void;
  updateEdge: (id: string, data: Partial<MermaidEdge>) => void;
  removeEdge: (id: string) => void;
  setDirection: (dir: FlowchartDirection) => void;

  // 视口操作
  setViewport: (viewport: Viewport) => void;

  // 消费状态操作
  setConsumed: (consumed: boolean) => void;
  setCanvasSource: (source: CanvasSource) => void;
  setLastConsumedAt: (timestamp: number) => void;
  resetConsumed: () => void;

  // 标题操作
  setTitle: (title: string | null) => void;

  // 读取方法（供 WebSocket 重连同步）
  getCanvas: () => CanvasState;
  getConsumedState: () => ConsumedPayload;
  getTitle: () => string | null;
  getViewport: () => Viewport;

  // 订阅
  subscribe: (listener: (state: EditorStore) => void) => () => void;
}

export interface ConsumedPayload {
  consumed: boolean;
  lastConsumedAt: number | null;
  canvasSource: CanvasSource;
}

export interface CanvasPayload {
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  direction: FlowchartDirection;
}

export const useEditorStore = create<EditorStore>((set, get, store) => ({
  // 初始状态
  nodes: [],
  edges: [],
  direction: 'TD',
  consumed: false,
  lastConsumedAt: null,
  canvasSource: null,
  title: null,
  viewport: { x: 0, y: 0, zoom: 1 },

  // 画布操作
  setCanvas: (state) =>
    set((s) => ({ ...s, ...state })),

  addNode: (node) =>
    set((s) => ({
      nodes: [...s.nodes, node],
      consumed: false,
      canvasSource: 'user',
    })),

  updateNode: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...data, data: { ...n.data, ...data.data } } : n)),
      consumed: false,
      canvasSource: 'user',
    })),

  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      consumed: false,
      canvasSource: 'user',
    })),

  addEdge: (edge) =>
    set((s) => ({
      edges: [...s.edges, edge],
      consumed: false,
      canvasSource: 'user',
    })),

  updateEdge: (id, data) =>
    set((s) => ({
      edges: s.edges.map((e) => (e.id === id ? { ...e, ...data, data: { ...e.data, ...data.data } } : e)),
      consumed: false,
      canvasSource: 'user',
    })),

  removeEdge: (id) =>
    set((s) => ({
      edges: s.edges.filter((e) => e.id !== id),
      consumed: false,
      canvasSource: 'user',
    })),

  setDirection: (dir) =>
    set({ direction: dir, consumed: false, canvasSource: 'user' }),

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
  subscribe: (listener) => store.subscribe(listener),
}));

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

  // 画布操作（整体替换，客户端通过 canvas_edit 发送完整快照）
  setCanvas: (state: Partial<CanvasState>) => void;

  // 视口操作
  setViewport: (viewport: Viewport) => void;

  // 消费状态操作
  setConsumed: (consumed: boolean) => void;
  setCanvasSource: (source: CanvasSource) => void;
  setLastConsumedAt: (timestamp: number | null) => void;
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

  // 画布操作（整体替换）
  setCanvas: (state) =>
    set((s) => ({ ...s, ...state })),

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

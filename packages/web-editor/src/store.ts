/**
 * 客户端 Store — 通过 WebSocket 与服务端同步
 * 本地状态为镜像，服务端 Store 为真相源
 */
import { create } from 'zustand';
import type {
  CanvasSource,
  FlowchartDirection,
  MermaidEdge,
  MermaidNode,
  Viewport,
} from '@mermaid-editor/serializer';

interface ClientEditorStore {
  // 画布状态
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  direction: FlowchartDirection;

  // 视口（平移/缩放）
  viewport: Viewport | null;

  // 消费状态
  consumed: boolean;
  lastConsumedAt: number | null;
  canvasSource: CanvasSource;

  // 标题
  title: string | null;

  // 本地操作（触发 WebSocket 同步）
  setNodes: (nodes: MermaidNode[]) => void;
  setEdges: (edges: MermaidEdge[]) => void;
  addNode: (node: MermaidNode) => void;
  updateNode: (id: string, data: Partial<MermaidNode>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: MermaidEdge) => void;
  updateEdge: (id: string, data: Partial<MermaidEdge>) => void;
  removeEdge: (id: string) => void;
  setDirection: (dir: FlowchartDirection) => void;

  // 服务端同步操作（不触发 WebSocket 回传）
  setCanvasSync: (nodes: MermaidNode[], edges: MermaidEdge[], direction: FlowchartDirection) => void;
  setConsumedSync: (consumed: boolean, lastConsumedAt: number | null, canvasSource: CanvasSource) => void;
  setTitleSync: (title: string | null) => void;
  setViewportSync: (viewport: Viewport) => void;

  // 读取
  getCanvas: () => { nodes: MermaidNode[]; edges: MermaidEdge[]; direction: FlowchartDirection };

  // 重置消费状态（触发 WebSocket）
  resetConsumed: () => void;
}

export const useEditorStore = create<ClientEditorStore>((set, get) => ({
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

  // 读取
  getCanvas: () => {
    const s = get();
    return { nodes: s.nodes, edges: s.edges, direction: s.direction };
  },

  // 重置消费状态
  resetConsumed: () => set({ consumed: false }),
}));

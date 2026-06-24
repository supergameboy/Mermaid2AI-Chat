/**
 * Zustand Store — 多视图画布状态唯一真相源
 *
 * 架构：
 * - views: ViewSummary[] — 所有视图元数据（轻量，全内存）
 * - activeViewId: string | null — 当前活动视图 ID
 * - activeCanvas/activeConsumed/activeViewport/activeTitle — 活动视图内容（仅活动视图在内存）
 *
 * 持久化责任：由外部 PersistenceService 通过 Store 订阅回调自动触发（防抖）
 * 广播责任：由外部 WsServer 在操作完成后显式调用
 *
 * 非活动视图内容存储在磁盘（persistence.loadViewContent/updateViewContent）
 */
import { create } from 'zustand';
import type {
  CanvasState,
  CanvasSource,
  ConsumedState,
  DiagramType,
  FlowchartDirection,
  GraphCanvasUpdate,
  MermaidEdge,
  MermaidNode,
  Viewport,
  ViewSource,
  ViewSummary,
} from '@mermaid2aichat/serializer';
import { migrateCanvasState } from '@mermaid2aichat/serializer';
import { randomUUID } from 'crypto';

/** 最大视图数限制 */
export const MAX_VIEWS = 100;

/** Store 实例类型（UseBoundStore，含 getState/setState/subscribe） */
export type EditorStoreInstance = ReturnType<typeof createEditorStore>;

/** 消费状态快照（用于 WebSocket 传输） */
export interface ConsumedPayload {
  consumed: boolean;
  lastConsumedAt: number | null;
  canvasSource: CanvasSource;
}

/** 视口快照（用于 WebSocket 传输） */
export interface ViewportPayload {
  viewport: Viewport;
}

/** createView 参数 */
export interface CreateViewParams {
  /** 视图标题 */
  title?: string | null;
  /** 视图来源 */
  source: ViewSource;
  /** AI 会话 ID（source='ai' 时必传） */
  sessionId?: string | null;
  /** 画布状态（diagramType 从 canvas.diagramType 派生） */
  canvas: CanvasState;
  /** 消费状态 */
  consumed: ConsumedState;
  /** 视口 */
  viewport: Viewport;
}

/** switchView 异步加载回调（由外部 persistence 提供） */
export interface ViewContentLoader {
  /** 加载指定视图内容（从磁盘） */
  loadViewContent: (viewId: string) => Promise<{
    canvas: CanvasState;
    consumed: ConsumedState;
    viewport: Viewport;
  } | null>;
  /** 保存指定视图内容到磁盘 */
  saveViewContent: (viewId: string, content: {
    canvas: CanvasState;
    consumed: ConsumedState;
    viewport: Viewport;
  }) => Promise<void>;
  /** 删除指定视图内容（从磁盘） */
  deleteViewContent: (viewId: string) => Promise<void>;
}

export interface EditorStore {
  // === 视图列表（元数据） ===
  views: ViewSummary[];
  /** 活动视图 ID */
  activeViewId: string | null;

  // === 活动视图内容（仅活动视图在内存） ===
  activeCanvas: CanvasState;
  activeConsumed: ConsumedState;
  activeViewport: Viewport;
  activeTitle: string | null;

  // === 视图操作 ===
  /** 创建新视图并设为活动视图 */
  createView: (params: CreateViewParams) => string;
  /** 切换活动视图（异步，涉及磁盘 I/O） */
  switchView: (viewId: string, loader: ViewContentLoader) => Promise<boolean>;
  /** 关闭视图（若关闭活动视图，自动切换到相邻视图） */
  closeView: (viewId: string, loader: ViewContentLoader) => Promise<void>;
  /** 重命名视图 */
  renameView: (viewId: string, title: string) => void;
  /** 重排序视图 */
  reorderViews: (orderedIds: string[]) => void;

  // === 活动视图内容操作 ===
  /** 更新活动画布（图结构类型部分更新） */
  updateActiveCanvas: (canvas: GraphCanvasUpdate) => void;
  /** 更新活动画布（全量替换，允许 diagramType 变更）
   * 用于数据图表类型编辑和图表类型切换
   */
  updateActiveCanvasState: (canvas: CanvasState) => void;
  /** 更新活动消费状态 */
  updateActiveConsumed: (consumed: Partial<ConsumedState>) => void;
  /** 更新活动视口 */
  updateActiveViewport: (viewport: Viewport) => void;
  /** 更新活动标题 */
  updateActiveTitle: (title: string | null) => void;
  /** 重置活动消费状态（CANVAS_EDIT / RESET 事件） */
  resetActiveConsumed: () => void;

  // === 读取方法 ===
  getViews: () => ViewSummary[];
  getActiveViewId: () => string | null;
  getActiveCanvas: () => CanvasState;
  getActiveConsumed: () => ConsumedState;
  getActiveViewport: () => Viewport;
  getActiveTitle: () => string | null;
  getViewSummary: (viewId: string) => ViewSummary | null;

  // === 初始化（持久化恢复） ===
  /** 从持久化数据恢复 Store 状态 */
  restoreFromPersist: (data: {
    views: ViewSummary[];
    activeViewId: string | null;
    activeContent: {
      canvas: CanvasState;
      consumed: ConsumedState;
      viewport: Viewport;
    } | null;
  }) => void;

  // === 订阅 ===
  subscribe: (listener: (state: EditorStore) => void) => () => void;
}

/** 创建空白画布（flowchart 类型） */
function createEmptyCanvas(): CanvasState {
  return { diagramType: 'flowchart', nodes: [], edges: [], direction: 'TD' };
}

/** 创建默认消费状态 */
function createDefaultConsumed(): ConsumedState {
  return { consumed: false, lastConsumedAt: null, canvasSource: null };
}

/** 创建默认视口 */
function createDefaultViewport(): Viewport {
  return { x: 0, y: 0, zoom: 1 };
}

/**
 * 创建 EditorStore 实例
 * 每个工作区独立一个 Store 实例（多工作区支持）
 */
export function createEditorStore() {
  return create<EditorStore>((set, get, store) => ({
    // 初始状态
    views: [],
    activeViewId: null,
    activeCanvas: createEmptyCanvas(),
    activeConsumed: createDefaultConsumed(),
    activeViewport: createDefaultViewport(),
    activeTitle: null,

    // === 视图操作 ===
    createView: (params) => {
      const state = get();
      // 视图数量限制（超限抛异常，符合"程序错误不可包容"原则）
      if (state.views.length >= MAX_VIEWS) {
        throw new Error(`已达到最大视图数限制（${MAX_VIEWS}），请先关闭旧视图`);
      }

      const now = Date.now();
      const viewId = randomUUID();
      // diagramType 从 canvas 派生，视图绑定后不可变更
      const diagramType: DiagramType = params.canvas.diagramType;
      const newView: ViewSummary = {
        id: viewId,
        title: params.title ?? null,
        createdAt: now,
        updatedAt: now,
        sessionId: params.sessionId ?? null,
        source: params.source,
        diagramType,
      };

      set({
        views: [...state.views, newView],
        activeViewId: viewId,
        activeCanvas: params.canvas,
        activeConsumed: params.consumed,
        activeViewport: params.viewport,
        activeTitle: params.title ?? null,
      });

      return viewId;
    },

    switchView: async (viewId, loader) => {
      const state = get();
      if (state.activeViewId === viewId) {
        return false; // 已是活动视图，未切换
      }

      const targetView = state.views.find((v) => v.id === viewId);
      if (!targetView) {
        throw new Error(`视图 ${viewId} 不存在`);
      }

      // 1. 保存当前活动视图内容到磁盘
      if (state.activeViewId) {
        await loader.saveViewContent(state.activeViewId, {
          canvas: state.activeCanvas,
          consumed: state.activeConsumed,
          viewport: state.activeViewport,
        });
      }

      // 2. 从磁盘加载目标视图内容
      // 容错：找不到文件时使用空画布（数据恢复，非 fallback 掩盖缺陷）
      // 场景：旧版本 createView 未保存内容到磁盘，导致历史视图无内容文件
      const content = await loader.loadViewContent(viewId);
      const viewContent = content ?? {
        canvas: createEmptyCanvas(),
        consumed: createDefaultConsumed(),
        viewport: createDefaultViewport(),
      };

      // 3. 更新活动视图状态（迁移旧版无 diagramType 的 canvas）
      set({
        activeViewId: viewId,
        activeCanvas: migrateCanvasState(viewContent.canvas),
        activeConsumed: viewContent.consumed,
        activeViewport: viewContent.viewport,
        activeTitle: targetView.title,
      });

      return true; // 切换成功
    },

    closeView: async (viewId, loader) => {
      const state = get();
      const viewIndex = state.views.findIndex((v) => v.id === viewId);
      if (viewIndex === -1) {
        return; // 视图不存在，忽略
      }

      // 1. 从磁盘删除视图内容
      await loader.deleteViewContent(viewId);

      // 2. 从 views 数组移除
      const newViews = state.views.filter((v) => v.id !== viewId);

      // 3. 若关闭的是活动视图，切换到相邻视图
      if (state.activeViewId === viewId) {
        if (newViews.length === 0) {
          // 所有视图都关闭了 → 创建默认空白视图
          const now = Date.now();
          const defaultViewId = randomUUID();
          const defaultView: ViewSummary = {
            id: defaultViewId,
            title: null,
            createdAt: now,
            updatedAt: now,
            sessionId: null,
            source: 'user',
            diagramType: 'flowchart',
          };
          set({
            views: [defaultView],
            activeViewId: defaultViewId,
            activeCanvas: createEmptyCanvas(),
            activeConsumed: createDefaultConsumed(),
            activeViewport: createDefaultViewport(),
            activeTitle: null,
          });
        } else {
          // 切换到相邻视图（优先前一个，无则后一个）
          const adjacentIndex = Math.max(0, viewIndex - 1);
          const adjacentView = newViews[adjacentIndex];

          // 从磁盘加载相邻视图内容
          // 容错：找不到文件时使用空画布（数据恢复，非 fallback 掩盖缺陷）
          // 场景：旧版本 createView 未保存内容到磁盘，导致历史视图无内容文件
          const content = await loader.loadViewContent(adjacentView.id);
          const viewContent = content ?? {
            canvas: createEmptyCanvas(),
            consumed: createDefaultConsumed(),
            viewport: createDefaultViewport(),
          };

          set({
            views: newViews,
            activeViewId: adjacentView.id,
            activeCanvas: migrateCanvasState(viewContent.canvas),
            activeConsumed: viewContent.consumed,
            activeViewport: viewContent.viewport,
            activeTitle: adjacentView.title,
          });
        }
      } else {
        // 关闭的不是活动视图 → 仅移除
        set({ views: newViews });
      }
    },

    renameView: (viewId, title) => {
      const state = get();
      const view = state.views.find((v) => v.id === viewId);
      if (!view) {
        return;
      }

      const newViews = state.views.map((v) =>
        v.id === viewId ? { ...v, title, updatedAt: Date.now() } : v
      );

      // 若重命名的是活动视图，同步更新 activeTitle
      const newActiveTitle = state.activeViewId === viewId ? title : state.activeTitle;

      set({ views: newViews, activeTitle: newActiveTitle });
    },

    reorderViews: (orderedIds) => {
      const state = get();
      // 按 orderedIds 顺序重排 views
      const viewMap = new Map(state.views.map((v) => [v.id, v]));
      const newViews: ViewSummary[] = [];
      for (const id of orderedIds) {
        const view = viewMap.get(id);
        if (view) {
          newViews.push(view);
          viewMap.delete(id);
        }
      }
      // 追加未在 orderedIds 中的视图（保持原有顺序）
      for (const view of viewMap.values()) {
        newViews.push(view);
      }

      set({ views: newViews });
    },

    // === 活动视图内容操作 ===
    updateActiveCanvas: (canvas) => {
      const state = get();
      if (!state.activeViewId) {
        return;
      }

      // 仅图结构类型支持部分更新；保留原 diagramType
      const currentCanvas = state.activeCanvas;
      if (currentCanvas.diagramType !== 'flowchart' &&
          currentCanvas.diagramType !== 'sequenceDiagram' &&
          currentCanvas.diagramType !== 'classDiagram' &&
          currentCanvas.diagramType !== 'erDiagram' &&
          currentCanvas.diagramType !== 'mindmap' &&
          currentCanvas.diagramType !== 'stateDiagram' &&
          currentCanvas.diagramType !== 'architecture') {
        // 数据图表类型不支持部分更新（应由 updateActiveCanvasState 处理）
        return;
      }

      const newCanvas = {
        diagramType: currentCanvas.diagramType,
        nodes: canvas.nodes ?? currentCanvas.nodes,
        edges: canvas.edges ?? currentCanvas.edges,
        direction: canvas.direction ?? currentCanvas.direction,
        metadata: canvas.metadata ?? currentCanvas.metadata,
        // 仅当 payload 显式携带 rawCode 时更新，避免误清空已有原始代码
        ...(canvas.rawCode !== undefined ? { rawCode: canvas.rawCode } : {}),
      };

      // 更新活动视图的 updatedAt
      const newViews = state.views.map((v) =>
        v.id === state.activeViewId ? { ...v, updatedAt: Date.now() } : v
      );

      set({
        views: newViews,
        activeCanvas: newCanvas,
      });
    },

    updateActiveCanvasState: (canvas) => {
      const state = get();
      if (!state.activeViewId) {
        return;
      }

      // 允许 diagramType 变更（用户切换图表类型）
      // 同步更新 ViewSummary 的 diagramType 字段
      const currentCanvas = state.activeCanvas;
      const typeChanged = canvas.diagramType !== currentCanvas.diagramType;

      // 更新活动视图的 updatedAt，若类型变更则同步 diagramType
      const newViews = state.views.map((v) =>
        v.id === state.activeViewId
          ? {
              ...v,
              updatedAt: Date.now(),
              ...(typeChanged ? { diagramType: canvas.diagramType } : {}),
            }
          : v
      );

      const newCanvas = {
        ...canvas,
        // 全量替换时若 payload 未提供 rawCode，保留当前值以避免误清空
        ...(canvas.rawCode === undefined && currentCanvas.rawCode !== undefined
          ? { rawCode: currentCanvas.rawCode }
          : {}),
      };

      set({
        views: newViews,
        activeCanvas: newCanvas,
      });
    },

    updateActiveConsumed: (consumed) => {
      const state = get();
      if (!state.activeViewId) {
        return;
      }

      set({
        activeConsumed: { ...state.activeConsumed, ...consumed },
      });
    },

    updateActiveViewport: (viewport) => {
      const state = get();
      if (!state.activeViewId) {
        return;
      }

      set({ activeViewport: viewport });
    },

    updateActiveTitle: (title) => {
      const state = get();
      if (!state.activeViewId) {
        return;
      }

      // 同步更新 views 中活动视图的 title
      const newViews = state.views.map((v) =>
        v.id === state.activeViewId ? { ...v, title, updatedAt: Date.now() } : v
      );

      set({ views: newViews, activeTitle: title });
    },

    resetActiveConsumed: () => {
      const state = get();
      if (!state.activeViewId) {
        return;
      }

      set({
        activeConsumed: {
          ...state.activeConsumed,
          consumed: false,
          canvasSource: 'user',
        },
      });
    },

    // === 读取方法 ===
    getViews: () => get().views,
    getActiveViewId: () => get().activeViewId,
    getActiveCanvas: () => {
      const s = get();
      return s.activeCanvas;
    },
    getActiveConsumed: () => get().activeConsumed,
    getActiveViewport: () => get().activeViewport,
    getActiveTitle: () => get().activeTitle,
    getViewSummary: (viewId) => {
      return get().views.find((v) => v.id === viewId) ?? null;
    },

    // === 初始化（持久化恢复） ===
    restoreFromPersist: (data) => {
      if (data.views.length === 0) {
        // 无持久化数据 → 创建默认空白视图
        const now = Date.now();
        const defaultViewId = randomUUID();
        const defaultView: ViewSummary = {
          id: defaultViewId,
          title: null,
          createdAt: now,
          updatedAt: now,
          sessionId: null,
          source: 'user',
          diagramType: 'flowchart',
        };
        set({
          views: [defaultView],
          activeViewId: defaultViewId,
          activeCanvas: createEmptyCanvas(),
          activeConsumed: createDefaultConsumed(),
          activeViewport: createDefaultViewport(),
          activeTitle: null,
        });
        return;
      }

      // 恢复持久化数据（迁移旧版无 diagramType 的 canvas）
      const activeViewId = data.activeViewId ?? data.views[0].id;
      const activeView = data.views.find((v) => v.id === activeViewId) ?? data.views[0];

      set({
        views: data.views,
        activeViewId,
        activeCanvas: data.activeContent
          ? migrateCanvasState(data.activeContent.canvas)
          : createEmptyCanvas(),
        activeConsumed: data.activeContent?.consumed ?? createDefaultConsumed(),
        activeViewport: data.activeContent?.viewport ?? createDefaultViewport(),
        activeTitle: activeView.title,
      });
    },

    // === 订阅 ===
    subscribe: (listener) => store.subscribe(listener),
  }));
}

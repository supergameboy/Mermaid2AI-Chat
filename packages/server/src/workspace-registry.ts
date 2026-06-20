/**
 * 工作区注册表 — 多工作区管理
 *
 * 架构：Map<workspaceRoot, { store, persistence, resolver }>
 * - 每个工作区独立 Store + PersistenceService 实例
 * - 通过 HTTP header / WS query 路由到对应工作区
 *
 * 持久化绑定：Store 订阅回调自动触发 persistence.schedulePersist（防抖）
 */
import { createEditorStore, type EditorStoreInstance } from './store.js';
import { createPersistenceService, type PersistenceService } from './persistence.js';
import { createWorkspaceResolver, type WorkspaceResolver } from './workspace-resolver.js';

/** 工作区上下文 */
export interface WorkspaceContext {
  /** 工作区 Store 实例（UseBoundStore，调用方法需通过 getState()） */
  store: EditorStoreInstance;
  /** 持久化服务 */
  persistence: PersistenceService;
  /** 工作区解析器 */
  resolver: WorkspaceResolver;
  /** Store 订阅取消函数 */
  unsubscribe: () => void;
}

/** 工作区 Store + Persistence 获取结果 */
export interface StoreAndPersistence {
  store: EditorStoreInstance;
  persistence: PersistenceService;
}

export class WorkspaceRegistry {
  private workspaces = new Map<string, WorkspaceContext>();

  /**
   * 获取或创建工作区上下文
   * @param workspaceRoot 工作区根目录（必传，无 fallback）
   * @throws Error 若 workspaceRoot 为空
   */
  async getOrCreate(workspaceRoot: string): Promise<StoreAndPersistence> {
    if (!workspaceRoot) {
      throw new Error('workspaceRoot 不能为空');
    }

    // 规范化路径（避免不同写法导致重复创建）
    const normalizedRoot = workspaceRoot.replace(/[\\/]+$/, '');

    const existing = this.workspaces.get(normalizedRoot);
    if (existing) {
      return { store: existing.store, persistence: existing.persistence };
    }

    // 创建新的工作区上下文
    const resolver = createWorkspaceResolver(normalizedRoot);
    resolver.ensureViewsDir();

    const persistence = createPersistenceService(resolver.getViewsDir());
    const store = createEditorStore();

    // 从磁盘加载持久化数据
    const persisted = await persistence.loadAll();
    store.getState().restoreFromPersist({
      views: persisted.views,
      activeViewId: persisted.activeViewId,
      activeContent: persisted.activeContent,
    });

    // 绑定 Store 订阅 → 自动触发持久化
    const unsubscribe = store.subscribe((state) => {
      persistence.schedulePersist({
        views: state.views,
        activeViewId: state.activeViewId,
        activeContent: {
          canvas: state.activeCanvas,
          consumed: state.activeConsumed,
          viewport: state.activeViewport,
        },
      });
    });

    const ctx: WorkspaceContext = { store, persistence, resolver, unsubscribe };
    this.workspaces.set(normalizedRoot, ctx);

    return { store, persistence };
  }

  /**
   * 获取已存在的工作区上下文（不创建）
   */
  get(workspaceRoot: string): WorkspaceContext | null {
    const normalizedRoot = workspaceRoot.replace(/[\\/]+$/, '');
    return this.workspaces.get(normalizedRoot) ?? null;
  }

  /**
   * 销毁所有工作区（进程退出时调用）
   */
  disposeAll(): void {
    for (const ctx of this.workspaces.values()) {
      // 强制同步写入当前状态
      const state = ctx.store.getState();
      ctx.persistence.flushSync({
        views: state.views,
        activeViewId: state.activeViewId,
        activeContent: {
          canvas: state.activeCanvas,
          consumed: state.activeConsumed,
          viewport: state.activeViewport,
        },
      });
      ctx.unsubscribe();
      ctx.persistence.dispose();
    }
    this.workspaces.clear();
  }
}

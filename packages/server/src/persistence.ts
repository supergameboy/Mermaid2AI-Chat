/**
 * 持久化服务 — 视图数据原子写入磁盘 + 懒加载
 *
 * 架构：
 * - views.json: 存储所有视图元数据 + 活动视图内容（合并存储）
 * - 非活动视图内容：单独存储在 views/{viewId}.json
 *
 * 持久化责任：由 Store 订阅回调自动触发 schedulePersist（防抖 500ms）
 * 进程退出：flushSync 同步强制写入
 */
import fs from 'fs';
import path from 'path';
import type {
  CanvasState,
  ConsumedState,
  Viewport,
  ViewSummary,
  View,
} from '@mermaid2aichat/serializer';
import { migrateCanvasState } from '@mermaid2aichat/serializer';

/** 持久化状态快照 */
export interface PersistState {
  views: ViewSummary[];
  activeViewId: string | null;
  activeContent: {
    canvas: CanvasState;
    consumed: ConsumedState;
    viewport: Viewport;
  };
}

/** 视图内容（磁盘存储格式） */
interface ViewContentOnDisk {
  canvas: CanvasState;
  consumed: ConsumedState;
  viewport: Viewport;
}

/** views.json 文件格式 */
interface ViewsFileFormat {
  version: 1;
  views: View[];
  activeViewId: string | null;
}

/** 防抖定时器 */
type DebounceTimer = ReturnType<typeof setTimeout> | null;

export interface PersistenceService {
  /** 从磁盘加载所有视图（启动时调用） */
  loadAll(): Promise<{
    views: ViewSummary[];
    activeViewId: string | null;
    activeContent: ViewContentOnDisk | null;
  }>;
  /** 持久化所有视图到磁盘（防抖，由 Store 订阅回调触发） */
  schedulePersist(state: PersistState): void;
  /** 强制同步写入（进程退出时，原子同步写入） */
  flushSync(state: PersistState): void;
  /** 加载指定视图内容（懒加载，切换时调用） */
  loadViewContent(viewId: string): Promise<ViewContentOnDisk | null>;
  /** 更新指定视图内容到磁盘（切换视图时保存旧活动视图内容） */
  updateViewContent(viewId: string, content: ViewContentOnDisk): Promise<void>;
  /** 删除指定视图内容（关闭视图时调用） */
  deleteViewContent(viewId: string): Promise<void>;
  /** 销毁（清理定时器、退出钩子、残留临时文件） */
  dispose(): void;
}

/**
 * 创建持久化服务
 * @param viewsDir 视图数据目录（如 .mermaid2aichat）
 */
export function createPersistenceService(viewsDir: string): PersistenceService {
  const viewsFile = path.join(viewsDir, 'views.json');
  const viewsContentDir = path.join(viewsDir, 'views');
  let debounceTimer: DebounceTimer = null;
  let disposed = false;

  // 确保目录存在
  function ensureDirs(): void {
    if (!fs.existsSync(viewsDir)) {
      fs.mkdirSync(viewsDir, { recursive: true });
    }
    if (!fs.existsSync(viewsContentDir)) {
      fs.mkdirSync(viewsContentDir, { recursive: true });
    }
  }

  // 清理残留临时文件（异常退出后可能残留）
  function cleanupTempFiles(): void {
    try {
      const tmpFile = `${viewsFile}.tmp`;
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    } catch {
      // 忽略清理失败
    }
  }

  // 启动时清理
  cleanupTempFiles();

  // 视图内容文件路径
  function getViewContentPath(viewId: string): string {
    return path.join(viewsContentDir, `${viewId}.json`);
  }

  // 原子异步写入
  async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    const tmpPath = `${filePath}.tmp`;
    try {
      await fs.promises.writeFile(tmpPath, content, 'utf-8');
      await fs.promises.rename(tmpPath, filePath);
    } catch (err) {
      // 清理残留临时文件
      try {
        await fs.promises.unlink(tmpPath);
      } catch {
        // 忽略
      }
      throw err;
    }
  }

  // 原子同步写入（进程退出时）
  function atomicWriteJsonSync(filePath: string, data: unknown): void {
    const content = JSON.stringify(data, null, 2);
    const tmpPath = `${filePath}.tmp`;
    try {
      fs.writeFileSync(tmpPath, content, 'utf-8');
      fs.renameSync(tmpPath, filePath);
    } catch (err) {
      // 清理残留临时文件
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // 忽略
      }
      throw err;
    }
  }

  return {
    async loadAll() {
      ensureDirs();
      try {
        const content = await fs.promises.readFile(viewsFile, 'utf-8');
        const data = JSON.parse(content) as ViewsFileFormat;

        if (!data.views || data.views.length === 0) {
          return { views: [], activeViewId: null, activeContent: null };
        }

        // 分离元数据和内容（迁移旧版无 diagramType 的 ViewSummary）
        const views: ViewSummary[] = data.views.map((v) => ({
          id: v.id,
          title: v.title,
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
          sessionId: v.sessionId,
          source: v.source,
          diagramType: v.diagramType ?? 'flowchart',
        }));

        const activeViewId = data.activeViewId ?? views[0].id;
        const activeView = data.views.find((v) => v.id === activeViewId) ?? data.views[0];

        const activeContent: ViewContentOnDisk = {
          canvas: migrateCanvasState(activeView.canvas),
          consumed: activeView.consumed,
          viewport: activeView.viewport,
        };

        // 将非活动视图内容写入单独文件
        for (const view of data.views) {
          if (view.id !== activeViewId) {
            const viewContent: ViewContentOnDisk = {
              canvas: view.canvas,
              consumed: view.consumed,
              viewport: view.viewport,
            };
            await fs.promises.writeFile(
              getViewContentPath(view.id),
              JSON.stringify(viewContent, null, 2),
              'utf-8'
            );
          }
        }

        return { views, activeViewId, activeContent };
      } catch (err) {
        // 文件不存在或解析失败 → 返回空
        return { views: [], activeViewId: null, activeContent: null };
      }
    },

    schedulePersist(state) {
      if (disposed) return;
      // 防抖 500ms
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        // 异步写入（不 await，避免阻塞订阅回调）
        this.flushSync(state);
      }, 500);
    },

    flushSync(state) {
      if (disposed) return;
      ensureDirs();

      // 合并元数据和活动视图内容
      const allViews: View[] = state.views.map((v) => {
        if (v.id === state.activeViewId) {
          return {
            ...v,
            canvas: state.activeContent.canvas,
            consumed: state.activeContent.consumed,
            viewport: state.activeContent.viewport,
          };
        }
        // 非活动视图：从磁盘读取内容（如果存在）
        try {
          const contentPath = getViewContentPath(v.id);
          if (fs.existsSync(contentPath)) {
            const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8')) as ViewContentOnDisk;
            return { ...v, ...content };
          }
        } catch {
          // 读取失败 → 用空内容
        }
        return {
          ...v,
          canvas: { diagramType: 'flowchart', nodes: [], edges: [], direction: 'TD' },
          consumed: { consumed: false, lastConsumedAt: null, canvasSource: null },
          viewport: { x: 0, y: 0, zoom: 1 },
        };
      });

      const fileData: ViewsFileFormat = {
        version: 1,
        views: allViews,
        activeViewId: state.activeViewId,
      };

      atomicWriteJsonSync(viewsFile, fileData);
    },

    async loadViewContent(viewId) {
      try {
        const contentPath = getViewContentPath(viewId);
        const content = await fs.promises.readFile(contentPath, 'utf-8');
        const parsed = JSON.parse(content) as ViewContentOnDisk;
        // 迁移旧版无 diagramType 的 canvas
        return {
          ...parsed,
          canvas: migrateCanvasState(parsed.canvas),
        };
      } catch {
        // 文件不存在 → 返回 null（可能是活动视图，内容在 views.json 中）
        return null;
      }
    },

    async updateViewContent(viewId, content) {
      ensureDirs();
      await atomicWriteJson(getViewContentPath(viewId), content);
    },

    async deleteViewContent(viewId) {
      try {
        const contentPath = getViewContentPath(viewId);
        await fs.promises.unlink(contentPath);
      } catch {
        // 文件不存在 → 忽略
      }
    },

    dispose() {
      disposed = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      cleanupTempFiles();
    },
  };
}

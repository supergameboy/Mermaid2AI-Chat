/**
 * 工作区根目录解析器 — 解析工作区路径，无 fallback
 *
 * 严格校验：workspaceRoot 必须传入，缺失时抛异常
 */
import path from 'path';
import fs from 'fs';

/** 视图数据目录名 */
const VIEWS_DIRNAME = '.mermaid2aichat';

export interface WorkspaceResolver {
  /** 获取工作区根目录 */
  getWorkspaceRoot(): string;
  /** 获取视图数据目录（.mermaid2aichat） */
  getViewsDir(): string;
  /** 获取 views.json 文件路径 */
  getViewsFile(): string;
  /** 确保视图数据目录存在 */
  ensureViewsDir(): void;
}

/**
 * 创建工作区解析器
 * @param workspaceRoot 工作区根目录（必传，无 fallback）
 * @throws Error 若 workspaceRoot 为空
 */
export function createWorkspaceResolver(workspaceRoot: string): WorkspaceResolver {
  if (!workspaceRoot) {
    throw new Error('workspaceRoot 不能为空');
  }

  const viewsDir = path.join(workspaceRoot, VIEWS_DIRNAME);

  return {
    getWorkspaceRoot: () => workspaceRoot,
    getViewsDir: () => viewsDir,
    getViewsFile: () => path.join(viewsDir, 'views.json'),
    ensureViewsDir: () => {
      if (!fs.existsSync(viewsDir)) {
        fs.mkdirSync(viewsDir, { recursive: true });
      }
    },
  };
}
